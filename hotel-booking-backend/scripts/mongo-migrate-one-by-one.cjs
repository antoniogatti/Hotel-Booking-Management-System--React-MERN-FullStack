const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { GridFSBucket } = require("mongodb");

const OVERFLOW_COLLECTION = "externalcalendarevents_checkInInfo_overflow";
const GRIDFS_BUCKETS = ["selfcheckin_files"];
const CHUNK_SIZE = 900000;

async function withRetry(fn, label, maxAttempts = 8) {
  let attempt = 0;
  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      return await fn();
    } catch (err) {
      const code = err && (err.code || (err.errorResponse && err.errorResponse.code));
      const msg = String(err && err.message ? err.message : err);
      const isThrottle = code === 16500 || msg.includes("RetryAfterMs") || msg.includes("Request rate is large");
      if (!isThrottle || attempt >= maxAttempts) {
        throw err;
      }

      const waitMs = Math.min(5000, 200 * attempt);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      console.log(`${label}: retry ${attempt}/${maxAttempts} after ${waitMs}ms`);
    }
  }
}

async function insertOneIdempotent(collection, doc, label) {
  try {
    await withRetry(() => collection.insertOne(doc), label);
    return;
  } catch (err) {
    const code = err && (err.code || (err.errorResponse && err.errorResponse.code));
    if (code === 11000) {
      return;
    }
    throw err;
  }
}

function getEnv(filePath, key) {
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const line = lines.find((l) => l.trim().startsWith(key + "="));
  if (!line) return null;
  return line.substring(line.indexOf("=") + 1).trim();
}

function transformDocForCollection(collectionName, doc) {
  return doc;
}

async function streamCopyGridFsFile(sourceBucket, targetBucket, fileDoc) {
  const upload = targetBucket.openUploadStreamWithId(fileDoc._id, fileDoc.filename, {
    chunkSizeBytes: fileDoc.chunkSize,
    contentType: fileDoc.contentType,
    metadata: fileDoc.metadata,
  });
  const download = sourceBucket.openDownloadStream(fileDoc._id);

  await new Promise((resolve, reject) => {
    download.on("error", reject);
    upload.on("error", reject);
    upload.on("finish", resolve);
    download.pipe(upload);
  });
}

async function migrateGridFsBucket(sourceDb, targetDb, bucketName) {
  const filesCollection = `${bucketName}.files`;
  const chunksCollection = `${bucketName}.chunks`;

  for (const collectionName of [chunksCollection, filesCollection]) {
    const existing = await targetDb.listCollections({ name: collectionName }).toArray();
    if (existing.length > 0) {
      await withRetry(() => targetDb.collection(collectionName).drop(), `${collectionName} drop`);
    }
  }

  const sourceFilesCount = await sourceDb.collection(filesCollection).countDocuments({});
  const sourceChunksCount = await sourceDb.collection(chunksCollection).countDocuments({});

  const sourceBucket = new GridFSBucket(sourceDb, { bucketName });
  const targetBucket = new GridFSBucket(targetDb, { bucketName });

  const files = await sourceDb.collection(filesCollection).find({}).toArray();
  for (const fileDoc of files) {
    await withRetry(
      () => streamCopyGridFsFile(sourceBucket, targetBucket, fileDoc),
      `${bucketName} stream file ${String(fileDoc._id)}`,
      5
    );
  }

  const targetFilesCount = await targetDb.collection(filesCollection).countDocuments({});
  const targetChunksCount = await targetDb.collection(chunksCollection).countDocuments({});

  return [
    {
      collectionName: filesCollection,
      sourceCount: sourceFilesCount,
      inserted: targetFilesCount,
      targetCount: targetFilesCount,
      match: sourceFilesCount === targetFilesCount,
      transformedCount: 0,
      overflowChunkCount: 0,
      overflowCount: 0,
      transformedIds: [],
    },
    {
      collectionName: chunksCollection,
      sourceCount: sourceChunksCount,
      inserted: targetChunksCount,
      targetCount: targetChunksCount,
      match: sourceChunksCount === targetChunksCount,
      transformedCount: 0,
      overflowChunkCount: 0,
      overflowCount: 0,
      transformedIds: [],
    },
  ];
}

async function migrateCollection(sourceDb, targetDb, collectionName) {
  console.log(`Starting collection: ${collectionName}`);
  const sourceCol = sourceDb.collection(collectionName);
  const targetCol = targetDb.collection(collectionName);

  const sourceCount = await sourceCol.countDocuments({});

  const existingTarget = await targetDb.listCollections({ name: collectionName }).toArray();
  if (existingTarget.length > 0) {
    await withRetry(() => targetCol.drop(), `${collectionName} drop`);
  }

  await withRetry(() => targetCol.deleteMany({}), `${collectionName} deleteMany`);
  if (collectionName === "externalcalendarevents") {
    const existingOverflow = await targetDb.listCollections({ name: OVERFLOW_COLLECTION }).toArray();
    if (existingOverflow.length > 0) {
      await withRetry(() => targetDb.collection(OVERFLOW_COLLECTION).drop(), `${OVERFLOW_COLLECTION} drop`);
    }

    await withRetry(
      () => targetDb.collection(OVERFLOW_COLLECTION).deleteMany({}),
      `${OVERFLOW_COLLECTION} deleteMany`
    );
  }

  const cursor = sourceCol.find({});
  let inserted = 0;
  let transformedCount = 0;
  let overflowChunkCount = 0;
  const transformedIds = [];

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    const targetDoc = transformDocForCollection(collectionName, doc);
    try {
      await insertOneIdempotent(targetCol, targetDoc, `${collectionName} insertOne`);
      inserted += 1;
    } catch (docErr) {
      const code = docErr && (docErr.code || (docErr.errorResponse && docErr.errorResponse.code));
      console.error(
        `Insert failure in ${collectionName} for _id=${String(doc && doc._id)} code=${String(code)}: ${String(
          docErr && docErr.message ? docErr.message : docErr
        )}`
      );
      const message = String(docErr && docErr.message ? docErr.message : docErr);
      const tooLarge = message.includes("RequestEntityTooLarge") || message.includes("Request size is too large");

      if (collectionName === "externalcalendarevents" && tooLarge && doc.checkInInfo !== undefined) {
        const checkInPayload =
          typeof doc.checkInInfo === "string" ? doc.checkInInfo : JSON.stringify(doc.checkInInfo);
        const chunks = [];
        for (let i = 0; i < checkInPayload.length; i += CHUNK_SIZE) {
          chunks.push(checkInPayload.slice(i, i + CHUNK_SIZE));
        }

        const overflowDocs = chunks.map((chunk, idx) => ({
          _id: `${String(doc._id)}:${idx}`,
          parentId: doc._id,
          seq: idx,
          total: chunks.length,
          chunk,
          createdAt: new Date(),
        }));
        for (const overflowDoc of overflowDocs) {
          await withRetry(
            () =>
              targetDb
                .collection(OVERFLOW_COLLECTION)
                .replaceOne({ _id: overflowDoc._id }, overflowDoc, { upsert: true }),
            `${OVERFLOW_COLLECTION} replaceOne`
          );
        }

        overflowChunkCount += overflowDocs.length;
        transformedCount += 1;
        transformedIds.push(String(doc._id));

        const trimmedDoc = {
          ...targetDoc,
          checkInInfo: null,
          checkInInfoOverflow: {
            collection: OVERFLOW_COLLECTION,
            chunks: overflowDocs.length,
            originalBytes: Buffer.byteLength(checkInPayload, "utf8"),
          },
        };

        await withRetry(
          () => targetCol.insertOne(trimmedDoc),
          `${collectionName} insertOne(trimmed)`
        );
        inserted += 1;
      } else {
        throw docErr;
      }
    }
  }

  const targetCount = await targetCol.countDocuments({});
  const overflowCount =
    collectionName === "externalcalendarevents"
      ? await targetDb.collection(OVERFLOW_COLLECTION).countDocuments({})
      : 0;

  return {
    collectionName,
    sourceCount,
    inserted,
    targetCount,
    match: sourceCount === targetCount,
    transformedCount,
    overflowChunkCount,
    overflowCount,
    transformedIds,
  };
}

async function main() {
  const backendRoot = path.resolve(__dirname, "..");
  const workspaceRoot = path.resolve(backendRoot, "..");
  const sourceUri = getEnv(path.join(backendRoot, ".env.development"), "MONGODB_CONNECTION_STRING");
  const targetUri =
    getEnv(path.join(backendRoot, ".env.production"), "MONGODB_CONNECTION_STRING") ||
    getEnv(path.join(backendRoot, ".env.production"), "MONGODB_CONNECTION_STRING_PRO");

  if (!sourceUri) throw new Error("Source Mongo connection not found in .env.development");
  if (!targetUri) throw new Error("Target Mongo connection not found in .env.production");

  const sourceConn = await mongoose
    .createConnection(sourceUri, { serverSelectionTimeoutMS: 20000 })
    .asPromise();
  const targetConn = await mongoose
    .createConnection(targetUri, { serverSelectionTimeoutMS: 20000 })
    .asPromise();

  const sourceCollections = await sourceConn.db.listCollections().toArray();
  const allNames = sourceCollections.map((c) => c.name).sort((a, b) => a.localeCompare(b));
  const gridFsManagedNames = new Set(
    GRIDFS_BUCKETS.flatMap((bucket) => [`${bucket}.files`, `${bucket}.chunks`])
  );
  const names = allNames.filter((name) => !gridFsManagedNames.has(name));

  const results = [];
  for (const name of names) {
    const result = await migrateCollection(sourceConn.db, targetConn.db, name);
    results.push(result);
    console.log(`${name}: source=${result.sourceCount}, target=${result.targetCount}, match=${result.match}`);
  }

  for (const bucketName of GRIDFS_BUCKETS) {
    const gridFsResults = await migrateGridFsBucket(sourceConn.db, targetConn.db, bucketName);
    for (const result of gridFsResults) {
      results.push(result);
      console.log(
        `${result.collectionName}: source=${result.sourceCount}, target=${result.targetCount}, match=${result.match}`
      );
    }
  }

  const report = {
    timestampUtc: new Date().toISOString(),
    sourceDb: sourceConn.db.databaseName,
    targetDb: targetConn.db.databaseName,
    collectionCount: results.length,
    results,
    allMatched: results.every((r) => r.match),
  };

  const reportPath = path.join(workspaceRoot, "infra", "Sub-Copy", "exports", "mongo-migration-report.json");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  await sourceConn.close();
  await targetConn.close();

  if (!report.allMatched) {
    console.error("One or more collections did not match. See report:", reportPath);
    process.exit(2);
  }

  console.log("Migration completed successfully. Report:", reportPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

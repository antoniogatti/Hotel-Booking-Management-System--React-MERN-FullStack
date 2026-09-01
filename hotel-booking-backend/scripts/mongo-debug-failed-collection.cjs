const fs = require("fs");
const mongoose = require("mongoose");

function getEnv(filePath, key) {
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const line = lines.find((l) => l.trim().startsWith(key + "="));
  if (!line) return null;
  return line.substring(line.indexOf("=") + 1).trim();
}

async function main() {
  const sourceUri = getEnv(".env.development", "MONGODB_CONNECTION_STRING");
  const targetUri = getEnv(".env.production", "MONGODB_CONNECTION_STRING") || getEnv(".env.production", "MONGODB_CONNECTION_STRING_PRO");
  const collectionName = process.argv[2] || "externalcalendarevents";

  const sourceConn = await mongoose.createConnection(sourceUri, { serverSelectionTimeoutMS: 20000 }).asPromise();
  const targetConn = await mongoose.createConnection(targetUri, { serverSelectionTimeoutMS: 20000 }).asPromise();

  const sourceCol = sourceConn.db.collection(collectionName);
  const targetCol = targetConn.db.collection(collectionName);

  await targetCol.deleteMany({});

  const docs = await sourceCol.find({}).toArray();
  let ok = 0;
  let fail = 0;
  for (const doc of docs) {
    try {
      await targetCol.insertOne(doc);
      ok += 1;
    } catch (err) {
      fail += 1;
      console.error("FAILED_DOC", String(doc._id));
      console.error("ERROR_MSG", err && err.message ? err.message : String(err));
      if (err && err.errorResponse) {
        console.error("ERROR_RESPONSE", JSON.stringify(err.errorResponse));
      }
    }
  }

  console.log(`COL=${collectionName} TOTAL=${docs.length} OK=${ok} FAIL=${fail}`);

  await sourceConn.close();
  await targetConn.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

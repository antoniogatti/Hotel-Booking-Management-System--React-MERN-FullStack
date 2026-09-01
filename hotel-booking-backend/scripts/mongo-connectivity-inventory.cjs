const fs = require('fs');
const mongoose = require('mongoose');

function getLineValue(lines, key) {
  const line = lines.find(l => l.trim().startsWith(key + '='));
  if (!line) return null;
  return line.substring(line.indexOf('=') + 1).trim();
}

function getCommentedOldMongo(lines) {
  const line = lines.find(l => l.trim().startsWith('# MONGODB_CONNECTION_STRING='));
  if (!line) return null;
  return line.substring(line.indexOf('=') + 1).trim();
}

(async () => {
  const envPath = '.env.production';
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);

  const srcUri = getCommentedOldMongo(lines);
  const dstUri = getLineValue(lines, 'MONGODB_CONNECTION_STRING') || getLineValue(lines, 'MONGODB_CONNECTION_STRING_PRO');

  if (!srcUri) throw new Error('Old source connection string not found in commented MONGODB_CONNECTION_STRING line');
  if (!dstUri) throw new Error('Target connection string not found in MONGODB_CONNECTION_STRING or MONGODB_CONNECTION_STRING_PRO');

  const srcConn = await mongoose.createConnection(srcUri, { serverSelectionTimeoutMS: 15000 }).asPromise();
  const dstConn = await mongoose.createConnection(dstUri, { serverSelectionTimeoutMS: 15000 }).asPromise();

  const srcCollections = await srcConn.db.listCollections().toArray();
  console.log('SOURCE_DB=' + srcConn.db.databaseName);
  console.log('TARGET_DB=' + dstConn.db.databaseName);
  console.log('SOURCE_COLLECTION_COUNT=' + srcCollections.length);

  for (const c of srcCollections) {
    const n = await srcConn.db.collection(c.name).countDocuments({});
    console.log(`${c.name}\t${n}`);
  }

  await srcConn.close();
  await dstConn.close();
})();

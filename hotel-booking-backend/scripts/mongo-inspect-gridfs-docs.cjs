const fs = require("fs");
const mongoose = require("mongoose");

function getEnv(filePath, key) {
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const line = lines.find((l) => l.trim().startsWith(key + "="));
  if (!line) return null;
  return line.substring(line.indexOf("=") + 1).trim();
}

function summarizeDoc(doc) {
  const out = {};
  for (const k of Object.keys(doc)) {
    const v = doc[k];
    if (v === null) {
      out[k] = "null";
    } else if (Array.isArray(v)) {
      out[k] = `array(len=${v.length})`;
    } else if (typeof v === "string") {
      out[k] = `string(len=${v.length})`;
    } else if (typeof v === "object") {
      out[k] = `object(keys=${Object.keys(v).length})`;
    } else {
      out[k] = typeof v;
    }
  }
  return out;
}

(async () => {
  const sourceUri = getEnv(".env.development", "MONGODB_CONNECTION_STRING");
  const conn = await mongoose.createConnection(sourceUri, { serverSelectionTimeoutMS: 20000 }).asPromise();

  for (const name of ["selfcheckin_files.files", "selfcheckin_files.chunks"]) {
    const col = conn.db.collection(name);
    const count = await col.countDocuments({});
    const docs = await col.find({}).limit(2).toArray();
    console.log(`COLLECTION=${name} COUNT=${count}`);
    for (let i = 0; i < docs.length; i += 1) {
      console.log(`DOC_${i}=${JSON.stringify(summarizeDoc(docs[i]))}`);
    }
  }

  await conn.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

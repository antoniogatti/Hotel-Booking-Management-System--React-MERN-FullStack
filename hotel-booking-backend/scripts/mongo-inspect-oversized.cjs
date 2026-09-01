const fs = require("fs");
const mongoose = require("mongoose");

function getEnv(filePath, key) {
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const line = lines.find((l) => l.trim().startsWith(key + "="));
  if (!line) return null;
  return line.substring(line.indexOf("=") + 1).trim();
}

function approxSize(v) {
  try {
    return Buffer.byteLength(JSON.stringify(v), "utf8");
  } catch {
    return -1;
  }
}

async function main() {
  const sourceUri = getEnv(".env.development", "MONGODB_CONNECTION_STRING");
  const ids = process.argv.slice(2);
  if (ids.length === 0) throw new Error("Pass at least one _id");

  const conn = await mongoose.createConnection(sourceUri, { serverSelectionTimeoutMS: 20000 }).asPromise();
  const col = conn.db.collection("externalcalendarevents");

  for (const id of ids) {
    const doc = await col.findOne({ _id: new mongoose.Types.ObjectId(id) });
    if (!doc) {
      console.log(id + " NOT_FOUND");
      continue;
    }

    const total = approxSize(doc);
    const fields = Object.keys(doc)
      .map((k) => ({ k, n: approxSize(doc[k]) }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 10);

    console.log("ID=" + id + " TOTAL_BYTES=" + total);
    for (const f of fields) {
      console.log("  " + f.k + "\t" + f.n);
    }
  }

  await conn.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

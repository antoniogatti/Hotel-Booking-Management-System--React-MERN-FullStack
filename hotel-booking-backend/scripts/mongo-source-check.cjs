const fs = require('fs');
const mongoose = require('mongoose');

function getEnv(path, key){
  const lines = fs.readFileSync(path,'utf8').split(/\r?\n/);
  const line = lines.find(l => l.trim().startsWith(key + '='));
  if(!line) return null;
  return line.substring(line.indexOf('=')+1).trim();
}

(async ()=>{
  const src = getEnv('.env.development','MONGODB_CONNECTION_STRING');
  const dst = getEnv('.env.production','MONGODB_CONNECTION_STRING') || getEnv('.env.production','MONGODB_CONNECTION_STRING_PRO');
  if(!src) throw new Error('missing source in .env.development');
  if(!dst) throw new Error('missing target in .env.production');

  const srcConn = await mongoose.createConnection(src,{serverSelectionTimeoutMS:20000}).asPromise();
  const dstConn = await mongoose.createConnection(dst,{serverSelectionTimeoutMS:20000}).asPromise();

  console.log('SOURCE_DB=' + srcConn.db.databaseName);
  console.log('TARGET_DB=' + dstConn.db.databaseName);

  const cols = await srcConn.db.listCollections().toArray();
  console.log('SOURCE_COLLECTIONS=' + cols.length);
  for (const c of cols){
    const n = await srcConn.db.collection(c.name).countDocuments({});
    console.log(c.name + '\t' + n);
  }

  await srcConn.close();
  await dstConn.close();
})();

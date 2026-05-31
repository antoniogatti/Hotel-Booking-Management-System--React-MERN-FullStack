const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const envPath = path.join(__dirname, '..', '.env');
let envText = '';
try { envText = fs.readFileSync(envPath, 'utf8'); } catch (e) { console.error('Unable to read .env:', e.message); process.exit(2); }

const m = envText.match(/^MONGODB_CONNECTION_STRING=(.*)$/m);
const conn = m ? m[1].trim() : process.env.MONGODB_CONNECTION_STRING;
if (!conn) { console.error('MONGODB_CONNECTION_STRING not found in .env'); process.exit(3); }

(async () => {
  try {
    await mongoose.connect(conn, { connectTimeoutMS: 10000 });
    const docs = await mongoose.connection.db.collection('schedulerrunlogs').find({ schedulerName: 'booking_enrichment' }).sort({ startedAt: -1 }).limit(5).toArray();
    console.log(JSON.stringify(docs, null, 2));
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('Query failed:', err && err.message ? err.message : err);
    try { await mongoose.connection.close(); } catch (e) {}
    process.exit(1);
  }
})();

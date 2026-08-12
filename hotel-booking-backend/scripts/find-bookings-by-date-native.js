const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
let envText = '';
try { envText = fs.readFileSync(envPath, 'utf8'); } catch (e) { envText = ''; }
const m = envText.match(/^MONGODB_CONNECTION_STRING=(.*)$/m);
const uri = m ? m[1].trim() : process.env.MONGODB_CONNECTION_STRING;
if (!uri) {
  console.error('MONGODB_CONNECTION_STRING not set');
  process.exit(2);
}

(async () => {
  const client = new MongoClient(uri, { connectTimeoutMS: 10000 });
  try {
    await client.connect();

    const db = client.db();
    const start = new Date('2026-06-10T00:00:00.000Z');
    const end = new Date('2026-06-16T23:59:59.999Z');

    console.log('Searching bookings with checkIn between', start.toISOString(), 'and', end.toISOString());
    const bookings = await db.collection('bookings').find({ checkIn: { $gte: start, $lte: end } }).project({ reservationNumber:1, firstName:1, lastName:1, checkIn:1, checkOut:1, oneNoteSync:1 }).toArray();
    console.log('\nBookings found:', bookings.length);
    bookings.forEach(b => console.log(JSON.stringify(b, null, 2)));

    console.log('\nSearching external calendar events with startDate between', start.toISOString(), 'and', end.toISOString());
    const events = await db.collection('externalcalendarevents').find({ startDate: { $gte: start, $lte: end } }).project({ externalUid:1, summary:1, startDate:1, endDate:1, firstName:1, lastName:1, oneNoteSync:1 }).toArray();
    console.log('\nExternal events found:', events.length);
    events.forEach(e => console.log(JSON.stringify(e, null, 2)));

    await client.close();
    process.exit(0);
  } catch (err) {
    console.error('Query failed:', err && err.message ? err.message : err);
    try { await client.close(); } catch (e) {}
    process.exit(1);
  }
})();

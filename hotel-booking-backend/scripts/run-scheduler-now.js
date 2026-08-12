const path = require('path');
const fs = require('fs');
const envPath = path.join(__dirname, '..', '.env');
let envText = '';
try { envText = fs.readFileSync(envPath, 'utf8'); } catch (e) { envText = ''; }
const kv = {};
envText.split(/\r?\n/).forEach(line => {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) kv[m[1]] = m[2];
});
process.env = Object.assign({}, process.env, kv);

(async () => {
  try {
    const scheduler = require(path.join(__dirname, '..', 'dist', 'hotel-booking-backend', 'src', 'lib', 'booking-enrichment-scheduler.js'));
    console.log('Running booking enrichment scheduler now...');
    const result = await scheduler.runBookingEnrichmentSyncNow();
    console.log('Scheduler run result:', JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Scheduler run failed:', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();

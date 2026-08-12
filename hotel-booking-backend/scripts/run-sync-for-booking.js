const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// read .env from backend folder
const envPath = path.join(__dirname, '..', '.env');
let envText = '';
try { envText = fs.readFileSync(envPath, 'utf8'); } catch (e) { envText = ''; }
const kv = {};
envText.split(/\r?\n/).forEach(line => {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) kv[m[1]] = m[2];
});
process.env = Object.assign({}, process.env, kv);

const conn = process.env.MONGODB_CONNECTION_STRING;
if (!conn) {
  console.error('MONGODB_CONNECTION_STRING not set');
  process.exit(2);
}

(async () => {
  try {
    await mongoose.connect(conn, { connectTimeoutMS: 10000 });

    // require compiled models and libs from dist
    const Booking = require(path.join(__dirname, '..', 'dist', 'hotel-booking-backend', 'src', 'models', 'booking.js')).default;
    const Hotel = require(path.join(__dirname, '..', 'dist', 'hotel-booking-backend', 'src', 'models', 'hotel.js')).default;
    const User = require(path.join(__dirname, '..', 'dist', 'hotel-booking-backend', 'src', 'models', 'user.js')).default;
    const mgAuth = require(path.join(__dirname, '..', 'dist', 'hotel-booking-backend', 'src', 'lib', 'microsoft-graph-auth.js'));
    const onenoteSync = require(path.join(__dirname, '..', 'dist', 'hotel-booking-backend', 'src', 'lib', 'onenote-booking-sync.js'));

    // booking id to test
    const bookingId = process.env.TEST_BOOKING_ID || '6a1f2dcca24e5b77bd15435a';
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      console.error('Booking not found:', bookingId);
      process.exit(3);
    }

    const hotel = await Hotel.findById(booking.hotelId).lean() || {};

    // find automation user (mimic scheduler.getAutomationUser)
    const preferredEmail = String(process.env.BOOKING_ENRICHMENT_SYNC_USER_EMAIL || '').trim().toLowerCase();
    let automationUser = null;
    if (preferredEmail) {
      automationUser = await User.findOne({ email: preferredEmail, 'microsoftGraphAuth.accessTokenCiphertext': { $exists: true, $ne: '' } });
    }
    if (!automationUser) {
      automationUser = await User.findOne({ role: { $in: ['admin', 'hotel_owner'] }, 'microsoftGraphAuth.accessTokenCiphertext': { $exists: true, $ne: '' } }).sort({ updatedAt: -1 });
    }

    if (!automationUser) {
      console.error('No automation user with Microsoft Graph tokens found');
      process.exit(4);
    }

    // get valid access token (this may refresh and save the user)
    const accessToken = await mgAuth.getValidMicrosoftGraphAccessToken(automationUser);
    if (!accessToken) {
      console.error('Failed to obtain Microsoft Graph access token for automation user');
      process.exit(5);
    }

    console.log('Calling syncBookingFromOneNote for booking', bookingId);
    const result = await onenoteSync.syncBookingFromOneNote({ accessToken, booking: {
      firstName: booking.firstName || '',
      lastName: booking.lastName || '',
      phone: booking.phone || '',
      adultCount: booking.adultCount,
      childCount: booking.childCount,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
    }, hotel: { name: hotel.name, slug: hotel.slug } });
    console.log('Sync result:', JSON.stringify(result, null, 2));

    if (result.matched) {
      const apply = require(path.join(__dirname, '..', 'dist', 'hotel-booking-backend', 'src', 'lib', 'onenote-booking-apply.js'));
      apply.applyOneNoteSyncToRecord({ record: booking, matchedPage: result.page, guestName: result.guestName, fallback: { phone: booking.phone, email: booking.email, nationality: booking.nationality } });
      await booking.save();
      console.log('Applied OneNote data and saved booking.');
    } else {
      console.log('No match to apply.');
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('Script failed:', err && err.stack ? err.stack : err);
    try { await mongoose.connection.close(); } catch (e) {}
    process.exit(1);
  }
})();

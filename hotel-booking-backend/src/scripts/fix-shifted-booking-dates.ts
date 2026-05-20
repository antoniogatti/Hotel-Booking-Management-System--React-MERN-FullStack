import mongoose from "mongoose";

type BookingDateFix = {
  reservationNumber: string;
  checkIn: string;
  checkOut: string;
};

const TARGET_FIXES: BookingDateFix[] = [
  {
    reservationNumber: "PP-20260520-67B5BC",
    checkIn: "2026-06-04",
    checkOut: "2026-06-06",
  },
  {
    reservationNumber: "PP-20260422-57754B",
    checkIn: "2026-08-29",
    checkOut: "2026-09-03",
  },
];

const toUtcDateOnly = (ymd: string) => {
  const [yearText, monthText, dayText] = ymd.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!year || !month || !day) {
    throw new Error(`Invalid date value: ${ymd}`);
  }

  return new Date(Date.UTC(year, month - 1, day));
};

const run = async () => {
  const connectionString = process.env.MONGODB_CONNECTION_STRING;

  if (!connectionString) {
    throw new Error("MONGODB_CONNECTION_STRING is required");
  }

  await mongoose.connect(connectionString);

  try {
    const bookingsCollection = mongoose.connection.collection("bookings");

    const results: Array<{
      reservationNumber: string;
      found: boolean;
      modifiedCount: number;
      before?: { checkIn?: Date; checkOut?: Date };
      after?: { checkIn?: Date; checkOut?: Date };
    }> = [];

    for (const target of TARGET_FIXES) {
      const before = await bookingsCollection.findOne(
        { reservationNumber: target.reservationNumber },
        { projection: { checkIn: 1, checkOut: 1, reservationNumber: 1 } }
      );

      if (!before) {
        results.push({
          reservationNumber: target.reservationNumber,
          found: false,
          modifiedCount: 0,
        });
        continue;
      }

      const updateResult = await bookingsCollection.updateOne(
        { reservationNumber: target.reservationNumber },
        {
          $set: {
            checkIn: toUtcDateOnly(target.checkIn),
            checkOut: toUtcDateOnly(target.checkOut),
          },
        }
      );

      const after = await bookingsCollection.findOne(
        { reservationNumber: target.reservationNumber },
        { projection: { checkIn: 1, checkOut: 1, reservationNumber: 1 } }
      );

      results.push({
        reservationNumber: target.reservationNumber,
        found: true,
        modifiedCount: updateResult.modifiedCount,
        before: {
          checkIn: before.checkIn as Date | undefined,
          checkOut: before.checkOut as Date | undefined,
        },
        after: {
          checkIn: (after?.checkIn as Date | undefined) || undefined,
          checkOut: (after?.checkOut as Date | undefined) || undefined,
        },
      });
    }

    console.log(
      JSON.stringify(
        {
          action: "fix-shifted-booking-dates",
          fixedReservationNumbers: TARGET_FIXES.map((item) => item.reservationNumber),
          results,
        },
        null,
        2
      )
    );
  } finally {
    await mongoose.connection.close();
  }
};

run().catch((error) => {
  console.error("fix-shifted-booking-dates failed", error);
  process.exit(1);
});

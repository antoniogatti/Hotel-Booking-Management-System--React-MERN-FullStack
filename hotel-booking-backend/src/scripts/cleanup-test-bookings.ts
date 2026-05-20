import mongoose from "mongoose";

const TEST_BOOKING_EMAIL_REGEX =
  /^antoniogatti\+(palazzopintotest|2a-|duplicate-|2a2c-).*@gmail\.com$/i;

const run = async () => {
  const connectionString = process.env.MONGODB_CONNECTION_STRING;

  if (!connectionString) {
    throw new Error("MONGODB_CONNECTION_STRING is required");
  }

  await mongoose.connect(connectionString);

  try {
    const result = await mongoose.connection.collection("bookings").deleteMany({
      userId: "guest-request",
      email: { $regex: TEST_BOOKING_EMAIL_REGEX },
    });

    console.log(
      JSON.stringify(
        {
          action: "cleanup-test-bookings",
          deletedCount: result.deletedCount,
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
  console.error("cleanup-test-bookings failed", error);
  process.exit(1);
});

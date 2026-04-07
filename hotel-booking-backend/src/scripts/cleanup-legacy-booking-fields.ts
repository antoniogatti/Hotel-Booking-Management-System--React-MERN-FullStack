import mongoose from "mongoose";

const run = async () => {
  const connectionString = process.env.MONGODB_CONNECTION_STRING;

  if (!connectionString) {
    throw new Error("MONGODB_CONNECTION_STRING is required");
  }

  await mongoose.connect(connectionString);

  try {
    const result = await mongoose.connection.collection("bookings").updateMany(
      {
        $or: [
          { paymentStatus: { $exists: true } },
          { paymentMethod: { $exists: true } },
        ],
      },
      {
        $unset: {
          paymentStatus: "",
          paymentMethod: "",
        },
      }
    );

    console.log(
      JSON.stringify(
        {
          action: "cleanup-legacy-booking-fields",
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
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
  console.error("cleanup-legacy-booking-fields failed", error);
  process.exit(1);
});
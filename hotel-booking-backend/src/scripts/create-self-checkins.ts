import "dotenv/config";
import mongoose from "mongoose";
import SelfCheckin from "../models/selfCheckin";

const run = async () => {
  const connectionString = process.env.MONGODB_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error("MONGODB_CONNECTION_STRING is not set");
  }

  await mongoose.connect(connectionString);

  try {
    // Ensure indexes are created
    await SelfCheckin.init();
    console.log("SelfCheckin collection initialized and indexes created");
  } finally {
    await mongoose.connection.close();
  }
};

run().catch((err) => {
  console.error("create-self-checkins failed:", err);
  process.exit(1);
});

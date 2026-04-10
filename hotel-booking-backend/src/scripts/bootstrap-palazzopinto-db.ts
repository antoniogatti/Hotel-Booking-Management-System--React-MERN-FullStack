import "dotenv/config";
import mongoose from "mongoose";

const SOURCE_DB = "test";
const TARGET_DB = "PalazzoPinto_DB";
const FOUNDATION_COLLECTIONS = ["users", "hotels", "auditlogs"] as const;
const EMPTY_COLLECTIONS = ["bookings", "bookingdaystatuses", "externalcalendarevents"] as const;

const withDatabaseName = (connectionString: string, dbName: string) => {
  const [beforeQuery, query = ""] = connectionString.split("?");
  const match = beforeQuery.match(/^(mongodb(?:\+srv)?:\/\/[^/]+)(?:\/.*)?$/i);

  if (!match) {
    throw new Error("Unsupported Mongo connection string format");
  }

  return `${match[1]}/${dbName}${query ? `?${query}` : ""}`;
};

const run = async () => {
  const connectionString = process.env.MONGODB_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error("MONGODB_CONNECTION_STRING is not set");
  }

  const sourceConnection = await mongoose.createConnection(withDatabaseName(connectionString, SOURCE_DB)).asPromise();
  const targetConnection = await mongoose.createConnection(withDatabaseName(connectionString, TARGET_DB)).asPromise();

  try {
    for (const collectionName of FOUNDATION_COLLECTIONS) {
      const sourceCollection = sourceConnection.db.collection(collectionName);
      const targetCollection = targetConnection.db.collection(collectionName);
      const documents = await sourceCollection.find({}).toArray();

      await targetCollection.deleteMany({});
      if (documents.length > 0) {
        await targetCollection.insertMany(documents);
      }

      console.log(`[BOOTSTRAP] Copied ${documents.length} documents into ${collectionName}`);
    }

    for (const collectionName of EMPTY_COLLECTIONS) {
      const targetCollection = targetConnection.db.collection(collectionName);
      const result = await targetCollection.deleteMany({});
      console.log(`[BOOTSTRAP] Cleared ${result.deletedCount || 0} documents from ${collectionName}`);
    }

    console.log(
      JSON.stringify(
        {
          sourceDatabase: SOURCE_DB,
          targetDatabase: TARGET_DB,
          copiedCollections: FOUNDATION_COLLECTIONS,
          clearedCollections: EMPTY_COLLECTIONS,
        },
        null,
        2
      )
    );
  } finally {
    await sourceConnection.close();
    await targetConnection.close();
  }
};

run().catch((error) => {
  console.error("Bootstrap PalazzoPinto_DB failed:", error);
  process.exit(1);
});
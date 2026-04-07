import mongoose from "mongoose";
import User from "../models/user";
import { recordAuditEvent } from "../lib/audit-log";
import { AppRole, isAppRole, normalizeEmail } from "../lib/user-role";

const [, , emailArg, roleArg, actorEmailArg] = process.argv;

const usage =
  "Usage: ts-node src/scripts/set-user-role.ts <user-email> <user|hotel_owner|admin> [actor-email]";

const run = async () => {
  const connectionString = process.env.MONGODB_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error("MONGODB_CONNECTION_STRING is required");
  }

  if (!emailArg || !roleArg) {
    throw new Error(usage);
  }

  const email = normalizeEmail(emailArg);
  const role = roleArg as AppRole;
  if (!isAppRole(role)) {
    throw new Error(usage);
  }

  await mongoose.connect(connectionString);

  try {
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error(`User not found for email: ${email}`);
    }

    const previousRole = user.role || "user";
    user.role = role;
    await user.save();

    await recordAuditEvent({
      action: "user.role.assigned",
      entityType: "user",
      entityId: String(user._id),
      targetUserId: String(user._id),
      actorEmail: actorEmailArg ? normalizeEmail(actorEmailArg) : "manual-script",
      actorRole: role,
      metadata: {
        previousRole,
        nextRole: role,
        reason: "manual-role-assignment-script",
      },
    });

    console.log(
      JSON.stringify(
        {
          action: "set-user-role",
          email,
          previousRole,
          nextRole: role,
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
  console.error("set-user-role failed", error);
  process.exit(1);
});
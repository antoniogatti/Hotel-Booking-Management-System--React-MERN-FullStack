import crypto from "node:crypto";
import mongoose from "mongoose";
import User from "../models/user";
import { AppRole, isAppRole, normalizeEmail } from "../lib/user-role";

const [, , emailArg, roleArg, firstNameArg, lastNameArg] = process.argv;

const usage =
  "Usage: ts-node src/scripts/ensure-user-role.ts <user-email> <user|hotel_owner|admin> [first-name] [last-name]";

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
    let user = await User.findOne({ email });

    if (!user) {
      user = new User({
        email,
        firstName: firstNameArg || "Palazzo",
        lastName: lastNameArg || "Pinto",
        password: crypto.randomBytes(32).toString("hex"),
        emailVerified: true,
        role,
      });
    } else {
      user.role = role;
      if (!user.firstName) {
        user.firstName = firstNameArg || "Palazzo";
      }
      if (!user.lastName) {
        user.lastName = lastNameArg || "Pinto";
      }
      user.emailVerified = true;
    }

    await user.save();

    console.log(
      JSON.stringify(
        {
          action: "ensure-user-role",
          email,
          role,
          userId: String(user._id),
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
  console.error("ensure-user-role failed", error);
  process.exit(1);
});
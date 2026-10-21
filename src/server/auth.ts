import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";

import { getDatabasePool } from "./database.js";

const secret = process.env.BETTER_AUTH_SECRET;
if (!secret) {
  throw new Error("BETTER_AUTH_SECRET must be configured for the backend.");
}

export const auth = betterAuth({
  appName: "TVC Scoreboard",
  baseURL: process.env.BETTER_AUTH_URL,
  secret,
  database: getDatabasePool(),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 12,
  },
  plugins: [
    admin({
      defaultRole: "user",
      adminRoles: ["admin"],
    }),
  ],
});

import { createHash, randomBytes } from "node:crypto";

/** 256-bit random token, safe to put in a URL or cookie. */
export const newToken = (): string => randomBytes(32).toString("base64url");

/** Only this hash is stored, so a database leak does not reveal usable tokens. */
export const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

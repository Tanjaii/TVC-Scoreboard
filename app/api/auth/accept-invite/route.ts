import { acceptInvite } from "@/lib/api/auth";

export const POST = (req: Request) => acceptInvite(req);

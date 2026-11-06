import { logout } from "@/lib/api/auth";

export const POST = (req: Request) => logout(req);

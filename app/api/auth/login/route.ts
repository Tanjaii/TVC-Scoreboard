import { login } from "@/lib/api/auth";

export const POST = (req: Request) => login(req);

import { create, list } from "@/lib/api/matches";

export const dynamic = "force-dynamic";
export const GET = (req: Request) => list(req);
export const POST = (req: Request) => create(req);

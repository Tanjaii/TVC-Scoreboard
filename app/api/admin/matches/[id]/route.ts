import { get, remove, save } from "@/lib/api/matches";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";
export const GET = async (req: Request, { params }: Ctx) => get(req, (await params).id);
export const PUT = async (req: Request, { params }: Ctx) => save(req, (await params).id);
export const DELETE = async (req: Request, { params }: Ctx) => remove(req, (await params).id);

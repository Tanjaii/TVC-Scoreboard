import { remove, update } from "@/lib/api/teams";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = async (req: Request, { params }: Ctx) => update(req, (await params).id);
export const DELETE = async (req: Request, { params }: Ctx) => remove(req, (await params).id);

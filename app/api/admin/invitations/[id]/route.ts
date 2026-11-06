import { revoke } from "@/lib/api/invitations";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = async (req: Request, { params }: Ctx) => revoke(req, (await params).id);

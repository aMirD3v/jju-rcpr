import { NextResponse } from "next/server";
import { getActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const actor = await getActor();
  if (!actor || actor.role !== "ADMIN") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const rawPage = Number(params.get("page") ?? 1);
  const page = Number.isInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, 100_000) : 1;
  const q = params.get("q")?.trim().slice(0, 120) ?? "";
  const action = params.get("action")?.trim().slice(0, 120) ?? "";
  const resourceType = params.get("resourceType")?.trim().slice(0, 120) ?? "";
  const where = {
    ...(action ? { action: { contains: action, mode: "insensitive" as const } } : {}),
    ...(resourceType ? { resourceType: { contains: resourceType, mode: "insensitive" as const } } : {}),
    ...(q ? { OR: [
      { action: { contains: q, mode: "insensitive" as const } },
      { resourceType: { contains: q, mode: "insensitive" as const } },
      { resourceId: { contains: q, mode: "insensitive" as const } },
      { actor: { name: { contains: q, mode: "insensitive" as const } } },
      { actor: { email: { contains: q, mode: "insensitive" as const } } },
    ] } : {}),
  };
  const [total, items] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, select: { id: true, action: true, resourceType: true, resourceId: true, detail: true, createdAt: true, actor: { select: { id: true, name: true, email: true, role: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * 30, take: 30 }),
  ]);
  return NextResponse.json({ items, total, page, pageSize: 30 }, { headers: { "Cache-Control": "no-store" } });
}

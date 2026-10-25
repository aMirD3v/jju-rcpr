import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getActor } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { isSameOrigin } from "@/lib/security";

const createAccount = z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(254), institution: z.string().trim().min(2).max(180), role: z.enum(["ADMIN", "COORDINATOR", "REVIEWER"]) });
const roles = ["ADMIN", "COORDINATOR", "REVIEWER", "RESEARCHER"] as const;

export async function GET(request: Request) {
  const actor = await getActor();
  if (!actor || actor.role !== "ADMIN") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const rawPage = Number(params.get("page") ?? 1);
  const page = Number.isInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, 100_000) : 1;
  const q = params.get("q")?.trim().slice(0, 120) ?? "";
  const rawRole = params.get("role") ?? "";
  if (rawRole && !roles.includes(rawRole as (typeof roles)[number])) return NextResponse.json({ error: "Unknown account role." }, { status: 400 });
  const where = { ...(rawRole ? { role: rawRole as (typeof roles)[number] } : {}), ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { email: { contains: q, mode: "insensitive" as const } }, { institution: { contains: q, mode: "insensitive" as const } }] } : {}) };
  const [total, items] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, select: { id: true, name: true, email: true, role: true, institution: true, isActive: true, emailVerifiedAt: true, createdAt: true }, orderBy: [{ role: "asc" }, { name: "asc" }], skip: (page - 1) * 20, take: 20 }),
  ]);
  return NextResponse.json({ items, total, page, pageSize: 20 }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const actor = await getActor();
  if (!actor || actor.role !== "ADMIN") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const parsed = createAccount.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid name, email, institution, and staff role." }, { status: 400 });
  const email = parsed.data.email.toLowerCase();
  const temporaryPassword = randomBytes(18).toString("base64url");
  const passwordHash = await hashPassword(temporaryPassword);
  try {
    const account = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({ data: { ...parsed.data, email, role: parsed.data.role, emailVerifiedAt: new Date(), passwordHash, passwordResetRequired: true }, select: { id: true, name: true, email: true, role: true, institution: true, isActive: true, emailVerifiedAt: true, createdAt: true } });
      await tx.auditLog.create({ data: { actorId: actor.id, action: "ADMIN_ACCOUNT_CREATED", resourceType: "User", resourceId: created.id, detail: { role: created.role } } });
      return created;
    });
    return NextResponse.json({ account, temporaryPassword }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    throw error;
  }
}

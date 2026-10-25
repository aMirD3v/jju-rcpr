import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { sendVerificationEmail } from "@/lib/email";
import { isSameOrigin } from "@/lib/security";

const registrationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  institution: z.string().trim().min(2).max(180),
  password: z.string().min(12).max(200).regex(/[A-Za-z]/).regex(/[0-9]/),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  try {
    const parsed = registrationSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Enter a valid name, institutional affiliation, email, and password (at least 12 characters with a letter and number)." }, { status: 400 });
    const data = parsed.data;
    const email = data.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    const token = randomBytes(32).toString("base64url");
    const passwordHash = await hashPassword(data.password);
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({ data: { name: data.name, email, institution: data.institution, passwordHash, role: "RESEARCHER", verificationTokenHash: createHash("sha256").update(token).digest("hex"), verificationTokenExpiry: new Date(Date.now() + 60 * 60 * 1000) }, select: { id: true, name: true, email: true } });
      await tx.auditLog.create({ data: { actorId: created.id, action: "RESEARCHER_REGISTERED", resourceType: "User", resourceId: created.id } });
      return created;
    });
    const sent = await sendVerificationEmail(user.email, user.name, token);
    if (!sent) return NextResponse.json({ created: true, verificationSent: false, message: "Account created. Email delivery is unavailable; the research office must verify your account before sign-in." }, { status: 201 });
    return NextResponse.json({ created: true, verificationSent: true, message: "Check your email for a verification link. It expires in one hour." }, { status: 201 });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
      ? error.code
      : undefined;
    console.error("Researcher registration failed", {
      name: error instanceof Error ? error.name : "unknown",
      code,
    });
    if (code === "P1001" || code === "P1002" || code === "P1017") {
      return NextResponse.json({ error: "The JJU-RCPR database is not reachable. Start PostgreSQL and try again." }, { status: 503 });
    }
    if (code === "P2021" || code === "P2022") {
      return NextResponse.json({ error: "The JJU-RCPR database schema is not ready. Apply migrations with npm run db:deploy, then try again." }, { status: 503 });
    }
    if (code === "P2002") {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: "Unable to create the account. Please try again." }, { status: 500 });
  }
}

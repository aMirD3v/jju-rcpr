import { NextResponse } from "next/server";
import { z } from "zod";
import { resendVerification } from "@/lib/email";
import { isSameOrigin } from "@/lib/security";
const input = z.object({ email: z.string().email().max(254) });
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const parsed = input.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  await resendVerification(parsed.data.email);
  return NextResponse.json({ message: "If the account needs verification and email delivery is configured, a new link will be sent." });
}

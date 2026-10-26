import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyCredentials } from "@/lib/credentials";
import { isSameOrigin } from "@/lib/security";

const input = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: "Request origin is not allowed." },
      { status: 403 },
    );
  }
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Email and password did not match an active, verified account." },
      { status: 401 },
    );
  }
  const result = await verifyCredentials(
    parsed.data.email,
    parsed.data.password,
  );
  if (result.status !== "VALID") {
    return NextResponse.json(
      { error: "Email and password did not match an active, verified account." },
      { status: 401 },
    );
  }
  return NextResponse.json(
    { mfaRequired: result.user.mfaEnabled },
    { headers: { "Cache-Control": "no-store" } },
  );
}

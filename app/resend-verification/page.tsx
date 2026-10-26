import { Suspense } from "react";
import { PageIntro } from "@/components/site/page-intro";
import { PageLoading } from "@/components/site/page-loading";
import { ResendVerificationForm } from "@/components/auth/resend-verification-form";
export const metadata = { title: "Resend verification" };
export default function ResendPage(props: { searchParams: Promise<{ email?: string | string[] }> }) { return <Suspense fallback={<PageLoading label="Loading account verification…" />}><ResendVerificationContent {...props} /></Suspense>; }
async function ResendVerificationContent({ searchParams }: { searchParams: Promise<{ email?: string | string[] }> }) { const query = await searchParams; const email = typeof query.email === "string" ? query.email : ""; return <main className="shell content-page auth-page"><PageIntro eyebrow="Account security" title="Resend verification">Enter your account email. If verification is pending, we will send a new link.</PageIntro><section className="form-shell auth-shell"><ResendVerificationForm initialEmail={email} /></section></main>; }

import { Suspense } from "react";
import { PageIntro } from "@/components/site/page-intro";
import { PageLoading } from "@/components/site/page-loading";
import { PasswordResetConfirmForm } from "@/components/auth/password-reset-forms";
export const metadata = { title: "Set a new password" };
export default function ResetPasswordPage(props: { searchParams: Promise<{ token?: string | string[] }> }) { return <Suspense fallback={<PageLoading label="Loading password reset…" />}><ResetPasswordContent {...props} /></Suspense>; }
async function ResetPasswordContent({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) { const query = await searchParams; const token = typeof query.token === "string" ? query.token : ""; return <main className="shell content-page auth-page"><PageIntro eyebrow="Account recovery" title="Choose a new password">Reset links expire after one hour and can only be used once.</PageIntro><section className="form-shell auth-shell"><PasswordResetConfirmForm token={token} /></section></main>; }

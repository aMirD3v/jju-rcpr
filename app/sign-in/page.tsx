import { Suspense } from "react";
import Link from "next/link";
import { PageIntro } from "@/components/site/page-intro";
import { PageLoading } from "@/components/site/page-loading";
import { SignInForm } from "@/components/auth/sign-in-form";
export const metadata = { title: "Sign in" };
export default function SignInPage(props: { searchParams: Promise<{ callbackUrl?: string | string[] }> }) { return <Suspense fallback={<PageLoading label="Preparing secure sign in…" />}><SignInPageContent {...props} /></Suspense>; }
async function SignInPageContent({ searchParams }: { searchParams: Promise<{ callbackUrl?: string | string[] }> }) { const query = await searchParams; const callbackUrl = typeof query.callbackUrl === "string" ? query.callbackUrl : ""; const ssoEnabled = Boolean(process.env.SSO_ISSUER_URL && process.env.SSO_CLIENT_ID && process.env.SSO_CLIENT_SECRET); return <main className="shell content-page auth-page"><PageIntro eyebrow="Secure access" title="Sign in to JJU-RCPR">Access your research record, review assignments, or coordinator workspace.</PageIntro><section className="form-shell auth-shell"><SignInForm callbackUrl={callbackUrl} ssoEnabled={ssoEnabled} /><p className="auth-note"><Link href="/forgot-password">Forgot your password?</Link> · <Link href="/resend-verification">Resend email verification</Link></p><p className="auth-note">New guest researcher? <Link href="/register">Create an account</Link></p></section></main>; }

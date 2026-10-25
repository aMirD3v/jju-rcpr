import { PageIntro } from "@/components/site/page-intro";
import { PasswordResetConfirmForm } from "@/components/auth/password-reset-forms";
export const metadata = { title: "Set a new password" };
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) { const query = await searchParams; const token = typeof query.token === "string" ? query.token : ""; return <main className="shell content-page auth-page"><PageIntro eyebrow="Account recovery" title="Choose a new password">Reset links expire after one hour and can only be used once.</PageIntro><section className="form-shell auth-shell"><PasswordResetConfirmForm token={token} /></section></main>; }

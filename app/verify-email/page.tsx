import { PageIntro } from "@/components/site/page-intro";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";
export const metadata = { title: "Verify email" };
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const query = await searchParams;
  const token = typeof query.token === "string" ? query.token : "";
  return <main className="shell content-page auth-page"><PageIntro eyebrow="Account security" title="Verify your email address">Email verification protects your submission record and ensures important decisions reach the right researcher.</PageIntro><VerifyEmailForm token={token} /></main>;
}

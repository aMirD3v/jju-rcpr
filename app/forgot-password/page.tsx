import { PageIntro } from "@/components/site/page-intro";
import { PasswordResetRequestForm } from "@/components/auth/password-reset-forms";
export const metadata = { title: "Recover account" };
export default function ForgotPasswordPage() { return <main className="shell content-page auth-page"><PageIntro eyebrow="Account recovery" title="Reset your password">We will email a single-use recovery link if the address belongs to a verified account.</PageIntro><section className="form-shell auth-shell"><PasswordResetRequestForm /></section></main>; }

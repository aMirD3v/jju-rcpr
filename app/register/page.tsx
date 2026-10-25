import Link from "next/link";
import { PageIntro } from "@/components/site/page-intro";
import { RegisterForm } from "@/components/auth/register-form";
export const metadata = { title: "Researcher registration" };
export default function RegisterPage() { return <main className="shell content-page auth-page"><PageIntro eyebrow="Guest researcher account" title="Create your researcher account">Use an email address you can access. It will be used to protect and retrieve your submission history.</PageIntro><section className="form-shell auth-shell"><RegisterForm /><p className="auth-note">Already registered? <Link href="/sign-in">Sign in</Link></p></section></main>; }

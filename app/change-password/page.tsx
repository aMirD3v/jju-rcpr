import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getPasswordChangeActor } from "@/lib/auth";
import { PageIntro } from "@/components/site/page-intro";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { PageLoading } from "@/components/site/page-loading";
export const metadata = { title: "Change password" };
export default function ChangePasswordPage() { return <Suspense fallback={<PageLoading label="Checking account security…" />}><ChangePasswordContent /></Suspense>; }
async function ChangePasswordContent() { const actor = await getPasswordChangeActor(); if (!actor) redirect("/sign-in"); if (!actor.passwordResetRequired) redirect(actor.role === "ADMIN" ? "/admin" : actor.role === "COORDINATOR" ? "/coordinator" : actor.role === "REVIEWER" ? "/reviewer" : "/portal"); return <main className="shell content-page auth-page"><PageIntro eyebrow="Account security" title="Set a private password">For your security, change the temporary password before opening your workspace.</PageIntro><section className="form-shell auth-shell"><ChangePasswordForm /></section></main>; }

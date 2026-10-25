import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

function siteUrl() {
  return (process.env.NEXTAUTH_URL || process.env.AUTH_URL || "http://localhost:3000").replace(/\/+$/, "");
}

export async function sendMail(to: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) return false;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + process.env.RESEND_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM || "JJU-RCPR <noreply@jju.edu.et>", to, subject, html }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function escapeHtml(value: string) {
  const substitutions: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return value.replace(/[&<>"']/g, (character) => substitutions[character]);
}

export async function sendVerificationEmail(email: string, name: string, token: string) {
  const url = siteUrl() + "/verify-email?token=" + encodeURIComponent(token);
  const html = `<p>Hello ${escapeHtml(name)},</p><p>Confirm your email address to activate your Jigjiga University Research Call &amp; Peer Review System account.</p><p><a href="${url}">Verify email address</a></p><p>This link expires in one hour. If you did not create this account, ignore this message.</p>`;
  return sendMail(email, "Verify your JJU-RCPR account", html);
}

export async function sendPasswordResetEmail(email: string, name: string, token: string) {
  const url = siteUrl() + "/reset-password?token=" + encodeURIComponent(token);
  const html = `<p>Hello ${escapeHtml(name)},</p><p>A password reset was requested for your JJU-RCPR account. Use the secure link below to choose a new password.</p><p><a href="${url}">Reset password</a></p><p>This single-use link expires in one hour. If you did not request this, you can ignore this message.</p>`;
  return sendMail(email, "Reset your JJU-RCPR password", html);
}

export async function sendUserNotification(userId: string, title: string, body: string, link?: string) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
    if (!user?.email) return false;
    const target = link ? siteUrl() + link : siteUrl();
    const html = `<p>Hello ${escapeHtml(user.name)},</p><p>${escapeHtml(body)}</p><p><a href="${target}">Open your JJU-RCPR workspace</a></p>`;
    return await sendMail(user.email, "[JJU-RCPR] " + title, html);
  } catch {
    return false;
  }
}

export async function resendVerification(emailInput: string) {
  const email = emailInput.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.emailVerifiedAt) return;
  const token = randomBytes(32).toString("base64url");
  await prisma.user.update({ where: { id: user.id }, data: { verificationTokenHash: createHash("sha256").update(token).digest("hex"), verificationTokenExpiry: new Date(Date.now() + 60 * 60 * 1000) } });
  await sendVerificationEmail(email, user.name, token);
}

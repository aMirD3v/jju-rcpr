import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { OAuthConfig } from "next-auth/providers/oauth";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

const providers: NextAuthOptions["providers"] = [CredentialsProvider({
    name: "University account",
    credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" }, totpCode: { label: "Authenticator code", type: "text" } },
    async authorize(credentials) {
      const parsed = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(200), totpCode: z.string().optional() }).safeParse(credentials);
      if (!parsed.success) return null;
      const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
      if (!user?.passwordHash || !user.emailVerifiedAt || !user.isActive) return null;
      if (user.lockoutUntil && user.lockoutUntil > new Date()) return null;
      if (!(await verifyPassword(parsed.data.password, user.passwordHash))) {
        const failedLoginAttempts = user.failedLoginAttempts + 1;
        await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts, lockoutUntil: failedLoginAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null } });
        return null;
      }
      if (user.mfaEnabled) {
        const { verifyTotp, consumeRecoveryCode } = await import("@/lib/mfa");
        const code = parsed.data.totpCode ?? "";
        let valid = false;
        try { valid = user.mfaSecretEncrypted ? verifyTotp(user.mfaSecretEncrypted, code) : false; } catch { return null; }
        if (!valid && !(await consumeRecoveryCode(user.id, code))) {
          const failedLoginAttempts = user.failedLoginAttempts + 1;
          await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts, lockoutUntil: failedLoginAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null } });
          return null;
        }
      }
      if (user.failedLoginAttempts || user.lockoutUntil) await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockoutUntil: null } });
      return { id: user.id, email: user.email, name: user.name, role: user.role, institution: user.institution, passwordResetRequired: user.passwordResetRequired, sessionVersion: user.sessionVersion };
    },
  })];
if (process.env.SSO_ISSUER_URL && process.env.SSO_CLIENT_ID && process.env.SSO_CLIENT_SECRET) providers.push({
  id: "institutional", name: process.env.SSO_PROVIDER_NAME || "University single sign-on", type: "oauth",
  wellKnown: `${process.env.SSO_ISSUER_URL.replace(/\/$/, "")}/.well-known/openid-configuration`, clientId: process.env.SSO_CLIENT_ID, clientSecret: process.env.SSO_CLIENT_SECRET,
  idToken: true, checks: ["pkce", "state", "nonce"], authorization: { params: { scope: "openid email profile" } },
  profile(profile: { sub: string; name?: string; email?: string; email_verified?: boolean; amr?: string[] }) { return { id: String(profile.sub), name: String(profile.name ?? profile.email ?? "JJU staff"), email: String(profile.email ?? ""), emailVerified: profile.email_verified, role: "RESEARCHER", sessionVersion: 0, amr: profile.amr }; },
} as OAuthConfig<{ sub: string; name?: string; email?: string; amr?: string[] }>);

export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { signIn: "/sign-in" },
  providers,
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "institutional") return true;
      const email = user.email?.toLowerCase();
      if (!email || (profile as { emailVerified?: boolean } | undefined)?.emailVerified !== true) return false;
      const existing = await prisma.user.findUnique({ where: { email } });
      if (!existing || !existing.isActive || !existing.emailVerifiedAt || !["ADMIN", "COORDINATOR", "REVIEWER"].includes(existing.role)) return false;
      if (existing.mfaEnabled) {
        const required = (process.env.SSO_REQUIRED_MFA_AMR ?? "").split(",").map((item) => item.trim()).filter(Boolean);
        const claims = profile as { amr?: string[] } | undefined;
        if (required.length === 0 || !claims?.amr?.some((method) => required.includes(method))) return false;
      }
      Object.assign(user, { id: existing.id, role: existing.role, institution: existing.institution, passwordResetRequired: existing.passwordResetRequired, sessionVersion: existing.sessionVersion });
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = (user as typeof user & { role: string }).role;
        token.passwordResetRequired = Boolean((user as typeof user & { passwordResetRequired?: boolean }).passwordResetRequired);
        token.institution = (user as typeof user & { institution?: string | null }).institution;
        token.sessionVersion = Number((user as typeof user & { sessionVersion?: number }).sessionVersion ?? 0);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as typeof session.user & { id: string; role: string }).id = token.sub;
        (session.user as typeof session.user & { id: string; role: string }).role = String(token.role ?? "RESEARCHER");
        (session.user as typeof session.user & { passwordResetRequired?: boolean }).passwordResetRequired = Boolean(token.passwordResetRequired);
        (session.user as typeof session.user & { institution?: string | null }).institution = typeof token.institution === "string" ? token.institution : null;
        (session.user as typeof session.user & { sessionVersion?: number }).sessionVersion = Number(token.sessionVersion ?? 0);
      }
      return session;
    },
  },
};

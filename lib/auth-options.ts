import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { signIn: "/sign-in" },
  providers: [CredentialsProvider({
    name: "University account",
    credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
    async authorize(credentials) {
      const parsed = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(200) }).safeParse(credentials);
      if (!parsed.success) return null;
      const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
      if (!user?.passwordHash || !user.emailVerifiedAt || !user.isActive) return null;
      if (user.lockoutUntil && user.lockoutUntil > new Date()) return null;
      if (!(await verifyPassword(parsed.data.password, user.passwordHash))) {
        const failedLoginAttempts = user.failedLoginAttempts + 1;
        await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts, lockoutUntil: failedLoginAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null } });
        return null;
      }
      if (user.failedLoginAttempts || user.lockoutUntil) await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockoutUntil: null } });
      return { id: user.id, email: user.email, name: user.name, role: user.role, institution: user.institution, passwordResetRequired: user.passwordResetRequired, sessionVersion: user.sessionVersion };
    },
  })],
  callbacks: {
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

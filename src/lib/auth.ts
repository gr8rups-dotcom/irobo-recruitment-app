import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import LinkedInProvider from "next-auth/providers/linkedin";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

// NOTE on LinkedIn: LinkedIn retired its old OAuth2 scopes in 2023 in favor of
// "Sign In with LinkedIn using OpenID Connect". This config targets that
// product specifically — you must request THAT product (not the old one) in
// your LinkedIn Developer App. See DEPLOYMENT.md for the exact setup steps.
// LinkedIn login only appears on the sign-in page if these env vars are set —
// it's entirely optional, email+password works standalone.
export const authOptions: NextAuthOptions = {
  providers: [
    LinkedInProvider({
      clientId: process.env.LINKEDIN_CLIENT_ID || "",
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET || "",
      issuer: "https://www.linkedin.com/oauth",
      authorization: {
        url: "https://www.linkedin.com/oauth/v2/authorization",
        params: { scope: "openid profile email" },
      },
      token: "https://www.linkedin.com/oauth/v2/accessToken",
      userinfo: "https://api.linkedin.com/v2/userinfo",
      jwks_endpoint: "https://www.linkedin.com/oauth/openid/jwks",
      client: { token_endpoint_auth_method: "client_secret_post" },
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
        };
      },
    }),
    // Real email+password accounts. Every user gets their own row in the
    // User table and their own Profile/Jobs — this replaced an earlier
    // "type any name/email, no verification" version that was fine for a
    // single-person local prototype but would let anyone impersonate anyone
    // else's account once this app is reachable by the public.
    CredentialsProvider({
      id: "credentials",
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, name: user.name, email: user.email, image: user.image };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    // LinkedIn sign-ins don't go through authorize() above, so there's no
    // guarantee a matching User row exists yet. Create one on first login,
    // keyed by email, so every authenticated session — from either provider
    // — always maps to a real userId that Profile/Job rows can reference.
    async jwt({ token, user, account }) {
      if (user?.email) {
        const email = user.email.toLowerCase();
        const dbUser = await prisma.user.upsert({
          where: { email },
          update: account?.provider === "linkedin" ? { name: user.name, image: user.image ?? undefined } : {},
          create: { email, name: user.name, image: user.image ?? undefined },
        });
        token.userId = dbUser.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.userId) {
        session.user.id = token.userId;
      }
      return session;
    },
  },
};

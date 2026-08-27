import "next-auth";
import "next-auth/jwt";

// Augments NextAuth's built-in types so `session.user.id` and `token.userId`
// (our own DB user id, set in the jwt/session callbacks in src/lib/auth.ts)
// are recognized by TypeScript everywhere a session or token is used.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
  }
}

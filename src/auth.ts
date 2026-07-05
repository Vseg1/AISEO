import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  accounts,
  sessions,
  users,
  verificationTokens,
} from "../drizzle/schema";

export const authProviders = {
  google: Boolean(
    process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
  ),
  resend: Boolean(process.env.RESEND_API_KEY),
  dev: process.env.NODE_ENV === "development",
};

const providers: NextAuthConfig["providers"] = [];

if (authProviders.google) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  );
}

if (authProviders.resend) {
  providers.push(
    Resend({
      apiKey: process.env.RESEND_API_KEY!,
      from: process.env.EMAIL_FROM ?? "onboarding@resend.dev",
    }),
  );
}

if (authProviders.dev) {
  providers.push(
    Credentials({
      id: "credentials",
      name: "Dev",
      credentials: {
        email: { label: "Email", type: "email" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string;
        if (!email?.includes("@")) return null;

        if (!process.env.DATABASE_URL) {
          return {
            id: email,
            email,
            name: email.split("@")[0],
          };
        }

        const db = getDb();
        const existing = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (existing[0]) {
          return {
            id: existing[0].id,
            email: existing[0].email!,
            name: existing[0].name ?? email.split("@")[0],
          };
        }

        const [created] = await db
          .insert(users)
          .values({ email, name: email.split("@")[0] })
          .returning();

        return {
          id: created.id,
          email: created.email!,
          name: created.name ?? email.split("@")[0],
        };
      },
    }),
  );
}

// ponytail: Credentials exige JWT — pas de session DB même si OAuth est configuré
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: process.env.DATABASE_URL
    ? DrizzleAdapter(getDb(), {
        usersTable: users,
        accountsTable: accounts,
        sessionsTable: sessions,
        verificationTokensTable: verificationTokens,
      })
    : undefined,
  providers,
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  trustHost: true,
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});

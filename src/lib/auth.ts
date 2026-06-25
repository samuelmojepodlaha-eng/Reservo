import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Heslo", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const restaurant = await prisma.restaurant.findUnique({
          where: { email: credentials.email },
        });

        if (!restaurant) return null;

        const valid = await compare(credentials.password, restaurant.password);
        if (!valid) return null;

        return {
          id: restaurant.id,
          email: restaurant.email,
          name: restaurant.name,
          slug: restaurant.slug,
        } as { id: string; email: string; name: string; slug: string };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.slug = (user as { id: string; slug: string }).slug;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.slug = token.slug;
      return session;
    },
  },
};

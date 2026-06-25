import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      slug: string;
      name?: string | null;
      email?: string | null;
    };
  }

  interface User {
    id: string;
    slug: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    slug: string;
  }
}

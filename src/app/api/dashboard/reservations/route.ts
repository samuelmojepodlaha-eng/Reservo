import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neprihlásený" }, { status: 401 });
  }

  const reservations = await prisma.reservation.findMany({
    where: { restaurantId: session.user.id },
    orderBy: { date: "asc" },
    include: {
      table: { select: { name: true } },
    },
  });

  return NextResponse.json(reservations);
}

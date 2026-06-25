import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      address: true,
      depositAmount: true,
      cancellationHours: true,
      tables: {
        where: { isActive: true },
        select: { id: true, name: true, capacity: true },
      },
    },
  });

  if (!restaurant) {
    return NextResponse.json({ error: "Nenájdené" }, { status: 404 });
  }

  return NextResponse.json(restaurant);
}

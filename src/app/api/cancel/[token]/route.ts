import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cancelPayment } from "@/lib/stripe";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const reservation = await prisma.reservation.findUnique({
    where: { cancelToken: token },
    include: { restaurant: true, table: true },
  });

  if (!reservation) {
    return NextResponse.json({ error: "Rezervácia nenájdená" }, { status: 404 });
  }

  return NextResponse.json({
    id: reservation.id,
    status: reservation.status,
    customerName: reservation.customerName,
    restaurantName: reservation.restaurant.name,
    date: reservation.date,
    timeFrom: reservation.timeFrom,
    timeTo: reservation.timeTo,
    tableName: reservation.table.name,
    depositCzk: reservation.restaurant.depositAmount / 100,
    cancellationHours: reservation.restaurant.cancellationHours,
  });
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const reservation = await prisma.reservation.findUnique({
    where: { cancelToken: token },
    include: { restaurant: true },
  });

  if (!reservation) {
    return NextResponse.json({ error: "Rezervácia nenájdená" }, { status: 404 });
  }

  if (reservation.status === "CANCELLED") {
    return NextResponse.json({ error: "Rezervácia je už zrušená" }, { status: 400 });
  }

  if (reservation.status !== "PENDING" && reservation.status !== "CONFIRMED") {
    return NextResponse.json({ error: "Rezerváciu nie je možné zrušiť" }, { status: 400 });
  }

  // Kontrola storno lehoty
  const reservationTime = new Date(reservation.date);
  const hoursUntil = (reservationTime.getTime() - Date.now()) / (1000 * 60 * 60);

  if (hoursUntil < reservation.restaurant.cancellationHours) {
    return NextResponse.json({
      error: `Storno je možné najneskôr ${reservation.restaurant.cancellationHours}h pred rezerváciou`,
    }, { status: 400 });
  }

  if (reservation.stripePaymentIntentId && reservation.paymentStatus === "HELD") {
    await cancelPayment(reservation.stripePaymentIntentId).catch(console.error);
  }

  await prisma.reservation.update({
    where: { id: reservation.id },
    data: { status: "CANCELLED", paymentStatus: "RELEASED" },
  });

  return NextResponse.json({ success: true });
}

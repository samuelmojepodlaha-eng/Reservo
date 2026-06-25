import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPaymentHold } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    restaurantSlug,
    tableId,
    customerName,
    customerEmail,
    customerPhone,
    partySize,
    date,
    timeFrom,
    timeTo,
    note,
  } = body;

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: restaurantSlug },
  });

  if (!restaurant) {
    return NextResponse.json({ error: "Reštaurácia nenájdená" }, { status: 404 });
  }

  const paymentIntent = await createPaymentHold({
    amount: restaurant.depositAmount,
    customerEmail,
    restaurantName: restaurant.name,
    reservationDate: `${date} ${timeFrom}`,
  });

  const reservation = await prisma.reservation.create({
    data: {
      restaurantId: restaurant.id,
      tableId,
      customerName,
      customerEmail,
      customerPhone,
      partySize: parseInt(partySize),
      date: new Date(date),
      timeFrom,
      timeTo,
      note,
      status: "PENDING",
      stripePaymentIntentId: paymentIntent.id,
      paymentStatus: "HELD",
    },
  });

  return NextResponse.json({
    reservationId: reservation.id,
    clientSecret: paymentIntent.client_secret,
  });
}

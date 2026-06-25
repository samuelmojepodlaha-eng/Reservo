import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { sendConfirmationEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Webhook error" }, { status: 400 });
  }

  if (event.type === "payment_intent.amount_capturable_updated") {
    const pi = event.data.object;
    const reservation = await prisma.reservation.findFirst({
      where: { stripePaymentIntentId: pi.id, status: "PENDING" },
      include: {
        restaurant: true,
        table: true,
      },
    });

    if (reservation) {
      await prisma.reservation.update({
        where: { id: reservation.id },
        data: { status: "CONFIRMED" },
      });

      if (reservation.cancelToken) {
        await sendConfirmationEmail({
          customerName: reservation.customerName,
          customerEmail: reservation.customerEmail,
          restaurantName: reservation.restaurant.name,
          restaurantAddress: reservation.restaurant.address,
          date: reservation.date.toISOString(),
          timeFrom: reservation.timeFrom,
          timeTo: reservation.timeTo,
          tableName: reservation.table.name,
          partySize: reservation.partySize,
          depositCzk: reservation.restaurant.depositAmount / 100,
          cancelToken: reservation.cancelToken,
          cancellationHours: reservation.restaurant.cancellationHours,
        }).catch(console.error);
      }
    }
  }

  if (event.type === "payment_intent.payment_failed") {
    const pi = event.data.object;
    await prisma.reservation.updateMany({
      where: { stripePaymentIntentId: pi.id },
      data: { status: "CANCELLED", paymentStatus: "RELEASED" },
    });
  }

  return NextResponse.json({ received: true });
}

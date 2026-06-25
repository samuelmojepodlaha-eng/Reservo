import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Webhook error" }, { status: 400 });
  }

  // Zákazník úspešne autorizoval kartu — blokácia aktívna
  if (event.type === "payment_intent.amount_capturable_updated") {
    const pi = event.data.object;
    await prisma.reservation.updateMany({
      where: { stripePaymentIntentId: pi.id, status: "PENDING" },
      data: { status: "CONFIRMED" },
    });
  }

  // Platba zlyhala — zrušíme rezerváciu
  if (event.type === "payment_intent.payment_failed") {
    const pi = event.data.object;
    await prisma.reservation.updateMany({
      where: { stripePaymentIntentId: pi.id },
      data: { status: "CANCELLED", paymentStatus: "RELEASED" },
    });
  }

  return NextResponse.json({ received: true });
}

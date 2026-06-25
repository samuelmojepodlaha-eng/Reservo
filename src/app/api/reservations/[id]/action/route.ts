import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { capturePayment, cancelPayment } from "@/lib/stripe";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { action } = await req.json();

  const reservation = await prisma.reservation.findUnique({
    where: { id },
  });

  if (!reservation || !reservation.stripePaymentIntentId) {
    return NextResponse.json({ error: "Rezervácia nenájdená" }, { status: 404 });
  }

  const isActive =
    reservation.status === "PENDING" || reservation.status === "CONFIRMED";

  if (!isActive) {
    return NextResponse.json(
      { error: "Rezervácia je už uzavretá" },
      { status: 400 }
    );
  }

  if (action === "arrived") {
    if (reservation.paymentStatus !== "HELD") {
      return NextResponse.json({ error: "Platba nie je v stave na odpočítanie" }, { status: 400 });
    }
    await capturePayment(reservation.stripePaymentIntentId);
    await prisma.reservation.update({
      where: { id },
      data: { status: "ARRIVED", paymentStatus: "CAPTURED" },
    });
    return NextResponse.json({ success: true, message: "Záloha odpočítaná od účtu" });
  }

  if (action === "noshow") {
    if (reservation.paymentStatus !== "HELD") {
      return NextResponse.json({ error: "Platba nie je v stave na odpočítanie" }, { status: 400 });
    }
    await capturePayment(reservation.stripePaymentIntentId);
    await prisma.reservation.update({
      where: { id },
      data: { status: "NO_SHOW", paymentStatus: "CAPTURED" },
    });
    return NextResponse.json({ success: true, message: "Záloha prepadla reštaurácii" });
  }

  if (action === "cancel") {
    if (reservation.paymentStatus === "HELD") {
      await cancelPayment(reservation.stripePaymentIntentId);
    }
    await prisma.reservation.update({
      where: { id },
      data: { status: "CANCELLED", paymentStatus: "RELEASED" },
    });
    return NextResponse.json({ success: true, message: "Rezervácia zrušená, záloha vrátená" });
  }

  return NextResponse.json({ error: "Neznáma akcia" }, { status: 400 });
}

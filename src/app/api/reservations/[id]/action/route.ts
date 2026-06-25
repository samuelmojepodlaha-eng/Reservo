import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { capturePayment, cancelPayment, refundPayment } from "@/lib/stripe";

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
  const isReversible =
    reservation.status === "NO_SHOW" || reservation.status === "ARRIVED";

  // Vrátenie omylom uzavretej rezervácie
  if (action === "undo") {
    if (!isReversible) {
      return NextResponse.json({ error: "Túto rezerváciu nie je možné vrátiť" }, { status: 400 });
    }
    if (reservation.paymentStatus === "CAPTURED") {
      await refundPayment(reservation.stripePaymentIntentId);
      await prisma.reservation.update({
        where: { id },
        data: { status: "CONFIRMED", paymentStatus: "REFUNDED" },
      });
      return NextResponse.json({ success: true, message: "Platba vrátená zákazníkovi, rezervácia znova otvorená" });
    } else {
      await prisma.reservation.update({
        where: { id },
        data: { status: "CONFIRMED" },
      });
      return NextResponse.json({ success: true, message: "Rezervácia znova otvorená" });
    }
  }

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
    // CONFIRMED = platba autorizovaná → môžeme capture-ovať (peniaze prepadnú)
    // PENDING = zákazník nedokončil platbu → len zrušíme rezerváciu
    if (reservation.status === "CONFIRMED" && reservation.paymentStatus === "HELD") {
      await capturePayment(reservation.stripePaymentIntentId);
      await prisma.reservation.update({
        where: { id },
        data: { status: "NO_SHOW", paymentStatus: "CAPTURED" },
      });
      return NextResponse.json({ success: true, message: "Záloha prepadla reštaurácii" });
    } else {
      await cancelPayment(reservation.stripePaymentIntentId).catch(() => null);
      await prisma.reservation.update({
        where: { id },
        data: { status: "NO_SHOW", paymentStatus: "RELEASED" },
      });
      return NextResponse.json({ success: true, message: "No-show zaznamenaný (platba nebola dokončená)" });
    }
  }

  if (action === "cancel") {
    if (reservation.paymentStatus === "HELD") {
      await cancelPayment(reservation.stripePaymentIntentId).catch(() => null);
    }
    await prisma.reservation.update({
      where: { id },
      data: { status: "CANCELLED", paymentStatus: "RELEASED" },
    });
    return NextResponse.json({ success: true, message: "Rezervácia zrušená, záloha vrátená" });
  }

  return NextResponse.json({ error: "Neznáma akcia" }, { status: 400 });
}

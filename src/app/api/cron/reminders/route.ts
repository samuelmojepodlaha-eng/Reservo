import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendReminderEmail } from "@/lib/email";

export async function GET(req: NextRequest) {
  // Ochrana — len Vercel Cron môže volať tento endpoint
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  // Rezervácie, ktoré sú o 24-25 hodín a reminder ešte nebol odoslaný
  const reservations = await prisma.reservation.findMany({
    where: {
      status: "CONFIRMED",
      reminderSent: false,
      date: { gte: in24h, lte: in25h },
    },
    include: { restaurant: true, table: true },
  });

  let sent = 0;
  for (const r of reservations) {
    if (!r.cancelToken) continue;
    try {
      await sendReminderEmail({
        customerName: r.customerName,
        customerEmail: r.customerEmail,
        restaurantName: r.restaurant.name,
        restaurantAddress: r.restaurant.address,
        date: r.date.toISOString(),
        timeFrom: r.timeFrom,
        timeTo: r.timeTo,
        tableName: r.table.name,
        partySize: r.partySize,
        depositCzk: r.restaurant.depositAmount / 100,
        cancelToken: r.cancelToken,
        cancellationHours: r.restaurant.cancellationHours,
      });
      await prisma.reservation.update({
        where: { id: r.id },
        data: { reminderSent: true },
      });
      sent++;
    } catch (err) {
      console.error(`Reminder failed for ${r.id}:`, err);
    }
  }

  return NextResponse.json({ sent, total: reservations.length });
}

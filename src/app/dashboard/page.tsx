"use client";

import { useEffect, useState } from "react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, addMonths, subMonths, isSameDay, isToday,
} from "date-fns";
import { cs } from "date-fns/locale";
import { signOut } from "next-auth/react";

type ReservationStatus = "PENDING" | "CONFIRMED" | "ARRIVED" | "NO_SHOW" | "CANCELLED";

interface Reservation {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  partySize: number;
  date: string;
  timeFrom: string;
  timeTo: string;
  status: ReservationStatus;
  paymentStatus: string;
  note: string | null;
  table: { name: string };
}

const STATUS_LABELS: Record<ReservationStatus, string> = {
  PENDING: "Čakajúca",
  CONFIRMED: "Potvrdená",
  ARRIVED: "Prišiel",
  NO_SHOW: "Neprišiel",
  CANCELLED: "Zrušená",
};

const STATUS_COLORS: Record<ReservationStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700 border border-amber-200",
  CONFIRMED: "bg-blue-50 text-blue-700 border border-blue-200",
  ARRIVED: "bg-green-50 text-green-700 border border-green-200",
  NO_SHOW: "bg-red-50 text-red-600 border border-red-200",
  CANCELLED: "bg-gray-50 text-gray-500 border border-gray-200",
};

function getDateStr(d: string) {
  return new Date(d).toLocaleDateString("sv-SE");
}

export default function DashboardPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarDay, setCalendarDay] = useState<Date | null>(null);

  const fetchReservations = async () => {
    const res = await fetch("/api/dashboard/reservations");
    const data = await res.json();
    setReservations(data);
    setLoading(false);
  };

  useEffect(() => { fetchReservations(); }, []);

  const handleAction = async (
    reservationId: string,
    action: "arrived" | "noshow" | "cancel" | "undo"
  ) => {
    setActionLoading(reservationId + action);
    setActionError(null);
    const res = await fetch(`/api/reservations/${reservationId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      const data = await res.json();
      setActionError(data.error || "Nastala chyba");
    }
    await fetchReservations();
    setActionLoading(null);
  };

  const todayStr = new Date().toLocaleDateString("sv-SE");
  const todayReservations = reservations.filter(r => getDateStr(r.date) === todayStr);
  const upcomingReservations = reservations.filter(r => getDateStr(r.date) > todayStr);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = (getDay(monthStart) + 6) % 7;

  const calendarDayReservations = calendarDay
    ? reservations.filter(r => isSameDay(new Date(r.date), calendarDay))
    : [];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex gap-2 items-center text-gray-400 text-sm">
          <span className="w-4 h-4 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
          Načítavam...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hlavička */}
      <div className="bg-gray-900 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-sm">R</span>
            </div>
            <div>
              <h1 className="text-white font-semibold text-sm">Rezervo</h1>
              <p className="text-gray-400 text-xs">Dashboard</p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-xs text-gray-400 hover:text-white transition px-3 py-1.5 rounded-lg hover:bg-white/10"
          >
            Odhlásiť
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {actionError && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm mb-6">
            {actionError}
          </div>
        )}

        <div className="flex gap-6 items-start">
          {/* Ľavý stĺpec */}
          <div className="flex-1 min-w-0 space-y-6">
            {/* Stat karty */}
            <div className="grid grid-cols-3 gap-4">
              <StatCard label="Dnes" value={todayReservations.length} color="default" />
              <StatCard label="Príchody" value={reservations.filter(r => r.status === "ARRIVED").length} color="green" />
              <StatCard label="No-show dnes" value={todayReservations.filter(r => r.status === "NO_SHOW").length} color="red" />
            </div>

            <Section title="Dnes" count={todayReservations.length}>
              {todayReservations.length === 0 ? (
                <EmptyState text="Žiadne rezervácie na dnes" />
              ) : (
                todayReservations
                  .sort((a, b) => a.timeFrom.localeCompare(b.timeFrom))
                  .map(r => <ReservationRow key={r.id} reservation={r} onAction={handleAction} actionLoading={actionLoading} />)
              )}
            </Section>

            <Section title="Nadchádzajúce" count={upcomingReservations.length}>
              {upcomingReservations.length === 0 ? (
                <EmptyState text="Žiadne nadchádzajúce rezervácie" />
              ) : (
                upcomingReservations
                  .sort((a, b) => getDateStr(a.date).localeCompare(getDateStr(b.date)) || a.timeFrom.localeCompare(b.timeFrom))
                  .map(r => <ReservationRow key={r.id} reservation={r} onAction={handleAction} actionLoading={actionLoading} />)
              )}
            </Section>
          </div>

          {/* Pravý stĺpec — kalendár */}
          <div className="w-60 shrink-0">
            <div className="bg-white rounded-2xl border border-gray-100 p-4 sticky top-6">
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition text-lg">
                  ‹
                </button>
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  {format(currentMonth, "MMM yyyy", { locale: cs })}
                </span>
                <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition text-lg">
                  ›
                </button>
              </div>

              <div className="grid grid-cols-7 mb-1">
                {["P", "U", "S", "Š", "P", "S", "N"].map((d, i) => (
                  <div key={i} className="text-center text-[10px] font-medium text-gray-300 py-1">{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-0.5">
                {Array.from({ length: startPadding }).map((_, i) => <div key={`p${i}`} />)}
                {days.map((day) => {
                  const count = reservations.filter(
                    r => isSameDay(new Date(r.date), day) && r.status !== "CANCELLED"
                  ).length;
                  const selected = calendarDay ? isSameDay(day, calendarDay) : false;
                  const today = isToday(day);

                  return (
                    <button key={day.toISOString()} onClick={() => setCalendarDay(selected ? null : day)}
                      className={`relative flex flex-col items-center justify-center h-8 w-full rounded-lg text-xs transition
                        ${selected ? "bg-gray-900 text-white" : today ? "bg-gray-100 text-gray-900 font-semibold" : "hover:bg-gray-50 text-gray-500"}`}>
                      <span>{format(day, "d")}</span>
                      {count > 0 && (
                        <span className={`text-[9px] font-bold leading-none ${selected ? "text-gray-300" : "text-green-500"}`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 pt-3 border-t border-gray-50 flex items-center gap-2 text-[10px] text-gray-300">
                <span className="text-green-500 font-bold">číslo</span> = rezervácie
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modál */}
      {calendarDay && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setCalendarDay(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col border border-gray-100">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <div>
                <h3 className="font-bold text-gray-900">
                  {format(calendarDay, "d. MMMM yyyy", { locale: cs })}
                </h3>
                <p className="text-xs text-gray-400 capitalize mt-0.5">
                  {format(calendarDay, "EEEE", { locale: cs })}
                </p>
              </div>
              <button onClick={() => setCalendarDay(null)}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400 transition text-lg">
                ✕
              </button>
            </div>

            {calendarDayReservations.length > 0 && (
              <div className="flex gap-2 px-5 py-3 border-b border-gray-50">
                {[
                  { label: "Potvrdené", count: calendarDayReservations.filter(r => r.status === "CONFIRMED" || r.status === "ARRIVED").length, cls: "bg-green-50 text-green-700" },
                  { label: "Čakajúce", count: calendarDayReservations.filter(r => r.status === "PENDING").length, cls: "bg-amber-50 text-amber-700" },
                  { label: "No-show", count: calendarDayReservations.filter(r => r.status === "NO_SHOW").length, cls: "bg-red-50 text-red-600" },
                  { label: "Zrušené", count: calendarDayReservations.filter(r => r.status === "CANCELLED").length, cls: "bg-gray-50 text-gray-500" },
                ].filter(s => s.count > 0).map(s => (
                  <div key={s.label} className={`flex-1 rounded-xl px-2 py-2 text-center ${s.cls}`}>
                    <p className="text-lg font-bold">{s.count}</p>
                    <p className="text-[10px]">{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="overflow-y-auto flex-1 divide-y divide-gray-50">
              {calendarDayReservations.length === 0 ? (
                <p className="text-center text-gray-300 text-sm py-10">Žiadne rezervácie</p>
              ) : (
                calendarDayReservations
                  .sort((a, b) => a.timeFrom.localeCompare(b.timeFrom))
                  .map(r => <ReservationRow key={r.id} reservation={r} onAction={handleAction} actionLoading={actionLoading} />)
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="font-semibold text-gray-900 text-sm">{title}</h2>
        <span className="bg-gray-100 text-gray-500 text-xs font-medium px-2 py-0.5 rounded-full">{count}</span>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">{children}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-gray-300 text-sm py-8 text-center">{text}</p>;
}

function StatCard({ label, value, color }: { label: string; value: number; color: "default" | "green" | "red" }) {
  const styles = {
    default: "bg-white border-gray-100 text-gray-900",
    green: "bg-white border-gray-100 text-green-600",
    red: "bg-white border-gray-100 text-red-500",
  };
  return (
    <div className={`rounded-2xl border p-4 ${styles[color]}`}>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-xs text-gray-400 mt-1 font-medium">{label}</p>
    </div>
  );
}

function ReservationRow({ reservation: r, onAction, actionLoading }: {
  reservation: Reservation;
  onAction: (id: string, action: "arrived" | "noshow" | "cancel" | "undo") => void;
  actionLoading: string | null;
}) {
  const isActive = r.status === "PENDING" || r.status === "CONFIRMED";
  const dateFormatted = format(new Date(r.date), "d. MMM", { locale: cs });

  return (
    <div className="px-4 py-3.5 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-gray-900 text-sm">{r.customerName}</span>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status]}`}>
            {STATUS_LABELS[r.status]}
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">
          {dateFormatted} · {r.timeFrom}–{r.timeTo} · {r.table.name} · {r.partySize} os.
        </p>
        <p className="text-xs text-gray-300 mt-0.5">{r.customerPhone}</p>
        {r.note && <p className="text-xs text-amber-600 mt-1">💬 {r.note}</p>}
      </div>

      <div className="flex gap-1.5 shrink-0">
        {isActive && (
          <>
            <button onClick={() => onAction(r.id, "arrived")} disabled={actionLoading !== null}
              className="bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-gray-700 disabled:opacity-40 transition font-medium">
              Prišiel
            </button>
            <button onClick={() => onAction(r.id, "noshow")} disabled={actionLoading !== null}
              className="bg-red-50 text-red-600 border border-red-200 text-xs px-3 py-1.5 rounded-lg hover:bg-red-100 disabled:opacity-40 transition font-medium">
              No-show
            </button>
            <button onClick={() => onAction(r.id, "cancel")} disabled={actionLoading !== null}
              className="bg-gray-50 text-gray-500 border border-gray-200 text-xs px-3 py-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 transition font-medium">
              Zrušiť
            </button>
          </>
        )}
        {(r.status === "NO_SHOW" || r.status === "ARRIVED") && (
          <button onClick={() => onAction(r.id, "undo")} disabled={actionLoading !== null}
            title={r.paymentStatus === "CAPTURED" ? "Platba bude vrátená zákazníkovi" : ""}
            className="bg-orange-50 text-orange-600 border border-orange-200 text-xs px-3 py-1.5 rounded-lg hover:bg-orange-100 disabled:opacity-40 transition font-medium">
            ↩ Vrátiť
          </button>
        )}
      </div>
    </div>
  );
}

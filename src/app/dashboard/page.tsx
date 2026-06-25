"use client";

import { useEffect, useState } from "react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, addMonths, subMonths, isSameDay, isToday,
} from "date-fns";
import { cs } from "date-fns/locale";

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
  PENDING: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  ARRIVED: "bg-green-100 text-green-800",
  NO_SHOW: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-100 text-gray-600",
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
  const todayReservations = reservations.filter(
    (r) => getDateStr(r.date) === todayStr
  );
  const upcomingReservations = reservations.filter(
    (r) => getDateStr(r.date) > todayStr
  );

  // Kalendár
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = (getDay(monthStart) + 6) % 7;

  const calendarDayReservations = calendarDay
    ? reservations.filter((r) => isSameDay(new Date(r.date), calendarDay))
    : [];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Načítavam...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Dashboard reštaurácie</h1>
        <p className="text-sm text-gray-500">Správa rezervácií</p>
      </div>

      <div className="p-6 max-w-6xl mx-auto">
        {actionError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-6">
            {actionError}
          </div>
        )}

        <div className="flex gap-6 items-start">
          {/* Ľavý stĺpec — prehľad */}
          <div className="flex-1 min-w-0 space-y-6">
            {/* Stat karty */}
            <div className="grid grid-cols-3 gap-4">
              <StatCard label="Dnes" value={todayReservations.length} color="blue" />
              <StatCard label="Príchody" value={reservations.filter(r => r.status === "ARRIVED").length} color="green" />
              <StatCard label="No-show dnes" value={todayReservations.filter(r => r.status === "NO_SHOW").length} color="red" />
            </div>

            <Section title={`Dnes (${todayReservations.length})`}>
              {todayReservations.length === 0 ? (
                <p className="text-gray-400 text-sm py-4 text-center">Žiadne rezervácie na dnes</p>
              ) : (
                todayReservations
                  .sort((a, b) => a.timeFrom.localeCompare(b.timeFrom))
                  .map((r) => (
                    <ReservationRow key={r.id} reservation={r} onAction={handleAction} actionLoading={actionLoading} />
                  ))
              )}
            </Section>

            <Section title={`Nadchádzajúce (${upcomingReservations.length})`}>
              {upcomingReservations.length === 0 ? (
                <p className="text-gray-400 text-sm py-4 text-center">Žiadne nadchádzajúce rezervácie</p>
              ) : (
                upcomingReservations
                  .sort((a, b) => getDateStr(a.date).localeCompare(getDateStr(b.date)) || a.timeFrom.localeCompare(b.timeFrom))
                  .map((r) => (
                    <ReservationRow key={r.id} reservation={r} onAction={handleAction} actionLoading={actionLoading} />
                  ))
              )}
            </Section>
          </div>

          {/* Pravý stĺpec — malý kalendár */}
          <div className="w-64 shrink-0">
            <div className="bg-white rounded-2xl shadow p-4 sticky top-6">
              {/* Navigácia */}
              <div className="flex items-center justify-between mb-3">
                <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  className="p-1 hover:bg-gray-100 rounded-lg text-gray-500 transition">‹</button>
                <span className="text-sm font-semibold text-gray-800">
                  {format(currentMonth, "MMM yyyy", { locale: cs })}
                </span>
                <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  className="p-1 hover:bg-gray-100 rounded-lg text-gray-500 transition">›</button>
              </div>

              {/* Dni v týždni */}
              <div className="grid grid-cols-7 mb-1">
                {["P", "U", "S", "Š", "P", "S", "N"].map((d, i) => (
                  <div key={i} className="text-center text-xs text-gray-400 py-0.5">{d}</div>
                ))}
              </div>

              {/* Dni */}
              <div className="grid grid-cols-7 gap-0.5">
                {Array.from({ length: startPadding }).map((_, i) => <div key={`p${i}`} />)}
                {days.map((day) => {
                  const count = reservations.filter(
                    (r) => isSameDay(new Date(r.date), day) && r.status !== "CANCELLED"
                  ).length;
                  const selected = calendarDay ? isSameDay(day, calendarDay) : false;
                  const today = isToday(day);

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => setCalendarDay(selected ? null : day)}
                      className={`relative flex flex-col items-center justify-center h-8 w-full rounded-lg text-xs transition
                        ${selected ? "bg-green-500 text-white" : today ? "bg-blue-50 text-blue-700 ring-1 ring-blue-300" : "hover:bg-gray-50 text-gray-600"}
                      `}
                    >
                      <span className="font-medium">{format(day, "d")}</span>
                      {count > 0 && (
                        <span className={`text-[9px] font-bold leading-none ${selected ? "text-white" : "text-green-600"}`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modál pre deň z kalendára */}
      {calendarDay && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setCalendarDay(null); }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div>
                <h3 className="font-bold text-gray-900">
                  {format(calendarDay, "d. MMMM yyyy", { locale: cs })}
                </h3>
                <p className="text-sm text-gray-500 capitalize">
                  {format(calendarDay, "EEEE", { locale: cs })}
                </p>
              </div>
              <button onClick={() => setCalendarDay(null)} className="text-gray-400 hover:text-gray-600 text-xl p-1">✕</button>
            </div>

            {/* Súhrn */}
            {calendarDayReservations.length > 0 && (
              <div className="flex gap-2 px-5 py-3 bg-gray-50 border-b flex-wrap">
                {[
                  { label: "Potvrdené", count: calendarDayReservations.filter(r => r.status === "CONFIRMED" || r.status === "ARRIVED").length, color: "text-green-700 bg-green-100" },
                  { label: "Čakajúce", count: calendarDayReservations.filter(r => r.status === "PENDING").length, color: "text-yellow-700 bg-yellow-100" },
                  { label: "No-show", count: calendarDayReservations.filter(r => r.status === "NO_SHOW").length, color: "text-red-700 bg-red-100" },
                  { label: "Zrušené", count: calendarDayReservations.filter(r => r.status === "CANCELLED").length, color: "text-gray-600 bg-gray-100" },
                ].filter(s => s.count > 0).map(s => (
                  <div key={s.label} className={`rounded-lg px-3 py-2 text-center min-w-[70px] ${s.color}`}>
                    <p className="text-lg font-bold">{s.count}</p>
                    <p className="text-xs">{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="overflow-y-auto flex-1 divide-y">
              {calendarDayReservations.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-10">Žiadne rezervácie</p>
              ) : (
                calendarDayReservations
                  .sort((a, b) => a.timeFrom.localeCompare(b.timeFrom))
                  .map((r) => (
                    <ReservationRow key={r.id} reservation={r} onAction={handleAction} actionLoading={actionLoading} />
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-semibold text-gray-700 mb-3">{title}</h2>
      <div className="bg-white rounded-xl shadow divide-y">{children}</div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: "blue" | "green" | "red" }) {
  const colors = { blue: "bg-blue-50 text-blue-700", green: "bg-green-50 text-green-700", red: "bg-red-50 text-red-700" };
  return (
    <div className={`rounded-xl p-4 ${colors[color]}`}>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm mt-1">{label}</p>
    </div>
  );
}

function ReservationRow({
  reservation: r, onAction, actionLoading,
}: {
  reservation: Reservation;
  onAction: (id: string, action: "arrived" | "noshow" | "cancel" | "undo") => void;
  actionLoading: string | null;
}) {
  const isActive = r.status === "PENDING" || r.status === "CONFIRMED";
  const dateFormatted = format(new Date(r.date), "d. MMM", { locale: cs });

  return (
    <div className="p-4 flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-gray-900">{r.customerName}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status]}`}>
            {STATUS_LABELS[r.status]}
          </span>
        </div>
        <p className="text-sm text-gray-500 mt-0.5">
          {dateFormatted} · {r.timeFrom}–{r.timeTo} · {r.table.name} · {r.partySize} os.
        </p>
        <p className="text-sm text-gray-400">{r.customerPhone}</p>
        {r.note && <p className="text-sm text-amber-600 mt-1">Poznámka: {r.note}</p>}
      </div>

      {isActive && (
        <div className="flex gap-2 shrink-0">
          <button onClick={() => onAction(r.id, "arrived")} disabled={actionLoading !== null}
            className="bg-green-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50 transition">
            Prišiel
          </button>
          <button onClick={() => onAction(r.id, "noshow")} disabled={actionLoading !== null}
            className="bg-red-500 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-red-600 disabled:opacity-50 transition">
            No-show
          </button>
          <button onClick={() => onAction(r.id, "cancel")} disabled={actionLoading !== null}
            className="bg-gray-100 text-gray-600 text-sm px-3 py-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition">
            Zrušiť
          </button>
        </div>
      )}
      {(r.status === "NO_SHOW" || r.status === "ARRIVED") && (
        <button onClick={() => onAction(r.id, "undo")} disabled={actionLoading !== null}
          title={r.paymentStatus === "CAPTURED" ? "Platba bude vrátená zákazníkovi" : ""}
          className="bg-orange-100 text-orange-700 text-sm px-3 py-1.5 rounded-lg hover:bg-orange-200 disabled:opacity-50 transition shrink-0">
          ↩ Vrátiť
        </button>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameDay, isToday } from "date-fns";
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

export default function DashboardPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

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

  const getReservationsForDay = (day: Date) =>
    reservations.filter((r) => isSameDay(new Date(r.date), day));

  // Dni v mesiaci + padding pred prvým dňom
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  // Pondelok = 0, ... Nedeľa = 6
  const startPadding = (getDay(monthStart) + 6) % 7;

  const selectedDayReservations = selectedDay ? getReservationsForDay(selectedDay) : [];

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

      <div className="p-6 max-w-3xl mx-auto space-y-6">
        {actionError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {actionError}
          </div>
        )}

        {/* Kalendár */}
        <div className="bg-white rounded-2xl shadow p-5">
          {/* Hlavička — mesiac + navigácia */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-600"
            >
              ‹
            </button>
            <h2 className="font-semibold text-gray-900">
              {format(currentMonth, "MMMM yyyy", { locale: cs })}
            </h2>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-600"
            >
              ›
            </button>
          </div>

          {/* Hlavičky dní */}
          <div className="grid grid-cols-7 mb-2">
            {["Po", "Ut", "St", "Št", "Pi", "So", "Ne"].map((d) => (
              <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Dni */}
          <div className="grid grid-cols-7 gap-1">
            {/* Padding pred prvým dňom */}
            {Array.from({ length: startPadding }).map((_, i) => (
              <div key={`pad-${i}`} />
            ))}

            {days.map((day) => {
              const dayRes = getReservationsForDay(day);
              const total = dayRes.length;
              const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;
              const today = isToday(day);

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  className={`relative aspect-square flex flex-col items-center justify-center rounded-xl transition text-sm font-medium
                    ${isSelected ? "bg-green-500 text-white" : today ? "bg-blue-50 text-blue-700 ring-2 ring-blue-300" : "hover:bg-gray-50 text-gray-700"}
                  `}
                >
                  <span>{format(day, "d")}</span>
                  {total > 0 && (
                    <span className={`text-xs font-bold mt-0.5 ${isSelected ? "text-white" : "text-green-600"}`}>
                      {total}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Legenda */}
        <div className="flex gap-4 text-xs text-gray-500 px-1">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-50 ring-2 ring-blue-300 inline-block" /> Dnes</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" /> Vybraný deň</span>
          <span className="text-green-600 font-bold">číslo</span><span>= počet rezervácií</span>
        </div>
      </div>

      {/* Modál — rezervácie vybraného dňa */}
      {selectedDay && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedDay(null); }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
            {/* Modál hlavička */}
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div>
                <h3 className="font-bold text-gray-900">
                  {format(selectedDay, "d. MMMM yyyy", { locale: cs })}
                </h3>
                <p className="text-sm text-gray-500">
                  {format(selectedDay, "EEEE", { locale: cs })}
                </p>
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                className="text-gray-400 hover:text-gray-600 text-xl p-1"
              >
                ✕
              </button>
            </div>

            {/* Súhrn */}
            {selectedDayReservations.length > 0 && (
              <div className="flex gap-3 px-5 py-3 bg-gray-50 border-b">
                {[
                  { label: "Potvrdené", count: selectedDayReservations.filter(r => r.status === "CONFIRMED" || r.status === "ARRIVED").length, color: "text-green-700 bg-green-100" },
                  { label: "Čakajúce", count: selectedDayReservations.filter(r => r.status === "PENDING").length, color: "text-yellow-700 bg-yellow-100" },
                  { label: "No-show", count: selectedDayReservations.filter(r => r.status === "NO_SHOW").length, color: "text-red-700 bg-red-100" },
                  { label: "Zrušené", count: selectedDayReservations.filter(r => r.status === "CANCELLED").length, color: "text-gray-600 bg-gray-100" },
                ].filter(s => s.count > 0).map(s => (
                  <div key={s.label} className={`flex-1 rounded-lg px-3 py-2 text-center ${s.color}`}>
                    <p className="text-xl font-bold">{s.count}</p>
                    <p className="text-xs">{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Zoznam rezervácií */}
            <div className="overflow-y-auto flex-1 divide-y">
              {selectedDayReservations.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-10">Žiadne rezervácie</p>
              ) : (
                selectedDayReservations
                  .sort((a, b) => a.timeFrom.localeCompare(b.timeFrom))
                  .map((r) => (
                    <ReservationRow
                      key={r.id}
                      reservation={r}
                      onAction={handleAction}
                      actionLoading={actionLoading}
                    />
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReservationRow({
  reservation: r,
  onAction,
  actionLoading,
}: {
  reservation: Reservation;
  onAction: (id: string, action: "arrived" | "noshow" | "cancel" | "undo") => void;
  actionLoading: string | null;
}) {
  const isActive = r.status === "PENDING" || r.status === "CONFIRMED";

  return (
    <div className="px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-900">{r.customerName}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status]}`}>
              {STATUS_LABELS[r.status]}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {r.timeFrom}–{r.timeTo} · {r.table.name} · {r.partySize} os.
          </p>
          <p className="text-sm text-gray-400">{r.customerPhone}</p>
          {r.note && <p className="text-sm text-amber-600 mt-1">Poznámka: {r.note}</p>}
        </div>
      </div>

      {isActive && (
        <div className="flex gap-2 mt-3">
          <button onClick={() => onAction(r.id, "arrived")} disabled={actionLoading !== null}
            className="flex-1 bg-green-600 text-white text-sm py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50 transition">
            Prišiel
          </button>
          <button onClick={() => onAction(r.id, "noshow")} disabled={actionLoading !== null}
            className="flex-1 bg-red-500 text-white text-sm py-1.5 rounded-lg hover:bg-red-600 disabled:opacity-50 transition">
            No-show
          </button>
          <button onClick={() => onAction(r.id, "cancel")} disabled={actionLoading !== null}
            className="flex-1 bg-gray-100 text-gray-600 text-sm py-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition">
            Zrušiť
          </button>
        </div>
      )}
      {(r.status === "NO_SHOW" || r.status === "ARRIVED") && (
        <div className="mt-3">
          <button onClick={() => onAction(r.id, "undo")} disabled={actionLoading !== null}
            title={r.paymentStatus === "CAPTURED" ? "Platba bude vrátená zákazníkovi" : ""}
            className="bg-orange-100 text-orange-700 text-sm px-4 py-1.5 rounded-lg hover:bg-orange-200 disabled:opacity-50 transition">
            ↩ Vrátiť späť
          </button>
        </div>
      )}
    </div>
  );
}

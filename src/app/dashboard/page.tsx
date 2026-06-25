"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
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

function getDateStr(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("sv-SE");
}

export default function DashboardPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const fetchReservations = async () => {
    const res = await fetch("/api/dashboard/reservations");
    const data = await res.json();
    setReservations(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchReservations();
  }, []);

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

  // Zoskupenie rezervácií podľa dátumu
  const byDate = reservations
    .filter((r) => r.status !== "CANCELLED")
    .reduce<Record<string, Reservation[]>>((acc, r) => {
      const d = getDateStr(r.date);
      if (!acc[d]) acc[d] = [];
      acc[d].push(r);
      return acc;
    }, {});

  const sortedDates = Object.keys(byDate).sort();

  // Rezervácie pre vybraný deň (alebo dnes ak nič nie je vybrané)
  const activeDateStr = selectedDate ?? todayStr;
  const selectedReservations = byDate[activeDateStr] ?? [];

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

      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        {actionError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {actionError}
          </div>
        )}

        {/* Kalendárny prehľad */}
        <div>
          <h2 className="font-semibold text-gray-700 mb-3">Prehľad podľa dní</h2>
          {sortedDates.length === 0 ? (
            <div className="bg-white rounded-xl shadow p-6 text-center text-gray-400 text-sm">
              Žiadne rezervácie
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {sortedDates.map((dateStr) => {
                const dayRes = byDate[dateStr];
                const confirmed = dayRes.filter(
                  (r) => r.status === "CONFIRMED" || r.status === "ARRIVED"
                ).length;
                const pending = dayRes.filter((r) => r.status === "PENDING").length;
                const noshow = dayRes.filter((r) => r.status === "NO_SHOW").length;
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === activeDateStr;
                const dateObj = new Date(dateStr + "T12:00:00");

                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDate(dateStr === activeDateStr && !selectedDate ? null : dateStr)}
                    className={`rounded-xl p-4 text-left transition border-2 ${
                      isSelected
                        ? "border-green-500 bg-green-50"
                        : isToday
                        ? "border-blue-300 bg-blue-50"
                        : "border-transparent bg-white shadow"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-gray-900 text-sm">
                        {format(dateObj, "d. MMM", { locale: cs })}
                      </span>
                      {isToday && (
                        <span className="text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded-full">
                          dnes
                        </span>
                      )}
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{dayRes.length}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {format(dateObj, "EEEE", { locale: cs })}
                    </p>
                    <div className="mt-2 space-y-0.5">
                      {confirmed > 0 && (
                        <div className="flex items-center gap-1 text-xs text-green-700">
                          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                          {confirmed} potvrdených
                        </div>
                      )}
                      {pending > 0 && (
                        <div className="flex items-center gap-1 text-xs text-yellow-700">
                          <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
                          {pending} čakajúcich
                        </div>
                      )}
                      {noshow > 0 && (
                        <div className="flex items-center gap-1 text-xs text-red-600">
                          <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                          {noshow} no-show
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Rezervácie vybraného dňa */}
        <div>
          <h2 className="font-semibold text-gray-700 mb-3">
            {activeDateStr === todayStr
              ? `Dnes — ${format(new Date(activeDateStr + "T12:00:00"), "d. MMMM yyyy", { locale: cs })}`
              : format(new Date(activeDateStr + "T12:00:00"), "d. MMMM yyyy", { locale: cs })}
            {" "}
            <span className="font-normal text-gray-400">({selectedReservations.length})</span>
          </h2>
          <div className="bg-white rounded-xl shadow divide-y">
            {selectedReservations.length === 0 ? (
              <p className="text-gray-400 text-sm py-6 text-center">Žiadne rezervácie</p>
            ) : (
              selectedReservations
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
    <div className="p-4 flex items-center justify-between gap-4">
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
        {r.note && (
          <p className="text-sm text-amber-600 mt-1">Poznámka: {r.note}</p>
        )}
      </div>

      {isActive && (
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => onAction(r.id, "arrived")}
            disabled={actionLoading !== null}
            className="bg-green-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
          >
            Prišiel
          </button>
          <button
            onClick={() => onAction(r.id, "noshow")}
            disabled={actionLoading !== null}
            className="bg-red-500 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-red-600 disabled:opacity-50 transition"
          >
            No-show
          </button>
          <button
            onClick={() => onAction(r.id, "cancel")}
            disabled={actionLoading !== null}
            className="bg-gray-100 text-gray-600 text-sm px-3 py-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition"
          >
            Zrušiť
          </button>
        </div>
      )}
      {(r.status === "NO_SHOW" || r.status === "ARRIVED") && (
        <button
          onClick={() => onAction(r.id, "undo")}
          disabled={actionLoading !== null}
          title={r.paymentStatus === "CAPTURED" ? "Platba bude vrátená zákazníkovi" : ""}
          className="bg-orange-100 text-orange-700 text-sm px-3 py-1.5 rounded-lg hover:bg-orange-200 disabled:opacity-50 transition shrink-0"
        >
          ↩ Vrátiť
        </button>
      )}
    </div>
  );
}

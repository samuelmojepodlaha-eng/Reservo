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

export default function DashboardPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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
    action: "arrived" | "noshow" | "cancel"
  ) => {
    setActionLoading(reservationId + action);
    await fetch(`/api/reservations/${reservationId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    await fetchReservations();
    setActionLoading(null);
  };

  const todayStr = new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD v lokálnom čase
  const todayReservations = reservations.filter((r) => {
    const d = new Date(r.date);
    return d.toLocaleDateString("sv-SE") === todayStr;
  });
  const upcomingReservations = reservations.filter((r) => {
    const d = new Date(r.date);
    return d.toLocaleDateString("sv-SE") > todayStr;
  });

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

      <div className="p-6 space-y-8 max-w-5xl mx-auto">
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            label="Dnešné rezervácie"
            value={todayReservations.length}
            color="blue"
          />
          <StatCard
            label="Príchody potvrdené"
            value={reservations.filter((r) => r.status === "ARRIVED").length}
            color="green"
          />
          <StatCard
            label="No-show dnes"
            value={
              todayReservations.filter((r) => r.status === "NO_SHOW").length
            }
            color="red"
          />
        </div>

        <Section title={`Dnes (${todayReservations.length})`}>
          {todayReservations.length === 0 ? (
            <p className="text-gray-500 text-sm py-4">Žiadne rezervácie na dnes</p>
          ) : (
            todayReservations.map((r) => (
              <ReservationRow
                key={r.id}
                reservation={r}
                onAction={handleAction}
                actionLoading={actionLoading}
              />
            ))
          )}
        </Section>

        <Section title={`Nadchádzajúce (${upcomingReservations.length})`}>
          {upcomingReservations.length === 0 ? (
            <p className="text-gray-500 text-sm py-4">Žiadne nadchádzajúce rezervácie</p>
          ) : (
            upcomingReservations.map((r) => (
              <ReservationRow
                key={r.id}
                reservation={r}
                onAction={handleAction}
                actionLoading={actionLoading}
              />
            ))
          )}
        </Section>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "blue" | "green" | "red";
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    red: "bg-red-50 text-red-700",
  };
  return (
    <div className={`rounded-xl p-4 ${colors[color]}`}>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm mt-1">{label}</p>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="font-semibold text-gray-700 mb-3">{title}</h2>
      <div className="bg-white rounded-xl shadow divide-y">{children}</div>
    </div>
  );
}

function ReservationRow({
  reservation: r,
  onAction,
  actionLoading,
}: {
  reservation: Reservation;
  onAction: (id: string, action: "arrived" | "noshow" | "cancel") => void;
  actionLoading: string | null;
}) {
  const isActive = r.status === "PENDING" || r.status === "CONFIRMED";
  const dateFormatted = format(new Date(r.date), "d. MMMM", { locale: cs });

  return (
    <div className="p-4 flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-gray-900">{r.customerName}</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status]}`}
          >
            {STATUS_LABELS[r.status]}
          </span>
        </div>
        <p className="text-sm text-gray-500 mt-0.5">
          {dateFormatted} · {r.timeFrom}–{r.timeTo} · {r.table.name} ·{" "}
          {r.partySize} os.
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
    </div>
  );
}

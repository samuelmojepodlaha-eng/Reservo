"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

interface ReservationInfo {
  id: string;
  status: string;
  customerName: string;
  restaurantName: string;
  date: string;
  timeFrom: string;
  timeTo: string;
  tableName: string;
  depositCzk: number;
  cancellationHours: number;
}

export default function CancelPage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<ReservationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [result, setResult] = useState<"success" | "error" | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetch(`/api/cancel/${token}`)
      .then(r => r.json())
      .then(data => { setInfo(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  const handleCancel = async () => {
    setCancelling(true);
    const res = await fetch(`/api/cancel/${token}`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setResult("success");
    } else {
      setErrorMsg(data.error || "Nastala chyba");
      setResult("error");
    }
    setCancelling(false);
  };

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

  if (!info || (info as { error?: string }).error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-gray-400 text-xl">?</span>
          </div>
          <h1 className="font-bold text-gray-900 mb-2">Rezervácia nenájdená</h1>
          <p className="text-sm text-gray-400">Odkaz je neplatný alebo rezervácia neexistuje.</p>
        </div>
      </div>
    );
  }

  if (result === "success" || info.status === "CANCELLED") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-gray-500 text-xl">✓</span>
          </div>
          <h1 className="font-bold text-gray-900 mb-2">Rezervácia zrušená</h1>
          <p className="text-sm text-gray-400">Záloha bola uvoľnená z vašej karty.</p>
        </div>
      </div>
    );
  }

  const dateFormatted = format(new Date(info.date), "d. MMMM yyyy", { locale: cs });
  const dayFormatted = format(new Date(info.date), "EEEE", { locale: cs });
  const hoursUntil = (new Date(info.date).getTime() - Date.now()) / (1000 * 60 * 60);
  const canCancel = hoursUntil >= info.cancellationHours;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-10 h-10 bg-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="text-white font-bold">R</span>
          </div>
          <h1 className="font-bold text-gray-900">Zrušenie rezervácie</h1>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{info.restaurantName}</p>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-gray-400">Dátum</p>
              <p className="font-semibold text-gray-900 capitalize">{dayFormatted}, {dateFormatted}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Čas</p>
              <p className="font-semibold text-gray-900">{info.timeFrom} – {info.timeTo}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Záloha</p>
              <p className="font-semibold text-gray-900">{info.depositCzk} Kč</p>
            </div>
          </div>
        </div>

        {canCancel ? (
          <div className="space-y-3">
            <button onClick={handleCancel} disabled={cancelling}
              className="w-full bg-gray-900 text-white py-3 rounded-xl font-semibold text-sm hover:bg-gray-800 disabled:opacity-40 transition">
              {cancelling ? "Ruším..." : "Potvrdiť zrušenie"}
            </button>
            <p className="text-xs text-gray-400 text-center">
              Záloha {info.depositCzk} Kč bude uvoľnená z vašej karty.
            </p>
            {result === "error" && (
              <div className="bg-red-50 border border-red-100 text-red-600 rounded-xl px-4 py-3 text-sm text-center">
                {errorMsg}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-4 text-center">
            <p className="text-sm font-semibold text-amber-800 mb-1">Storno nie je možné</p>
            <p className="text-xs text-amber-600">
              Bezplatné storno je možné do {info.cancellationHours}h pred rezerváciou.
              Táto lehota už uplynula.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

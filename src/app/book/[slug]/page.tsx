"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface Table { id: string; name: string; capacity: number; }
interface Restaurant {
  id: string; name: string; address: string;
  depositAmount: number; cancellationHours: number; tables: Table[];
}
interface FormData {
  tableId: string; customerName: string; customerEmail: string;
  customerPhone: string; partySize: string; date: string;
  timeFrom: string; timeTo: string; note: string;
}

const inputClass = "w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition bg-white";
const labelClass = "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5";

type BookingStep = "form" | "payment" | "success";

function Step({ n, active, done }: { n: number; active: boolean; done: boolean }) {
  return (
    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
      ${done ? "bg-gray-900 text-white" : active ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-400"}`}>
      {done ? "✓" : n}
    </div>
  );
}

function PaymentForm({ clientSecret, depositCzk, onSuccess }: {
  clientSecret: string; depositCzk: number; onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setError("");
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/book/success` },
      redirect: "if_required",
    });
    if (error) { setError(error.message || "Platba zlyhala"); setLoading(false); }
    else onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <PaymentElement options={{ layout: "tabs" }} />
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}
      <button type="submit" disabled={loading || !stripe}
        className="w-full bg-gray-900 text-white py-3.5 rounded-xl font-semibold text-sm hover:bg-gray-800 disabled:opacity-40 transition">
        {loading ? "Spracovávam..." : `Potvrdiť a zablokovať ${depositCzk} Kč`}
      </button>
      <p className="text-xs text-gray-400 text-center leading-relaxed">
        Suma bude iba zablokovaná, nie stiahnutá. Pri návšteve sa odpočíta od účtu.
      </p>
    </form>
  );
}

export default function BookingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [step, setStep] = useState<BookingStep>("form");
  const [clientSecret, setClientSecret] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    tableId: "", customerName: "", customerEmail: "", customerPhone: "",
    partySize: "2", date: "", timeFrom: "18:00", timeTo: "20:00", note: "",
  });

  useEffect(() => {
    fetch(`/api/restaurants/${slug}`).then(r => r.json()).then(setRestaurant);
  }, [slug]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/reservations/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantSlug: slug, ...formData }),
      });
      const data = await res.json();
      if (!res.ok) { setSubmitError(data.error || "Nastala chyba."); return; }
      setClientSecret(data.clientSecret);
      setStep("payment");
    } catch { setSubmitError("Nastala chyba, skúste znova."); }
    finally { setSubmitLoading(false); }
  };

  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex gap-2 items-center text-gray-400 text-sm">
          <span className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          Načítavam...
        </div>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-white text-2xl">✓</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Rezervácia potvrdená</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            Potvrdenie sme vám odoslali na email.<br />Tešíme sa na vašu návštevu.
          </p>
          <div className="mt-6 pt-6 border-t border-gray-100 text-xs text-gray-400">
            {restaurant.name}
          </div>
        </div>
      </div>
    );
  }

  const depositCzk = restaurant.depositAmount / 100;
  const stepIndex = step === "form" ? 0 : step === "payment" ? 1 : 2;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Hlavička */}
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-lg mx-auto">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Rezervácia</p>
          <h1 className="text-lg font-bold text-gray-900 mt-0.5">{restaurant.name}</h1>
          {restaurant.address && <p className="text-sm text-gray-400 mt-0.5">{restaurant.address}</p>}
        </div>
      </div>

      {/* Progress indikátor */}
      <div className="bg-white border-b border-gray-100 px-6 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Step n={1} active={stepIndex === 0} done={stepIndex > 0} />
          <span className="text-xs font-medium text-gray-500">Detaily</span>
          <div className="flex-1 h-px bg-gray-100" />
          <Step n={2} active={stepIndex === 1} done={stepIndex > 1} />
          <span className="text-xs font-medium text-gray-500">Platba</span>
          <div className="flex-1 h-px bg-gray-100" />
          <Step n={3} active={stepIndex === 2} done={false} />
          <span className="text-xs font-medium text-gray-500">Hotovo</span>
        </div>
      </div>

      <div className="flex-1 px-4 py-8">
        <div className="max-w-lg mx-auto space-y-4">

          {/* Info o zálohe */}
          <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-start gap-4">
            <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center shrink-0">
              <span className="text-white text-sm">₭</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Záloha {depositCzk} Kč</p>
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                Suma bude zablokovaná na karte a odpočítaná od vášho účtu.
                Storno zdarma do {restaurant.cancellationHours}h pred rezerváciou.
              </p>
            </div>
          </div>

          {/* Formulár */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            {step === "form" && (
              <form onSubmit={handleFormSubmit} className="space-y-5">
                <div>
                  <label className={labelClass}>Stôl</label>
                  <select required value={formData.tableId}
                    onChange={(e) => setFormData({ ...formData, tableId: e.target.value })}
                    className={inputClass}>
                    <option value="">Vyberte stôl</option>
                    {restaurant.tables.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} — max {t.capacity} os.</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Dátum</label>
                    <input type="date" required
                      min={new Date().toISOString().split("T")[0]}
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Počet osôb</label>
                    <input type="number" min="1" max="20" required
                      value={formData.partySize}
                      onChange={(e) => setFormData({ ...formData, partySize: e.target.value })}
                      className={inputClass} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Čas od</label>
                    <input type="time" required value={formData.timeFrom}
                      onChange={(e) => setFormData({ ...formData, timeFrom: e.target.value })}
                      className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Čas do</label>
                    <input type="time" required value={formData.timeTo}
                      onChange={(e) => setFormData({ ...formData, timeTo: e.target.value })}
                      className={inputClass} />
                  </div>
                </div>

                <div className="border-t border-gray-50 pt-5 space-y-4">
                  <div>
                    <label className={labelClass}>Meno a priezvisko</label>
                    <input type="text" required placeholder="Jan Novák"
                      value={formData.customerName}
                      onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                      className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Email</label>
                    <input type="email" required placeholder="jan@example.cz"
                      value={formData.customerEmail}
                      onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                      className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Telefón</label>
                    <input type="tel" required placeholder="+420 777 123 456"
                      value={formData.customerPhone}
                      onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                      className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Poznámka <span className="normal-case font-normal text-gray-300">(nepovinné)</span></label>
                    <textarea rows={2} placeholder="Narodeninová večera, alergény..."
                      value={formData.note}
                      onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                      className={inputClass} />
                  </div>
                </div>

                {submitError && (
                  <div className="bg-red-50 border border-red-100 text-red-600 rounded-xl px-4 py-3 text-sm">
                    {submitError}
                  </div>
                )}

                <button type="submit" disabled={submitLoading}
                  className="w-full bg-gray-900 text-white py-3.5 rounded-xl font-semibold text-sm hover:bg-gray-800 disabled:opacity-40 transition">
                  {submitLoading ? "Spracovávam..." : `Pokračovať k platbe →`}
                </button>
              </form>
            )}

            {step === "payment" && clientSecret && (
              <div className="space-y-5">
                <div>
                  <h2 className="font-bold text-gray-900">Platobná karta</h2>
                  <p className="text-sm text-gray-400 mt-0.5">Záloha {depositCzk} Kč bude iba zablokovaná.</p>
                </div>
                <Elements stripe={stripePromise} options={{ clientSecret, locale: "cs", appearance: { theme: "flat", variables: { borderRadius: "12px", colorBackground: "#f9fafb" } } }}>
                  <PaymentForm clientSecret={clientSecret} depositCzk={depositCzk} onSuccess={() => setStep("success")} />
                </Elements>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

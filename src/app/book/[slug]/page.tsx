"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface Table {
  id: string;
  name: string;
  capacity: number;
}

interface Restaurant {
  id: string;
  name: string;
  address: string;
  depositAmount: number;
  cancellationHours: number;
  tables: Table[];
}

interface FormData {
  tableId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  partySize: string;
  date: string;
  timeFrom: string;
  timeTo: string;
  note: string;
}

function PaymentForm({
  clientSecret,
  onSuccess,
}: {
  clientSecret: string;
  onSuccess: () => void;
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
      confirmParams: {
        return_url: `${window.location.origin}/book/success`,
      },
      redirect: "if_required",
    });

    if (error) {
      setError(error.message || "Platba zlyhala");
      setLoading(false);
    } else {
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading || !stripe}
        className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 transition"
      >
        {loading ? "Spracovávam..." : "Zablokovať zálohu a rezervovať"}
      </button>
      <p className="text-xs text-gray-500 text-center">
        Z karty bude zablokovaná suma. Ak prídete, odpočíta sa od vášho účtu.
        Ak neprídete, suma prepadne reštaurácii.
      </p>
    </form>
  );
}

export default function BookingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [step, setStep] = useState<"form" | "payment" | "success">("form");
  const [clientSecret, setClientSecret] = useState("");
  const [formData, setFormData] = useState<FormData>({
    tableId: "",
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    partySize: "2",
    date: "",
    timeFrom: "18:00",
    timeTo: "20:00",
    note: "",
  });

  useEffect(() => {
    fetch(`/api/restaurants/${slug}`)
      .then((r) => r.json())
      .then(setRestaurant);
  }, [slug]);

  const [submitError, setSubmitError] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);

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
      if (!res.ok) {
        setSubmitError(data.error || "Nastala chyba, skúste znova.");
        return;
      }
      setClientSecret(data.clientSecret);
      setStep("payment");
    } catch {
      setSubmitError("Nastala chyba, skúste znova.");
    } finally {
      setSubmitLoading(false);
    }
  };

  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Načítavam...</p>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-2xl shadow p-10 text-center max-w-md">
          <div className="text-5xl mb-4">✓</div>
          <h1 className="text-2xl font-bold text-green-600 mb-2">Rezervácia potvrdená!</h1>
          <p className="text-gray-600">
            Poslali sme vám potvrdenie na email. Tešíme sa na vašu návštevu!
          </p>
        </div>
      </div>
    );
  }

  const depositCzk = restaurant.depositAmount / 100;

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-2xl shadow p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{restaurant.name}</h1>
          <p className="text-gray-500 text-sm">{restaurant.address}</p>
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            Rezervácia vyžaduje zálohu <strong>{depositCzk} Kč</strong>. Záloha sa
            odpočíta od vášho účtu pri návšteve. Pri neúčasti prepadá reštaurácii.
            Storno bez poplatku do {restaurant.cancellationHours}h pred rezerváciou.
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-6">
          {step === "form" && (
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <h2 className="font-semibold text-lg">Rezervovať stôl</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stôl
                </label>
                <select
                  required
                  value={formData.tableId}
                  onChange={(e) => setFormData({ ...formData, tableId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Vyberte stôl</option>
                  {restaurant.tables.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} (max {t.capacity} osôb)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dátum</label>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split("T")[0]}
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Počet osôb
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    required
                    value={formData.partySize}
                    onChange={(e) => setFormData({ ...formData, partySize: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Od</label>
                  <input
                    type="time"
                    required
                    value={formData.timeFrom}
                    onChange={(e) => setFormData({ ...formData, timeFrom: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Do</label>
                  <input
                    type="time"
                    required
                    value={formData.timeTo}
                    onChange={(e) => setFormData({ ...formData, timeTo: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vaše meno
                </label>
                <input
                  type="text"
                  required
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Jan Novák"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={formData.customerEmail}
                  onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="jan@example.cz"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefón</label>
                <input
                  type="tel"
                  required
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="+420 777 123 456"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Poznámka (nepovinné)
                </label>
                <textarea
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  rows={2}
                  placeholder="Narodeninová večera, alergény..."
                />
              </div>

              {submitError && (
                <p className="text-red-500 text-sm text-center">{submitError}</p>
              )}
              <button
                type="submit"
                disabled={submitLoading}
                className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 transition"
              >
                {submitLoading ? "Spracovávam..." : `Pokračovať k platbe (${depositCzk} Kč)`}
              </button>
            </form>
          )}

          {step === "payment" && clientSecret && (
            <div className="space-y-4">
              <h2 className="font-semibold text-lg">Zadajte platobnú kartu</h2>
              <p className="text-sm text-gray-500">
                Na karte bude zablokovaných <strong>{depositCzk} Kč</strong>. Suma
                nebude okamžite strhnutá.
              </p>
              <Elements
                stripe={stripePromise}
                options={{ clientSecret, locale: "cs" }}
              >
                <PaymentForm
                  clientSecret={clientSecret}
                  onSuccess={() => setStep("success")}
                />
              </Elements>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

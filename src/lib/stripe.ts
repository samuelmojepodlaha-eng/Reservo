import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-05-27.dahlia",
});

export async function createPaymentHold(params: {
  amount: number; // v halieroch
  customerEmail: string;
  restaurantName: string;
  reservationDate: string;
}) {
  return stripe.paymentIntents.create({
    amount: params.amount,
    currency: "czk",
    capture_method: "manual", // blokácia, nie strhnutie
    metadata: {
      restaurantName: params.restaurantName,
      reservationDate: params.reservationDate,
    },
    receipt_email: params.customerEmail,
    description: `Záloha za rezerváciu - ${params.restaurantName}`,
  });
}

export async function capturePayment(paymentIntentId: string) {
  return stripe.paymentIntents.capture(paymentIntentId);
}

export async function cancelPayment(paymentIntentId: string) {
  return stripe.paymentIntents.cancel(paymentIntentId);
}

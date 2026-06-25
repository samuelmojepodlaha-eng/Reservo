import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockUpdateMany = vi.fn();
const mockConstructEvent = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    reservation: {
      updateMany: mockUpdateMany,
    },
  },
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    webhooks: {
      constructEvent: mockConstructEvent,
    },
  },
}));

const { POST } = await import("@/app/api/webhooks/stripe/route");

function makeWebhookRequest(body: string) {
  return new NextRequest("http://localhost/api/webhooks/stripe", {
    method: "POST",
    body,
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": "test-sig",
    },
  });
}

describe("Stripe webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("odmietne požiadavku s neplatným podpisom", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    const res = await POST(makeWebhookRequest("{}"));

    expect(res.status).toBe(400);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("amount_capturable_updated → PENDING rezervácia sa stane CONFIRMED", async () => {
    mockConstructEvent.mockReturnValue({
      type: "payment_intent.amount_capturable_updated",
      data: { object: { id: "pi_test_123" } },
    });

    const res = await POST(makeWebhookRequest("{}"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.received).toBe(true);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { stripePaymentIntentId: "pi_test_123", status: "PENDING" },
      data: { status: "CONFIRMED" },
    });
  });

  it("payment_failed → rezervácia sa zruší a platba sa uvoľní", async () => {
    mockConstructEvent.mockReturnValue({
      type: "payment_intent.payment_failed",
      data: { object: { id: "pi_test_failed" } },
    });

    const res = await POST(makeWebhookRequest("{}"));

    expect(res.status).toBe(200);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { stripePaymentIntentId: "pi_test_failed" },
      data: { status: "CANCELLED", paymentStatus: "RELEASED" },
    });
  });

  it("amount_capturable_updated nesmie meniť CONFIRMED alebo iné stavy — len PENDING", async () => {
    mockConstructEvent.mockReturnValue({
      type: "payment_intent.amount_capturable_updated",
      data: { object: { id: "pi_test_123" } },
    });

    await POST(makeWebhookRequest("{}"));

    // Kľúčové: where obsahuje status: "PENDING" — nesmie prepísať ARRIVED/NO_SHOW
    const call = mockUpdateMany.mock.calls[0][0];
    expect(call.where.status).toBe("PENDING");
  });

  it("neznámy event type sa ignoruje bez chyby", async () => {
    mockConstructEvent.mockReturnValue({
      type: "customer.created",
      data: { object: {} },
    });

    const res = await POST(makeWebhookRequest("{}"));

    expect(res.status).toBe(200);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });
});

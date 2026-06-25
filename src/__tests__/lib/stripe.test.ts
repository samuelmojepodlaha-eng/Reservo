import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Stripe SDK pred importom stripe.ts
const mockCreate = vi.fn();
const mockCapture = vi.fn();
const mockCancel = vi.fn();

vi.mock("stripe", () => {
  return {
    default: class MockStripe {
      paymentIntents = {
        create: mockCreate,
        capture: mockCapture,
        cancel: mockCancel,
      };
    },
  };
});

// Importujeme AŽ po mocku
const { createPaymentHold, capturePayment, cancelPayment } = await import(
  "@/lib/stripe"
);

describe("createPaymentHold", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({
      id: "pi_test_123",
      client_secret: "pi_test_123_secret",
    });
  });

  it("vždy používa capture_method: manual — bez tohto by sa zákazníkom stiahli peniaze okamžite", async () => {
    await createPaymentHold({
      amount: 100000,
      customerEmail: "test@test.cz",
      restaurantName: "Test Reštaurácia",
      reservationDate: "2026-07-01 18:00",
    });

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.capture_method).toBe("manual");
  });

  it("používa menu czk", async () => {
    await createPaymentHold({
      amount: 100000,
      customerEmail: "test@test.cz",
      restaurantName: "Test",
      reservationDate: "2026-07-01 18:00",
    });

    expect(mockCreate.mock.calls[0][0].currency).toBe("czk");
  });

  it("posiela receipt_email zákazníkovi", async () => {
    await createPaymentHold({
      amount: 100000,
      customerEmail: "zakaznik@test.cz",
      restaurantName: "Test",
      reservationDate: "2026-07-01 18:00",
    });

    expect(mockCreate.mock.calls[0][0].receipt_email).toBe("zakaznik@test.cz");
  });

  it("vracia client_secret z PaymentIntent", async () => {
    const result = await createPaymentHold({
      amount: 50000,
      customerEmail: "x@x.cz",
      restaurantName: "X",
      reservationDate: "2026-07-01 18:00",
    });

    expect(result.client_secret).toBe("pi_test_123_secret");
  });
});

describe("capturePayment", () => {
  it("volá stripe.paymentIntents.capture so správnym ID", async () => {
    mockCapture.mockResolvedValue({ id: "pi_test_123", status: "succeeded" });

    await capturePayment("pi_test_123");

    expect(mockCapture).toHaveBeenCalledWith("pi_test_123");
  });
});

describe("cancelPayment", () => {
  it("volá stripe.paymentIntents.cancel so správnym ID", async () => {
    mockCancel.mockResolvedValue({ id: "pi_test_123", status: "canceled" });

    await cancelPayment("pi_test_123");

    expect(mockCancel).toHaveBeenCalledWith("pi_test_123");
  });
});

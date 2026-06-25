import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockCapture = vi.fn();
const mockCancel = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    reservation: {
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
  },
}));

vi.mock("@/lib/stripe", () => ({
  capturePayment: mockCapture,
  cancelPayment: mockCancel,
}));

const { POST } = await import(
  "@/app/api/reservations/[id]/action/route"
);

function makeRequest(action: string) {
  return new NextRequest("http://localhost/api/reservations/test-id/action", {
    method: "POST",
    body: JSON.stringify({ action }),
    headers: { "Content-Type": "application/json" },
  });
}

const params = Promise.resolve({ id: "test-reservation-id" });

const confirmedReservation = {
  id: "test-reservation-id",
  status: "CONFIRMED",
  paymentStatus: "HELD",
  stripePaymentIntentId: "pi_test_123",
};

describe("action route — arrived", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue({});
    mockCapture.mockResolvedValue({});
  });

  it("úspešne spracuje príchod zákazníka", async () => {
    mockFindUnique.mockResolvedValue(confirmedReservation);

    const res = await POST(makeRequest("arrived"), { params });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockCapture).toHaveBeenCalledWith("pi_test_123");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "ARRIVED", paymentStatus: "CAPTURED" },
      })
    );
  });

  it("odmietne capture ak paymentStatus nie je HELD", async () => {
    mockFindUnique.mockResolvedValue({
      ...confirmedReservation,
      paymentStatus: "CAPTURED",
    });

    const res = await POST(makeRequest("arrived"), { params });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(mockCapture).not.toHaveBeenCalled();
    expect(body.error).toBeTruthy();
  });
});

describe("action route — noshow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue({});
    mockCapture.mockResolvedValue({});
  });

  it("stiahne zálohu pri no-show", async () => {
    mockFindUnique.mockResolvedValue(confirmedReservation);

    const res = await POST(makeRequest("noshow"), { params });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockCapture).toHaveBeenCalledWith("pi_test_123");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "NO_SHOW", paymentStatus: "CAPTURED" },
      })
    );
  });

  it("odmietne no-show ak paymentStatus nie je HELD", async () => {
    mockFindUnique.mockResolvedValue({
      ...confirmedReservation,
      paymentStatus: "CAPTURED",
    });

    const res = await POST(makeRequest("noshow"), { params });

    expect(res.status).toBe(400);
    expect(mockCapture).not.toHaveBeenCalled();
  });
});

describe("action route — cancel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue({});
    mockCancel.mockResolvedValue({});
  });

  it("zruší rezerváciu a uvoľní hold", async () => {
    mockFindUnique.mockResolvedValue(confirmedReservation);

    const res = await POST(makeRequest("cancel"), { params });

    expect(res.status).toBe(200);
    expect(mockCancel).toHaveBeenCalledWith("pi_test_123");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "CANCELLED", paymentStatus: "RELEASED" },
      })
    );
  });

  it("zruší rezerváciu aj bez platby (paymentStatus != HELD)", async () => {
    mockFindUnique.mockResolvedValue({
      ...confirmedReservation,
      paymentStatus: "RELEASED",
    });

    const res = await POST(makeRequest("cancel"), { params });

    expect(res.status).toBe(200);
    // cancel() sa nevolá ak hold už neexistuje
    expect(mockCancel).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalled();
  });
});

describe("action route — ochrana stavového automatu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["ARRIVED", "NO_SHOW", "CANCELLED"] as const)(
    "odmietne akúkoľvek akciu na uzavretú rezerváciu (status: %s)",
    async (status) => {
      mockFindUnique.mockResolvedValue({
        ...confirmedReservation,
        status,
      });

      for (const action of ["arrived", "noshow", "cancel"]) {
        vi.clearAllMocks();
        mockFindUnique.mockResolvedValue({ ...confirmedReservation, status });

        const res = await POST(makeRequest(action), { params });
        expect(res.status).toBe(400);
        expect(mockCapture).not.toHaveBeenCalled();
        expect(mockCancel).not.toHaveBeenCalled();
      }
    }
  );

  it("vráti 404 ak rezervácia neexistuje", async () => {
    mockFindUnique.mockResolvedValue(null);

    const res = await POST(makeRequest("arrived"), { params });

    expect(res.status).toBe(404);
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("vráti 400 pre neznámu akciu", async () => {
    mockFindUnique.mockResolvedValue(confirmedReservation);

    const res = await POST(makeRequest("delete_everything"), { params });

    expect(res.status).toBe(400);
    expect(mockCapture).not.toHaveBeenCalled();
    expect(mockCancel).not.toHaveBeenCalled();
  });
});

import { hashSync } from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueMock, logSecurityEventMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  logSecurityEventMock: vi.fn(),
}));

vi.mock("@/lib/convex-client", () => ({
  getConvexClient: () => null,
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: findUniqueMock,
    },
  },
}));

vi.mock("@/lib/security", () => ({
  logSecurityEvent: logSecurityEventMock,
}));

import { cookieAuthAdapter } from "@/lib/auth/cookie-adapter";

describe("cookieAuthAdapter.signInWithCredentials", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    logSecurityEventMock.mockReset();
  });

  it("normalizes email lookup and compares bcrypt password hash", async () => {
    const password = "Password123!";
    findUniqueMock.mockResolvedValue({
      id: "user-1",
      email: "tester@example.com",
      name: "Tester",
      roleGlobal: "USER",
      passwordHash: hashSync(password, 12),
      pinHash: hashSync("1234", 12),
    });

    const result = await cookieAuthAdapter.signInWithCredentials({
      email: "  Tester@Example.COM ",
      password,
    });

    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { email: "tester@example.com" },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.id).toBe("user-1");
    }
  });

  it("normalizes login name lookup and compares bcrypt pin hash", async () => {
    const pin = "9876";
    findUniqueMock.mockResolvedValue({
      id: "user-2",
      email: "pin@example.com",
      name: "Pin User",
      roleGlobal: "USER",
      passwordHash: hashSync("AnotherPassword123!", 12),
      pinHash: hashSync(pin, 12),
    });

    const result = await cookieAuthAdapter.signInWithCredentials({
      loginName: "  Pin.User ",
      pin,
    });

    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { loginName: "pin.user" },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.id).toBe("user-2");
    }
  });

  it("preserves leading-zero pin values", async () => {
    const pin = "0123";
    findUniqueMock.mockResolvedValue({
      id: "user-3",
      email: "zero@example.com",
      name: "Zero Pin",
      roleGlobal: "USER",
      passwordHash: hashSync("AnotherPassword123!", 12),
      pinHash: hashSync(pin, 12),
    });

    const result = await cookieAuthAdapter.signInWithCredentials({
      loginName: "zero.user",
      pin,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.id).toBe("user-3");
    }
  });

  it("rejects wrong pin credentials", async () => {
    findUniqueMock.mockResolvedValue({
      id: "user-4",
      email: "wrong@example.com",
      name: "Wrong Pin",
      roleGlobal: "USER",
      passwordHash: hashSync("AnotherPassword123!", 12),
      pinHash: hashSync("0123", 12),
    });

    const result = await cookieAuthAdapter.signInWithCredentials({
      loginName: "wrong.user",
      pin: "9999",
    });

    expect(result).toEqual({
      ok: false,
      message: "Invalid credentials.",
    });
  });
});

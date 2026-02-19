import { hashSync } from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueMock, logSecurityEventMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  logSecurityEventMock: vi.fn(),
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
});

import { describe, it, expect } from "vitest";
import { isVersionSkewError } from "@/lib/is-version-skew";

describe("isVersionSkewError", () => {
  it("detects the older Next wording", () => {
    expect(isVersionSkewError({ message: "Failed to find Server Action \"abc\". This request might be from an older or newer deployment." })).toBe(true);
  });

  it("detects the newer Next 16 wording (was not found on the server)", () => {
    // Exactly what the error monitor received on /hiring.
    const message =
      'Server Action "407bc60c756eccdabe557ff99c58f35c348a57b682" was not found on the server. \nRead more: https://nextjs.org/docs/messages/failed-to-find-server-action';
    expect(isVersionSkewError({ message })).toBe(true);
  });

  it("detects it from the UnrecognizedActionError class name alone", () => {
    expect(isVersionSkewError({ message: "UnrecognizedActionError: something" })).toBe(true);
  });

  it("detects it from the digest", () => {
    expect(isVersionSkewError({ message: "", digest: "failed to find server action 123" })).toBe(true);
  });

  it("does not flag an unrelated error", () => {
    expect(isVersionSkewError({ message: "Cannot read properties of undefined (reading 'map')" })).toBe(false);
    expect(isVersionSkewError({ message: "User not found" })).toBe(false);
    expect(isVersionSkewError({ message: "Database connection timed out" })).toBe(false);
    expect(isVersionSkewError(null)).toBe(false);
  });
});

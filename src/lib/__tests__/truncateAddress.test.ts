/**
 * Tests for truncateAddress — fixes #487
 *
 * Verifies that truncateAddress normalises the address to uppercase before
 * slicing so the displayed short form is consistent regardless of the casing
 * of the stored address string.
 */
import { describe, it, expect } from "vitest";
import { truncateAddress } from "../sorostream";

describe("truncateAddress (#487)", () => {
  it("returns empty string for empty input", () => {
    expect(truncateAddress("")).toBe("");
  });

  it("truncates a normal all-uppercase Stellar address correctly", () => {
    const addr = "GBAM1234ABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQXDRL";
    const result = truncateAddress(addr);
    expect(result).toBe(`${addr.slice(0, 4)}...${addr.slice(-4)}`);
  });

  it("normalises a lowercase address to uppercase before truncating", () => {
    // Simulate a scenario where the stored address has lowercase characters
    const mixed  = "gbaM1234abcdefghijklmnopqrstuvwxyz234567abcdefghijklmnopqxDrL";
    const upper  = mixed.toUpperCase();
    const result = truncateAddress(mixed);
    expect(result).toBe(`${upper.slice(0, 4)}...${upper.slice(-4)}`);
  });

  it("normalises a mixed-case address consistently", () => {
    const addr = "GBAm1234XdRl5678ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopq";
    const result = truncateAddress(addr);
    // First 4 and last 4 chars of the uppercased address
    const upper = addr.toUpperCase();
    expect(result.startsWith(upper.slice(0, 4))).toBe(true);
    expect(result.endsWith(upper.slice(-4))).toBe(true);
  });

  it("returns the same truncated form regardless of input casing", () => {
    const base  = "GBAM5678ABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQXDRL";
    const lower = base.toLowerCase();
    const mixed = base
      .split("")
      .map((c, i) => (i % 2 === 0 ? c.toLowerCase() : c))
      .join("");

    expect(truncateAddress(base)).toBe(truncateAddress(lower));
    expect(truncateAddress(base)).toBe(truncateAddress(mixed));
  });
});

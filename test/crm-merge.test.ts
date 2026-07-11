import { describe, it, expect } from "vitest";
import { renderMerge, CRM_REPLY_TO } from "@/lib/crm-merge";

describe("renderMerge", () => {
  it("resolves {{first_name}} from the contact name", () => {
    expect(renderMerge("Hi {{first_name}},", { name: "Dana Lopez", fields: {} })).toBe("Hi Dana,");
  });

  it("falls back to a neutral greeting when the name is missing", () => {
    expect(renderMerge("Hi {{first_name}},", { name: null, fields: {} })).toBe("Hi there,");
  });

  it("formats currency contact fields", () => {
    const out = renderMerge("{{contact.calc_annual_upside}}", { name: null, fields: { calc_annual_upside: 42350 } });
    expect(out).toBe("$42,350");
  });

  it("uses a neutral fallback for a missing field instead of a blank", () => {
    const out = renderMerge("worth {{contact.calc_annual_upside}} a year", { name: null, fields: {} });
    expect(out).not.toContain("{{");
    expect(out).not.toContain("$");
    expect(out.length).toBeGreaterThan("worth  a year".length);
  });

  it("renders a plain (non-currency) field as-is", () => {
    expect(renderMerge("{{contact.scorecard_gap_1}}", { name: null, fields: { scorecard_gap_1: "Retention tracking" } })).toBe(
      "Retention tracking"
    );
  });

  it("substitutes the calendar links", () => {
    const booking = renderMerge("{{calendar.booking_link}}", { name: null, fields: {} });
    const onboarding = renderMerge("{{calendar.onboarding_link}}", { name: null, fields: {} });
    expect(booking).toMatch(/^https?:\/\//);
    expect(onboarding).toMatch(/^https?:\/\//);
  });

  it("replies route to hello@joinwingman.app", () => {
    expect(CRM_REPLY_TO).toBe("hello@joinwingman.app");
  });
});

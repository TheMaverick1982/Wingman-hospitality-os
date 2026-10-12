import { describe, it, expect } from "vitest";
import { scoreContactSpam, CONTACT_SPAM_THRESHOLD } from "@/lib/contact-spam";

describe("scoreContactSpam", () => {
  it("flags the real bot submissions that slipped past the filters", () => {
    // Two actual submissions from the contact form inbox.
    const a = scoreContactSpam({
      name: "LLDYCeglsYsHyIFByugyQtX",
      email: "b.ri.t.tan.y.ccz.r.jv.w.a.rd@gmail.com",
      phone: "3171379623",
      message: "2663034692",
    });
    expect(a.isSpam).toBe(true);
    expect(a.reasons).toContain("gibberish-name");
    expect(a.reasons.some((r) => r.startsWith("gmail-dots"))).toBe(true);

    const b = scoreContactSpam({
      name: "tfEmweDRTaNKxYSaq",
      email: "woo.dmi.c.hel.l.e.h.x6f.e.ozg4.a@gmail.com",
      phone: "8984926781",
      message: "5806556137",
    });
    expect(b.isSpam).toBe(true);
  });

  it("leaves a normal lead alone", () => {
    const r = scoreContactSpam({
      name: "Jane Doe",
      email: "jane@squarepegpizza.com",
      phone: "(555) 123-4567",
      message: "We run three locations and want to cut churn — can we talk?",
    });
    expect(r.score).toBe(0);
    expect(r.isSpam).toBe(false);
  });

  it("does not flag a real Gmail lead with an ordinary dotted address", () => {
    const r = scoreContactSpam({
      name: "John Smith",
      email: "john.smith@gmail.com",
      phone: "555-867-5309",
      message: "Interested in a demo for my cafe.",
    });
    expect(r.isSpam).toBe(false);
  });

  it("does not flag a single strong signal on its own (needs corroboration)", () => {
    // A long single-token name alone, with an otherwise clean submission, stays
    // under the threshold — we only suppress when signals stack up.
    const r = scoreContactSpam({
      name: "Konstantinos",
      email: "k@example.com",
      phone: "5551234567",
      message: "Hi there, I'd love to learn more.",
    });
    expect(r.isSpam).toBe(false);
    expect(r.score).toBeLessThan(CONTACT_SPAM_THRESHOLD);
  });

  it("catches a vowelless name combined with the Gmail dot-trick", () => {
    const r = scoreContactSpam({
      name: "Xkcdfghjklmn",
      email: "x.k.c.d.f.g.h@gmail.com",
      phone: "5551112222",
      message: "4443332211",
    });
    expect(r.isSpam).toBe(true);
  });
});

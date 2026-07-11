"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";

// Public pre-sales chat widget. Shown only on marketing pages (self-gated by
// pathname), never in the app or on the demo funnel. Talks to /api/sales-chat.

type Msg = { role: "user" | "assistant"; content: string };

const MARKETING_PATHS = ["/pricing", "/how-it-works", "/calculator", "/scorecard", "/book-a-demo", "/privacy", "/terms", "/api-guide"];

const STARTERS = ["What does it cost?", "How is this different from my POS?", "How fast can we set up?", "Can I see it?"];

const GREETING =
  "Hey! I'm Wingman's assistant. Ask me anything about how it works, pricing, or getting started — or [try the live demo](/demo) right now.";

const CTAS = [
  { href: "/demo", label: "Try the live demo" },
  { href: "/book-a-demo", label: "Book a call" },
  { href: "/signup", label: "Get started" },
];

// Render assistant text with [label](/path) markdown links as real links.
function renderRich(text: string) {
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  const out: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(<Fragment key={key++}>{text.slice(last, m.index)}</Fragment>);
    const [full, label, url] = m;
    out.push(
      url.startsWith("/") ? (
        <Link key={key++} href={url} className="font-semibold text-brick underline underline-offset-2">
          {label}
        </Link>
      ) : (
        <a key={key++} href={url} target="_blank" rel="noopener noreferrer" className="font-semibold text-brick underline underline-offset-2">
          {label}
        </a>
      )
    );
    last = m.index + full.length;
  }
  if (last < text.length) out.push(<Fragment key={key++}>{text.slice(last)}</Fragment>);
  return out;
}

export function SalesChat() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, open]);

  const show = pathname === "/" || MARKETING_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (!show) return null;

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setError(null);
    const next = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/sales-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Something went wrong. Please try again.");
      } else {
        setMessages((m) => [...m, { role: "assistant", content: data.reply as string }]);
      }
    } catch {
      setError("Couldn't reach us just now. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 print:hidden force-light">
      {open && (
        <div className="mb-3 w-[min(93vw,384px)] h-[min(72vh,580px)] bg-white border border-line rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-brick/10 flex items-center justify-center">
                <Sparkles size={15} className="text-brick" />
              </div>
              <div className="leading-tight">
                <div className="text-[14px] font-semibold text-ink">Chat with Wingman</div>
                <div className="text-[11px] text-muted-2">Sales &amp; questions · replies instantly</div>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close chat" className="text-muted-2 hover:text-ink text-xl leading-none px-1">
              ×
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
            <div className="max-w-[85%] self-start text-[13.5px] leading-[1.5] text-ink bg-paper rounded-2xl rounded-tl-sm px-3.5 py-2.5 whitespace-pre-line">
              {renderRich(GREETING)}
            </div>

            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] text-[13.5px] leading-[1.5] rounded-2xl px-3.5 py-2.5 whitespace-pre-line ${
                  m.role === "user" ? "self-end bg-brick text-white rounded-tr-sm" : "self-start bg-paper text-ink rounded-tl-sm"
                }`}
              >
                {m.role === "assistant" ? renderRich(m.content) : m.content}
              </div>
            ))}

            {loading && (
              <div className="self-start bg-paper rounded-2xl rounded-tl-sm px-3.5 py-3 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-2 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-2 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-2 animate-bounce" />
              </div>
            )}

            {messages.length === 0 && (
              <div className="flex flex-wrap gap-2 mt-1">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="text-left text-[12.5px] font-medium text-charcoal-2 bg-white border border-line rounded-full px-3 py-1.5 hover:border-brick hover:text-brick transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {error && <div className="self-start text-[12.5px] text-danger">{error}</div>}
          </div>

          {/* Persistent CTAs */}
          <div className="flex items-center gap-1.5 px-3 pt-2.5 border-t border-line">
            {CTAS.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className="flex-1 text-center text-[12px] font-semibold text-brick bg-brick/5 hover:bg-brick/10 rounded-lg px-2 py-1.5 transition-colors"
              >
                {c.label}
              </Link>
            ))}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about pricing, setup…"
              className="flex-1 text-[14px] bg-paper border border-line rounded-full px-4 py-2.5 outline-none focus:border-brick text-ink placeholder:text-muted-2"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Send"
              className="shrink-0 w-9 h-9 rounded-full bg-brick text-white flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <span className="text-lg leading-none">↑</span>}
            </button>
          </form>
        </div>
      )}

      {/* Launcher */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="ml-auto flex items-center gap-2 bg-brick text-white rounded-full pl-4 pr-5 py-3 shadow-lg hover:bg-brick-dark transition-colors"
      >
        <Sparkles size={17} />
        <span className="text-[14px] font-semibold">{open ? "Close" : "Chat with us"}</span>
      </button>
    </div>
  );
}

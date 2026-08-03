"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Sparkles, Check } from "lucide-react";

type Msg = {
  role: "user" | "assistant";
  content: string;
  reported?: { type: "bug" | "idea"; title: string } | null;
  error?: boolean;
};

const GREETING: Msg = {
  role: "assistant",
  content:
    "Hi — I'm the Wingman assistant. Ask me how to use the app, or how things work here at your restaurant — your role's standards, the menu, allergens, or your team's own policies. Hit a bug or have an idea? Tell me and I'll pass it to the team.",
};

const STARTERS = [
  "What's expected of me in my role?",
  "Does the [dish] have any allergens?",
  "How do I log a return visit?",
  "What does my repeat rate mean?",
];

export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, loading]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function send(raw?: string) {
    const text = (raw ?? input).trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, content: m.content })) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((m) => [...m, { role: "assistant", content: data.error || "Something went wrong. Please try again.", error: true }]);
      } else {
        setMessages((m) => [...m, { role: "assistant", content: data.reply, reported: data.reported }]);
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "I couldn't reach the server. Please try again.", error: true }]);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 print:hidden" data-tour="assistant">
      {open && (
        <div className="mb-3 w-[min(92vw,380px)] h-[min(70vh,560px)] bg-white border border-line rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-white">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-brick/10 flex items-center justify-center">
                <Sparkles size={15} className="text-brick" />
              </div>
              <div className="leading-tight">
                <div className="text-[14px] font-semibold text-ink">Ask Wingman</div>
                <div className="text-[11px] text-muted-2">Help &amp; how-to</div>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant" className="text-muted-2 hover:text-ink p-1">
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 bg-paper">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "self-end max-w-[85%]" : "self-start max-w-[90%]"}>
                <div
                  className={`rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-brick text-white rounded-br-md"
                      : m.error
                        ? "bg-white border border-danger/30 text-danger rounded-bl-md"
                        : "bg-white border border-line text-charcoal-2 rounded-bl-md"
                  }`}
                >
                  {m.content}
                </div>
                {m.reported && (
                  <div className="mt-1.5 inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                    <Check size={12} /> Reported to the team · {m.reported.type === "bug" ? "Bug" : "Idea"}
                  </div>
                )}
              </div>
            ))}
            {messages.length === 1 && !loading && (
              <div className="flex flex-col gap-1.5 mt-1">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="self-start text-left text-[13px] font-medium text-charcoal-2 bg-white border border-line rounded-full px-3 py-1.5 hover:border-brick hover:text-brick transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {loading && (
              <div className="self-start">
                <div className="bg-white border border-line rounded-2xl rounded-bl-md px-3.5 py-3 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-2 animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-2 animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-2 animate-bounce" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-line bg-white p-2.5">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder="Ask a question, or report a bug…"
                className="flex-1 resize-none max-h-28 text-[14px] text-ink placeholder:text-muted-2 outline-none px-2 py-1.5"
              />
              <button
                type="button"
                onClick={() => send()}
                disabled={!input.trim() || loading}
                aria-label="Send message"
                className="shrink-0 w-9 h-9 rounded-full bg-brick text-white flex items-center justify-center disabled:opacity-40 hover:opacity-90"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close assistant" : "Open the Wingman assistant"}
        className="ml-auto flex items-center justify-center w-14 h-14 rounded-full bg-brick text-white shadow-xl hover:opacity-90 transition-opacity"
      >
        {open ? <X size={22} /> : <MessageCircle size={24} />}
      </button>
    </div>
  );
}

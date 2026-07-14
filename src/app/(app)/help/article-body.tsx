import { Lightbulb, Info, FileText, ArrowUpRight } from "lucide-react";
import type { HelpBlock } from "@/lib/help-content";
import { HelpDiagram } from "./help-diagram";

export function ArticleBody({ blocks }: { blocks: HelpBlock[] }) {
  return (
    <div className="flex flex-col gap-4">
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "h":
            return (
              <h2 key={i} className="text-[17px] font-semibold tracking-[-0.01em] text-ink mt-2">
                {b.text}
              </h2>
            );
          case "p":
            return (
              <p key={i} className="text-[15px] leading-relaxed text-charcoal-2">
                {b.text}
              </p>
            );
          case "steps":
            return (
              <ol key={i} className="flex flex-col gap-2.5">
                {b.items.map((item, j) => (
                  <li key={j} className="flex gap-3 text-[15px] text-charcoal-2">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-brick-tint text-brick text-[13px] font-semibold flex items-center justify-center">
                      {j + 1}
                    </span>
                    <span className="pt-0.5">{item}</span>
                  </li>
                ))}
              </ol>
            );
          case "list":
            return (
              <ul key={i} className="flex flex-col gap-2">
                {b.items.map((item, j) => (
                  <li key={j} className="flex gap-2.5 text-[15px] text-charcoal-2">
                    <span className="shrink-0 mt-2 w-1.5 h-1.5 rounded-full bg-brick" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            );
          case "tip":
            return (
              <div key={i} className="flex gap-2.5 rounded-xl bg-olive-tint px-4 py-3">
                <Lightbulb size={17} className="text-[#15803d] shrink-0 mt-0.5" />
                <p className="text-sm text-[#15803d] leading-relaxed">{b.text}</p>
              </div>
            );
          case "note":
            return (
              <div key={i} className="flex gap-2.5 rounded-xl bg-paper border border-line px-4 py-3">
                <Info size={17} className="text-muted shrink-0 mt-0.5" />
                <p className="text-sm text-charcoal-2 leading-relaxed">{b.text}</p>
              </div>
            );
          case "image":
            return (
              <figure key={i} className="my-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.src} alt={b.alt} className="rounded-xl border border-line max-w-full" />
                {b.caption && <figcaption className="text-xs text-muted-2 mt-1.5">{b.caption}</figcaption>}
              </figure>
            );
          case "button":
            return (
              <div key={i}>
                <a
                  href={b.href}
                  target={b.external ? "_blank" : undefined}
                  rel={b.external ? "noopener noreferrer" : undefined}
                  className="inline-flex items-center gap-2 rounded-full bg-brick text-sm font-semibold text-white px-4 py-2.5 shadow-sm hover:bg-brick-dark transition-colors"
                >
                  <FileText size={16} /> {b.label}
                  {b.external && <ArrowUpRight size={15} className="opacity-80" />}
                </a>
              </div>
            );
          case "diagram":
            return (
              <figure key={i} className="my-1">
                <HelpDiagram name={b.name} />
                {b.caption && <figcaption className="text-xs text-muted-2 mt-1.5 text-center">{b.caption}</figcaption>}
              </figure>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

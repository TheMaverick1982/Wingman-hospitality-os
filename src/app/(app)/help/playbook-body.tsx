// Renders a team-playbook article's plain-text body with light formatting:
//   "# heading"   -> a heading line
//   "- bullet"    -> a bulleted list (consecutive lines group together)
//   blank line    -> paragraph break
// Everything else is a paragraph. No markdown dependency — keeps it simple and
// safe (plain text, so no HTML injection).
export function PlaybookBody({ body }: { body: string }) {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const blocks: { kind: "h" | "p" | "ul"; content: string | string[] }[] = [];
  let paragraph: string[] = [];
  let bullets: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ kind: "p", content: paragraph.join(" ") });
      paragraph = [];
    }
  };
  const flushBullets = () => {
    if (bullets.length) {
      blocks.push({ kind: "ul", content: bullets });
      bullets = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (line === "") {
      flushParagraph();
      flushBullets();
      continue;
    }
    if (line.startsWith("# ")) {
      flushParagraph();
      flushBullets();
      blocks.push({ kind: "h", content: line.slice(2).trim() });
      continue;
    }
    if (line.startsWith("- ") || line.startsWith("* ")) {
      flushParagraph();
      bullets.push(line.slice(2).trim());
      continue;
    }
    flushBullets();
    paragraph.push(line);
  }
  flushParagraph();
  flushBullets();

  return (
    <div className="flex flex-col gap-4">
      {blocks.map((b, i) => {
        if (b.kind === "h") {
          return (
            <h2 key={i} className="text-[17px] font-semibold tracking-[-0.01em] text-ink mt-2">
              {b.content as string}
            </h2>
          );
        }
        if (b.kind === "ul") {
          return (
            <ul key={i} className="flex flex-col gap-2">
              {(b.content as string[]).map((item, j) => (
                <li key={j} className="flex gap-2.5 text-[15px] text-charcoal-2">
                  <span className="shrink-0 mt-2 w-1.5 h-1.5 rounded-full bg-brick" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="text-[15px] leading-relaxed text-charcoal-2 whitespace-pre-line">
            {b.content as string}
          </p>
        );
      })}
    </div>
  );
}

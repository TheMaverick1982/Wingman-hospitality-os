import { FileText, ImageIcon } from "lucide-react";

export type AttachmentView = { filename: string; url: string; contentType: string };

// Renders a message's attachments: images as thumbnails that open full-size,
// other files (PDFs) as a labeled link. URLs are short-lived signed URLs.
export function MessageAttachments({ items }: { items: AttachmentView[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {items.map((a, i) => {
        const isImage = a.contentType.startsWith("image/");
        if (isImage && a.url) {
          return (
            <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="block rounded-lg border border-line overflow-hidden hover:opacity-90">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.url} alt={a.filename} className="h-24 w-auto max-w-[180px] object-cover" />
            </a>
          );
        }
        return (
          <a
            key={i}
            href={a.url || undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-[13px] font-medium text-charcoal-2 hover:bg-paper max-w-[220px]"
          >
            {a.contentType === "application/pdf" ? <FileText size={15} className="text-brick shrink-0" /> : <ImageIcon size={15} className="text-brick shrink-0" />}
            <span className="truncate">{a.filename}</span>
          </a>
        );
      })}
    </div>
  );
}

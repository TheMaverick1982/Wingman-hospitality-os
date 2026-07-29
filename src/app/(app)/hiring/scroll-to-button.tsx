"use client";

// In this app the scroll container is #app-scroll (a nested overflow-y-auto div),
// not the window — so a native <a href="#id"> hash jump scrolls the wrong element
// and leaves the layout at an off-kilter position (clipped header / "half page").
// This scrolls the target into view inside its real scroll ancestor instead.
export function ScrollToButton({
  targetId,
  className,
  children,
}: {
  targetId: string;
  className?: string;
  children: React.ReactNode;
}) {
  function go() {
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  return (
    <button type="button" onClick={go} className={className}>
      {children}
    </button>
  );
}

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
    const target = document.getElementById(targetId);
    const scroller = document.getElementById("app-scroll");
    // Scroll ONLY the app's scroll container, computed from the target's offset
    // within it. scrollIntoView() walks up EVERY scrollable ancestor, which could
    // scroll the layout column/window and shove the sticky top bar out of view —
    // this can't. Falls back to scrollIntoView if the container isn't found.
    if (target && scroller) {
      const top = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
      scroller.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    } else {
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
  return (
    <button type="button" onClick={go} className={className}>
      {children}
    </button>
  );
}

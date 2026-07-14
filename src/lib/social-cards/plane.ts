// The exact Wingman paper-plane mark, extracted from the WingmanLogo component,
// as a standalone square SVG we can tint per color scheme and drop onto a card.
// The path lives in the logo's coordinate space; the viewBox crops to just the
// plane so it sits flush in the top-left of a card.
const PLANE_PATH =
  "M 573.839844 868.464844 L 553.496094 845.175781 C 553.113281 844.792969 552.449219 844.699219 552.070312 845.175781 L 546.460938 850.785156 C 545.222656 852.019531 543.132812 850.972656 543.039062 849.261719 L 545.605469 837.761719 L 545.890625 837.476562 L 547.316406 836.144531 L 568.324219 814.566406 C 569.085938 813.804688 568.132812 812.472656 567.183594 813.136719 L 539.617188 830.25 C 539.234375 830.441406 538.855469 830.441406 538.476562 830.15625 L 522.3125 816.941406 C 519.558594 814.183594 520.128906 809.714844 523.457031 808.289062 L 615.378906 767.984375 C 619.847656 765.988281 624.792969 770.929688 622.890625 775.492188 L 582.585938 867.324219 C 581.0625 870.652344 576.59375 871.222656 573.839844 868.464844 Z";

export function planeSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="515 762 115 115"><path d="${PLANE_PATH}" fill="${color}"/></svg>`;
}

// A data URI usable directly as an <img src> inside Satori / next/og.
export function planeDataUri(color: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(planeSvg(color)).toString("base64")}`;
}

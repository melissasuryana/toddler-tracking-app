/**
 * The Keepsake icon set: the shared stroke-icon sprite from
 * docs/design/design-directions.html (lines 2266-2331), kept as structured
 * data so web (SVG `<use>` sprite) and iOS (`react-native-svg` components)
 * render from one source of truth. No emoji in product UI.
 *
 * Every icon is `fill: none`, `stroke: currentColor`, `stroke-width: 1.7`,
 * `stroke-linecap/linejoin: round` on a 24×24 grid (`.ic` in the design doc).
 */

export type IconName =
  | "feed"
  | "diaper"
  | "sleep"
  | "meal"
  | "introduction"
  | "medical"
  | "reaction"
  | "growth"
  | "now"
  | "timeline"
  | "foods"
  | "settings"
  | "check"
  | "search";

export interface Icon {
  readonly name: IconName;
  readonly viewBox: "0 0 24 24";
  /** Inner SVG markup (paths/shapes), stroke-only. */
  readonly body: string;
}

export const ICON_SIZE = 24;
export const ICON_STROKE_WIDTH = 1.7;
const ICON_VIEW_BOX: "0 0 24 24" = "0 0 24 24";

function icon(name: IconName, body: string): Icon {
  return { name, viewBox: ICON_VIEW_BOX, body };
}

export const icons: readonly Icon[] = [
  icon(
    "feed",
    '<path d="M12 3c-4 3.5-6 6.5-6 9.5a6 6 0 0 0 12 0C18 9.5 16 6.5 12 3z" /><path d="M9.5 13.5a2.5 2.5 0 0 0 2.5 2.5" />'
  ),
  icon(
    "diaper",
    '<path d="M4 5h16v5a8 8 0 0 1-16 0V5z" /><path d="M4 10h16" /><path d="M9 14l1.5 2M15 14l-1.5 2" />'
  ),
  icon(
    "sleep",
    '<path d="M19 13.5A7.5 7.5 0 1 1 10.5 5 6 6 0 0 0 19 13.5z" />'
  ),
  icon(
    "meal",
    '<circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" />'
  ),
  icon(
    "introduction",
    '<path d="M12 4v16M12 4l-4 4M12 4l4 4" /><path d="M5 20h14" />'
  ),
  icon(
    "medical",
    '<rect x="4" y="4" width="16" height="16" rx="3" /><path d="M12 8.5v7M8.5 12h7" />'
  ),
  icon(
    "reaction",
    '<path d="M12 4L21 19H3L12 4z" /><path d="M12 10v4M12 16.8v.2" />'
  ),
  icon(
    "growth",
    '<path d="M4 20V8M4 20h16" /><path d="M8 16v-4M12 16V7M16 16v-6M20 16V5" />'
  ),
  icon("now", '<rect x="5" y="5" width="14" height="14" rx="2" />'),
  icon(
    "timeline",
    '<circle cx="12" cy="12" r="8" /><path d="M12 7.5V12l3 2" />'
  ),
  icon(
    "foods",
    '<path d="M12 20c-4.5 0-7-3-7-7 3.5 0 5 1 7 3 2-2 3.5-3 7-3 0 4-2.5 7-7 7z" /><path d="M12 16c0-5 1-9 6-12" />'
  ),
  icon(
    "settings",
    '<circle cx="12" cy="12" r="3" /><path d="M12 4v2.5M12 17.5V20M4 12h2.5M17.5 12H20M6.3 6.3l1.8 1.8M15.9 15.9l1.8 1.8M17.7 6.3l-1.8 1.8M8.1 15.9l-1.8 1.8" />'
  ),
  icon("check", '<path d="M5 12.5l4.5 4.5L19 7.5" />'),
  icon(
    "search",
    '<circle cx="11" cy="11" r="7" /><path d="M20 20l-3.8-3.8" />'
  ),
];

export function getIcon(name: IconName): Icon {
  const found = icons.find((candidate) => candidate.name === name);
  if (!found) {
    throw new Error(`Unknown Keepsake icon: ${name}`);
  }
  return found;
}

/**
 * Renders one icon as a standalone `<svg>` element. Stroke inherits
 * `currentColor`; sizing comes from the consumer (the doc uses `1em`).
 */
export function renderIconSvg(name: IconName): string {
  const def = getIcon(name);
  return (
    `<svg viewBox="${def.viewBox}" fill="none" stroke="currentColor" ` +
    `stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" ` +
    `aria-hidden="true">${def.body}</svg>`
  );
}

/**
 * Renders the whole set as a hidden `<defs>` sprite; reference symbols with
 * `<use href="#keepsake-i-feed">` etc.
 */
export function renderIconSprite(): string {
  const symbols = icons
    .map(
      (def) =>
        `<symbol id="keepsake-i-${def.name}" viewBox="${def.viewBox}">${def.body}</symbol>`
    )
    .join("");
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${symbols}</defs></svg>`;
}

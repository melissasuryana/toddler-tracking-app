/**
 * Renders a Keepsake design-system icon (`getIcon(name).body` — stroke-only
 * SVG inner markup on a 24×24 grid) as react-native-svg elements. No emoji
 * anywhere in product UI; every glyph comes from the shared icon set.
 *
 * The design doc's icon contract: fill none, stroke currentColor,
 * stroke-width 1.7, round linecap/linejoin (packages/design-system icons.ts).
 */
import { getIcon, type IconName } from "@keepsake/design-system";
import { Circle, Path, Rect, Svg } from "react-native-svg";

const STROKE_WIDTH = 1.7;

/** The three shape primitives the icon body markup uses. */
type Shape =
  | { readonly kind: "path"; readonly d: string }
  | {
      readonly kind: "circle";
      readonly cx: number;
      readonly cy: number;
      readonly r: number;
    }
  | {
      readonly kind: "rect";
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
      readonly rx?: number;
    };

function numberAttr(source: string, name: string): number | undefined {
  const match = new RegExp(`${name}="([^"]+)"`).exec(source);
  return match ? Number(match[1]) : undefined;
}

/** Parses one `<path|circle|rect … />` element into a typed shape. */
function parseShape(markup: string): Shape {
  if (markup.startsWith("<path")) {
    const d = /d="([^"]+)"/.exec(markup)?.[1];
    if (!d) throw new Error(`icon path without d: ${markup}`);
    return { kind: "path", d };
  }
  if (markup.startsWith("<circle")) {
    const cx = numberAttr(markup, "cx");
    const cy = numberAttr(markup, "cy");
    const r = numberAttr(markup, "r");
    if (cx === undefined || cy === undefined || r === undefined) {
      throw new Error(`icon circle missing attrs: ${markup}`);
    }
    return { kind: "circle", cx, cy, r };
  }
  if (markup.startsWith("<rect")) {
    const x = numberAttr(markup, "x");
    const y = numberAttr(markup, "y");
    const width = numberAttr(markup, "width");
    const height = numberAttr(markup, "height");
    if (
      x === undefined ||
      y === undefined ||
      width === undefined ||
      height === undefined
    ) {
      throw new Error(`icon rect missing attrs: ${markup}`);
    }
    return { kind: "rect", x, y, width, height, rx: numberAttr(markup, "rx") };
  }
  throw new Error(`unsupported icon shape: ${markup}`);
}

/** Splits an icon body into its element markups. */
export function parseIconBody(body: string): Shape[] {
  return body
    .split("/>")
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0)
    .map((chunk) => parseShape(`${chunk}/>`));
}

export function KeepsakeIcon({
  name,
  size = 24,
  color,
}: {
  readonly name: IconName;
  readonly size?: number;
  /** Stroke color — callers pass a theme token (the SVG's currentColor). */
  readonly color: string;
}) {
  const icon = getIcon(name);
  return (
    <Svg width={size} height={size} viewBox={icon.viewBox}>
      {parseIconBody(icon.body).map((shape, index) => {
        const key = `${name}-${index}`;
        const stroke = {
          stroke: color,
          strokeWidth: STROKE_WIDTH,
          strokeLinecap: "round" as const,
          strokeLinejoin: "round" as const,
          fill: "none",
        };
        switch (shape.kind) {
          case "path":
            return <Path key={key} d={shape.d} {...stroke} />;
          case "circle":
            return (
              <Circle
                key={key}
                cx={shape.cx}
                cy={shape.cy}
                r={shape.r}
                {...stroke}
              />
            );
          case "rect":
            return (
              <Rect
                key={key}
                x={shape.x}
                y={shape.y}
                width={shape.width}
                height={shape.height}
                rx={shape.rx}
                {...stroke}
              />
            );
        }
      })}
    </Svg>
  );
}

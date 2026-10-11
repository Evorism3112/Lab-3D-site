// Single source of truth for the hero's rotated parallax shape geometry —
// shared by TiltFrame (which renders it) and TextMask (which clips a dark
// text layer to wherever it overlaps), so the two can never drift apart.
export const HERO_ROTATE_DEG = -18;
export const HERO_PARALLAX_FACTOR = 0.35;
// Band geometry as fractions of viewport height (centre stays at 0.18).
export const HERO_BAND_TOP_VH = -0.05;
export const HERO_BAND_HEIGHT_VH = 0.46;

/** The viewport size every piece of the effect must use, so the band, the text mask and the
 *  second band all agree (CSS vh units differ from innerHeight on phones with a browser toolbar). */
export function getViewportSize(): { width: number; height: number } {
  return { width: document.documentElement.clientWidth || window.innerWidth, height: window.innerHeight };
}

// The same box as heroShapeBox() in CSS, for the first paint before the script has measured anything.
const HERO_BAND_CSS_WIDTH = "max(140vw, calc(120vw + 30vh))";
export const HERO_BAND_CSS_BOX = {
  left: `calc(50% - ${HERO_BAND_CSS_WIDTH} / 2)`,
  width: HERO_BAND_CSS_WIDTH,
  top: `${HERO_BAND_TOP_VH * 100}vh`,
  height: `${HERO_BAND_HEIGHT_VH * 100}vh`,
};

/** The band's box in pixels, relative to the top-left of the fixed full-viewport layer. */
export function heroShapeBox(viewportWidth: number, viewportHeight: number) {
  // Rotating the band pulls its short ends inward by a share of its height, so on a tall narrow
  // screen (a phone) 140% of the width is not enough and a corner of the band shows at the edge.
  const width = Math.max(1.4 * viewportWidth, 1.2 * viewportWidth + 0.3 * viewportHeight);
  return {
    left: (viewportWidth - width) / 2,
    width,
    top: HERO_BAND_TOP_VH * viewportHeight,
    height: HERO_BAND_HEIGHT_VH * viewportHeight,
  };
}

export function heroShapeTransform(scrollY: number): string {
  return `translateY(${scrollY * HERO_PARALLAX_FACTOR}px) rotate(${HERO_ROTATE_DEG}deg)`;
}

/** The shape's four corners in viewport space, for a given scroll position. */
export function heroShapeCorners(
  scrollY: number,
  viewportWidth: number,
  viewportHeight: number,
): [number, number][] {
  const { left: x0, top: y0, width: w, height: h } = heroShapeBox(viewportWidth, viewportHeight);
  const cx = x0 + w / 2;
  const cy = y0 + h / 2;
  const theta = (HERO_ROTATE_DEG * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const ty = scrollY * HERO_PARALLAX_FACTOR;

  const localCorners: [number, number][] = [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ];

  return localCorners.map(([x, y]) => {
    const rx = x * cos - y * sin;
    const ry = x * sin + y * cos;
    return [cx + rx, cy + ry + ty];
  });
}

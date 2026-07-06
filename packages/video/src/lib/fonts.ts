import { continueRender, delayRender, staticFile } from "remotion";

// Local font loading with graceful fallback: if public/fonts is empty (e.g.
// fonts not vendored yet), the token stack falls back to system sans. No
// network at render time, ever.
const WEIGHTS: Array<{ file: string; weight: string }> = [
  { file: "fonts/Inter-Medium.woff2", weight: "500" },
  { file: "fonts/Inter-Bold.woff2", weight: "700" },
  { file: "fonts/Inter-Black.woff2", weight: "900" },
];

let loaded = false;

export const ensureFonts = () => {
  if (loaded || typeof document === "undefined") return;
  loaded = true;
  for (const { file, weight } of WEIGHTS) {
    const handle = delayRender(`font ${file}`);
    const face = new FontFace("MotnSans", `url(${staticFile(file)}) format("woff2")`, {
      weight,
    });
    face
      .load()
      .then((f) => {
        document.fonts.add(f);
        continueRender(handle);
      })
      .catch(() => {
        // Missing font file → system fallback; never block the render.
        continueRender(handle);
      });
  }
};

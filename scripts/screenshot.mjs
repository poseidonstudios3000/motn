// Dev utility: screenshot a page of the running web app.
// Usage: node scripts/screenshot.mjs <url> <outfile.png> [width] [height]
import { chromium } from "playwright-core";
import fs from "node:fs";

const [url, out, w = "1440", h = "1100"] = process.argv.slice(2);
const exe = process.env.MOTN_BROWSER_EXECUTABLE
  ?? ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find((p) => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await page.screenshot({ path: out });
await browser.close();
console.log(`wrote ${out}`);

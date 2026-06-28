#!/usr/bin/env bash
# Capture docs/images/readme-screenshot.png for the README.
# Requires: API on :8000, Vite on :5173, and npx (downloads Playwright once).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/docs/images/readme-screenshot.png"
mkdir -p "$(dirname "$OUT")"

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT
cd "$TMPDIR"
npm init -y >/dev/null 2>&1
npm install playwright@1.50.0 >/dev/null 2>&1
npx playwright install chromium >/dev/null 2>&1

node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await page.getByRole('searchbox').fill('halal lunch near bugis cheap');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.waitForSelector('[data-doc-id]', { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: process.argv[1], fullPage: false });
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
" "$OUT"

echo "Wrote $OUT"

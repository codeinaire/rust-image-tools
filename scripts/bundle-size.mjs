#!/usr/bin/env node
/**
 * scripts/bundle-size.mjs
 *
 * Measures WASM, JS, and CSS bundle sizes and appends a dated block of rows
 * to bundle-sizes.md at the project root.
 *
 * Usage (from project root or web/):
 *   npm run bundle-size              # Analyse existing builds
 *   npm run bundle-size:build        # Clean + build everything, then analyse
 *
 * Requires:
 *   twiggy  (cargo install twiggy)
 *   gzip    (standard macOS / Linux)
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');

const PATHS = {
  wasmShipped:      join(ROOT, 'crates/image-converter/pkg/image_converter_bg.wasm'),
  wasmIntermediate: join(ROOT, 'target/wasm32-unknown-unknown/release/image_converter.wasm'),
  dist:             join(ROOT, 'web/dist'),
  output:           join(ROOT, 'bundle-sizes.md'),
};

const BUILD = process.argv.includes('--build');

// ── Utilities ─────────────────────────────────────────────────────────────────

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

function gzipSize(filePath) {
  return parseInt(run(`gzip -c "${filePath}" | wc -c`).trim(), 10);
}

function fmt(bytes) {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(2)} MB`;
  if (bytes >= 1_024)     return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${bytes} B`;
}

// Escape pipe characters so they don't break Markdown table cells.
function cell(s) { return String(s).replace(/\|/g, '\\|'); }

function hasCmd(cmd) {
  try { execSync(`which ${cmd}`, { stdio: 'ignore' }); return true; }
  catch { return false; }
}

// ── Build ─────────────────────────────────────────────────────────────────────

function buildAll() {
  const webDir = join(ROOT, 'web');
  console.log('  Cleaning dist/ and .astro/...');
  execSync('rm -rf dist .astro', { cwd: webDir, stdio: 'inherit' });
  console.log('  Building WASM...');
  execSync('wasm-pack build crates/image-converter --target web --release', {
    cwd: ROOT, stdio: 'inherit',
  });
  console.log('  Building frontend...');
  execSync('npx astro build', {
    cwd: webDir, stdio: 'inherit',
  });
}

// ── WASM Analysis ─────────────────────────────────────────────────────────────
//
// Release binaries have function names stripped, so twiggy reports raw section
// labels (code[0], data[0], etc.). We group these into three meaningful
// categories: Function code, Static data, and Custom sections.
//
// We run twiggy on the intermediate (pre-strip) binary when available because
// it also contains the `__wasm_bindgen_unstable` custom section, giving a more
// complete picture of where bytes originate before wasm-pack post-processes it.
// Shipped binary sizes are always read from the final pkg file.

function analyzeWasm() {
  if (!existsSync(PATHS.wasmShipped)) {
    console.error(`\n✗ Shipped WASM not found: ${PATHS.wasmShipped}`);
    console.error('  Run: npm run bundle-size:build');
    process.exit(1);
  }

  const raw = statSync(PATHS.wasmShipped).size;
  const gz  = gzipSize(PATHS.wasmShipped);

  // Prefer intermediate binary for twiggy (richer section info).
  const twiggyTarget = existsSync(PATHS.wasmIntermediate)
    ? PATHS.wasmIntermediate
    : PATHS.wasmShipped;

  let top3 = ['—', '—', '—'];

  try {
    const json  = run(`twiggy top -n 99999 -f json "${twiggyTarget}"`);
    const items = JSON.parse(json);

    // Aggregate into semantic buckets.
    let codeBytes = 0, codeCount = 0;
    let dataBytes = 0, dataCount = 0;
    const customMap = {};          // section-name → bytes
    let   otherBytes = 0;

    for (const { name, shallow_size: bytes } of items) {
      if (name.startsWith('code[')) {
        codeBytes += bytes; codeCount++;
      } else if (name.startsWith('data[')) {
        dataBytes += bytes; dataCount++;
      } else if (name.startsWith('custom section')) {
        const match = name.match(/custom section '([^']+)'/);
        const key   = match ? match[1] : name;
        customMap[key] = (customMap[key] ?? 0) + bytes;
      } else {
        otherBytes += bytes; // type, import, export, table entries — tiny
      }
    }

    const totalTracked =
      codeBytes + dataBytes +
      Object.values(customMap).reduce((s, v) => s + v, 0) +
      otherBytes;

    const pct = (b) =>
      totalTracked > 0 ? ((b / totalTracked) * 100).toFixed(1) : '0.0';

    const candidates = [
      { label: `Fn code (${codeCount} fns)`,                   bytes: codeBytes },
      { label: `Static data (${dataCount} seg${dataCount !== 1 ? 's' : ''})`, bytes: dataBytes },
      ...Object.entries(customMap).map(([k, v]) => ({
        label: `Custom: ${k.slice(0, 28)}`, bytes: v,
      })),
    ]
      .filter(c => c.bytes > 0)
      .sort((a, b) => b.bytes - a.bytes);

    top3 = candidates.slice(0, 3).map(c =>
      cell(`${c.label}: ${fmt(c.bytes)} (${pct(c.bytes)}%)`)
    );
    while (top3.length < 3) top3.push('—');

  } catch {
    console.warn('  ⚠  twiggy analysis failed — top contributors unavailable');
    top3 = ['(twiggy error)', '—', '—'];
  }

  return { raw, gz, top3 };
}

// ── JS / CSS Analysis ─────────────────────────────────────────────────────────
//
// Astro accumulates content-hashed files across builds in dist/.
// We select only files from the most recent build for a given extension by
// taking those within FRESHNESS_MS of the newest mtime for that extension.

const FRESHNESS_MS = 60 * 1000; // 60-second window — wide enough for a single build, narrow enough to exclude stale files from previous runs

function analyzeAssets(ext) {
  if (!existsSync(PATHS.dist)) {
    console.error(`\n✗ dist/ not found: ${PATHS.dist}`);
    console.error('  Run: npm run bundle-size:build');
    process.exit(1);
  }

  const all = readdirSync(PATHS.dist, { recursive: true })
    .filter(f => extname(f).toLowerCase() === ext && !f.endsWith('.map'))
    .map(f => {
      const fullPath = join(PATHS.dist, f);
      const stat     = statSync(fullPath);
      return { name: f, fullPath, raw: stat.size, mtime: stat.mtimeMs };
    });

  if (all.length === 0) return { raw: 0, gz: 0, top3: ['—', '—', '—'] };

  // Narrow to the most recent build.
  const newestMtime = Math.max(...all.map(f => f.mtime));
  const recent = all
    .filter(f => newestMtime - f.mtime <= FRESHNESS_MS)
    .map(f => ({ ...f, gz: gzipSize(f.fullPath) }))
    .sort((a, b) => b.gz - a.gz);

  if (recent.length === 0) return { raw: 0, gz: 0, top3: ['—', '—', '—'] };

  const totalRaw = recent.reduce((s, f) => s + f.raw, 0);
  const totalGz  = recent.reduce((s, f) => s + f.gz,  0);

  const top3 = recent.slice(0, 3).map(f => {
    // Strip the content hash for readability: web.a1b2c3d4.js → web.js
    const cleanName = f.name.replace(/\.[a-f0-9]{8}(\.(js|css))$/i, '$1');
    const pct = totalGz > 0 ? ((f.gz / totalGz) * 100).toFixed(1) : '0.0';
    return cell(`${cleanName}: ${fmt(f.gz)} (${pct}%)`);
  });
  while (top3.length < 3) top3.push('—');

  return { raw: totalRaw, gz: totalGz, top3 };
}

// ── Markdown Output ────────────────────────────────────────────────────────────

const MD_HEADER = `# Bundle Size Log

Run \`npm run bundle-size\` from \`web/\` to append a new entry.
Use \`npm run bundle-size:build\` to clean, rebuild, and then measure.

> **Raw** = uncompressed file size on disk.
> **Gzip** = over-the-wire transfer size (what browsers download on first visit).
> WASM top contributors are grouped by section type (function code / static data / custom sections)
> because function names are stripped in the release build.
> JS/CSS contributors are the largest files from the most recent Astro build in \`dist/\`.

| Date | Asset | Raw | Gzip | Top Contributor #1 | Top Contributor #2 | Top Contributor #3 |
|------|-------|-----|------|-------------------|-------------------|-------------------|
`;

function initMarkdown() {
  if (!existsSync(PATHS.output)) {
    writeFileSync(PATHS.output, MD_HEADER);
  }
}

function appendRows(date, wasm, js, css) {
  const totalRaw = wasm.raw + js.raw + css.raw;
  const totalGz  = wasm.gz  + js.gz  + css.gz;

  const rows = [
    `| ${date} | WASM        | ${fmt(wasm.raw)} | ${fmt(wasm.gz)} | ${wasm.top3[0]} | ${wasm.top3[1]} | ${wasm.top3[2]} |`,
    `| ${date} | JS          | ${fmt(js.raw)}   | ${fmt(js.gz)}   | ${js.top3[0]}   | ${js.top3[1]}   | ${js.top3[2]}   |`,
    `| ${date} | CSS         | ${fmt(css.raw)}  | ${fmt(css.gz)}  | ${css.top3[0]}  | ${css.top3[1]}  | ${css.top3[2]}  |`,
    `| ${date} | **Total**   | **${fmt(totalRaw)}** | **${fmt(totalGz)}** | | | |`,
    '',
  ].join('\n');

  writeFileSync(PATHS.output, readFileSync(PATHS.output, 'utf8') + rows);
}

// ── Main ──────────────────────────────────────────────────────────────────────

if (!hasCmd('twiggy')) {
  console.error('✗ twiggy not found. Install with: cargo install twiggy');
  process.exit(1);
}

if (BUILD) {
  console.log('Building...');
  buildAll();
}

const date = new Date().toISOString().slice(0, 10);
console.log(`\nMeasuring bundle sizes (${date})...`);

process.stdout.write('  WASM  ');
const wasm = analyzeWasm();
console.log(`raw=${fmt(wasm.raw)}  gz=${fmt(wasm.gz)}`);

process.stdout.write('  JS    ');
const js = analyzeAssets('.js');
console.log(`raw=${fmt(js.raw)}  gz=${fmt(js.gz)}`);

process.stdout.write('  CSS   ');
const css = analyzeAssets('.css');
console.log(`raw=${fmt(css.raw)}  gz=${fmt(css.gz)}`);

const totalRaw = wasm.raw + js.raw + css.raw;
const totalGz  = wasm.gz  + js.gz  + css.gz;

initMarkdown();
appendRows(date, wasm, js, css);

console.log(`
┌─────────┬──────────────┬──────────────┐
│ Asset   │ Raw          │ Gzip         │
├─────────┼──────────────┼──────────────┤
│ WASM    │ ${fmt(wasm.raw).padEnd(12)} │ ${fmt(wasm.gz).padEnd(12)} │
│ JS      │ ${fmt(js.raw).padEnd(12)} │ ${fmt(js.gz).padEnd(12)} │
│ CSS     │ ${fmt(css.raw).padEnd(12)} │ ${fmt(css.gz).padEnd(12)} │
├─────────┼──────────────┼──────────────┤
│ Total   │ ${fmt(totalRaw).padEnd(12)} │ ${fmt(totalGz).padEnd(12)} │
└─────────┴──────────────┴──────────────┘
Appended to: ${PATHS.output}
`);

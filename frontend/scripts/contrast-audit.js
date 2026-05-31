const fs = require('fs');
const path = require('path');

function flattenColors(colors) {
  const map = {};
  for (const [key, val] of Object.entries(colors)) {
    if (typeof val === 'string') {
      map[key] = val;
    } else if (typeof val === 'object' && val !== null) {
      for (const [sub, hex] of Object.entries(val)) {
        if (sub === 'DEFAULT') {
          map[key] = hex;
        } else {
          map[`${key}-${sub}`] = hex;
        }
      }
    }
  }
  return map;
}

function hexToRgb(hex) {
  if (!hex) return null;
  const h = hex.replace('#', '');
  const bigint = parseInt(h.length === 3 ? h.split('').map(c=>c+c).join('') : h, 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

function srgbChannel(c) {
  c = c / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map(srgbChannel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(hex1, hex2) {
  const L1 = luminance(hex1);
  const L2 = luminance(hex2);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return +( (lighter + 0.05) / (darker + 0.05) ).toFixed(2);
}

function readTailwindColors() {
  const configPath = path.resolve(__dirname, '..', 'tailwind.config.js');
  if (!fs.existsSync(configPath)) {
    console.error('tailwind.config.js not found');
    process.exit(1);
  }
  const cfg = require(configPath);
  const colors = (cfg.theme && cfg.theme.extend && cfg.theme.extend.colors) || {};
  return flattenColors(colors);
}

function walkDir(dir, extensions = ['.ts', '.tsx', '.js', '.jsx', '.html']) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(p, extensions));
    } else if (extensions.includes(path.extname(entry.name))) {
      results.push(p);
    }
  }
  return results;
}

function extractClassStrings(content) {
  const out = [];
  // match className="..." or className='...' or className={`...`} or class="..."
  const re = /(?:className|class)\s*=\s*(?:\{`([^`]*)`\}|\"([^\"]*)\"|'([^']*)')/g;
  let m;
  while ((m = re.exec(content))) {
    out.push(m[1] || m[2] || m[3] || '');
  }
  return out;
}

function analyze() {
  const colors = readTailwindColors();
  const src = path.resolve(__dirname, '..', 'src');
  if (!fs.existsSync(src)) {
    console.error('frontend/src not found');
    process.exit(1);
  }

  const files = walkDir(src);
  const findings = [];

  const tokenRe = /(?:\b|-)(?:bg|text|border|placeholder|accent|ring)-([a-z0-9-]+)/g;
  const textSizeRe = /\btext-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl)\b/;

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const classes = extractClassStrings(content);
    for (const cls of classes) {
      const tokens = { bg: null, text: null };
      let m;
      while ((m = tokenRe.exec(cls))) {
        const full = m[0];
        if (full.startsWith('bg-')) tokens.bg = m[1];
        if (full.startsWith('text-')) tokens.text = m[1];
      }
      if (tokens.text && tokens.bg) {
        const textToken = tokens.text;
        const bgToken = tokens.bg;
        const textHex = colors[textToken] || colors[textToken.replace(/-/g, '-')];
        const bgHex = colors[bgToken] || colors[bgToken.replace(/-/g, '-')];
        if (!textHex || !bgHex) continue;
        const ratio = contrastRatio(textHex, bgHex);
        const isLarge = textSizeRe.test(cls);
        const threshold = isLarge ? 3.0 : 4.5;
        const passes = ratio >= threshold;
        findings.push({ file: path.relative(path.resolve(__dirname, '..'), file), class: cls, text: textToken, bg: bgToken, textHex, bgHex, ratio, threshold, passes });
      }
    }
  }

  const reportDir = path.resolve(__dirname, '..', 'audit-reports');
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `contrast-audit-generated-${new Date().toISOString().replace(/[:.]/g,'-')}.json`);
  fs.writeFileSync(reportPath, JSON.stringify({ timestamp: new Date().toISOString(), findings }, null, 2));
  const failures = findings.filter(f => !f.passes);
  console.log(`Contrast audit complete: ${findings.length} checks, ${failures.length} failures`);
  if (failures.length > 0) {
    console.error('Failures:');
    console.error(failures.slice(0, 20));
    process.exit(2);
  }
}

analyze();

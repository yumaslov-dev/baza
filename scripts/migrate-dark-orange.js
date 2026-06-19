#!/usr/bin/env node
'use strict';
// Вариант A: Dark + Orange (в стиле massagency.ru)

const fs   = require('fs');
const path = require('path');

const REPO        = '/Users/maslov/OBSIDIAN_ALL/BAZA/BAZA';
const AUTO_MARKER = '<!-- md-auto-generated -->';

const NEW_ROOT = `:root {
      --bg: #0b0a08; --surface: #141210; --surface-hover: #1c1a17;
      --border: #252320; --border-active: #353230;
      --text-primary: #f0ece4; --text-secondary: #8a8682; --text-muted: #4a4845;
      --accent: #e8612a; --accent-dim: rgba(232,97,42,.1); --accent-border: rgba(232,97,42,.3);
      --danger: #ff5555; --tag-bg: #1c1b18;
    }`;

// Навигация — оранжевый underline как на massagency.ru
const NAV_EXPANDED = `    .topbar-nav a { color: var(--text-secondary); text-decoration: none; font-size: 13px; position: relative; padding-bottom: 2px; transition: color .15s; }
    .topbar-nav a::before { content: ''; width: 0%; height: 3px; position: absolute; display: block; background: var(--accent); left: 0; bottom: -4px; transition: width .3s; }
    .topbar-nav a:hover { color: var(--text-primary); }
    .topbar-nav a:hover::before { width: 100%; }
    .topbar-nav a.active { color: var(--text-primary); }
    .topbar-nav a.active::before { width: 100%; }`;

const NAV_MINIFIED = `.topbar-nav a{color:var(--text-secondary);text-decoration:none;font-size:13px;position:relative;padding-bottom:2px;transition:color .15s}
    .topbar-nav a::before{content:'';width:0%;height:3px;position:absolute;display:block;background:var(--accent);left:0;bottom:-4px;transition:width .3s}
    .topbar-nav a:hover{color:var(--text-primary)}
    .topbar-nav a:hover::before{width:100%}
    .topbar-nav a.active{color:var(--text-primary)}
    .topbar-nav a.active::before{width:100%}`;

// Паттерны старой cream-навигации (и вариантов)
const NAV_PATTERNS_EXPANDED = [
  // из cream-migrate (с ::before уже добавленным)
  /\.topbar-nav a \{ color: var\(--text-secondary\); text-decoration: none; font-size: 13px; position: relative; padding-bottom: 2px; transition: color \.15s; \}\s*\.topbar-nav a::before \{[^}]+\}\s*\.topbar-nav a:hover \{ color: var\(--text-primary\); \}\s*\.topbar-nav a:hover::before \{ width: 100%; \}\s*\.topbar-nav a\.active \{ color: var\(--text-primary\); \}\s*\.topbar-nav a\.active::before \{ width: 100%; \}/s,
  // из продюсер-вход-в-задачу (мультистрочный)
  /\.topbar-nav a \{\s*color: var\(--text-secondary\)[\s\S]*?\.topbar-nav a\.active::before \{ width: 100%; \}/,
];
const NAV_PATTERN_MINIFIED =
  /\.topbar-nav a\{color:var\(--text-secondary\)[\s\S]*?\.topbar-nav a\.active::before\{width:100%\}/;

function migrate(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');
  const isAuto = html.startsWith(AUTO_MARKER);
  const before = html;

  // 1. :root переменные
  html = html.replace(/:root\s*\{[^}]*--bg:[^}]*\}/s, NEW_ROOT);

  // 2. Хардкоженные цвета → тёмная оранжевая палитра
  html = html
    // criteria-box (из cream)
    .replace(/background:\s*#fef3ec/g,  'background: #1f1208')
    .replace(/background:#fef3ec/g,     'background:#1f1208')
    .replace(/border:\s*1px solid #f0c4a0/g, 'border: 1px solid #3d2010')
    .replace(/border:1px solid #f0c4a0/g,    'border:1px solid #3d2010')
    .replace(/color:\s*#c04a10/g, 'color: #e8a070')
    .replace(/color:#c04a10/g,    'color:#e8a070')
    // quote-block (из cream)
    .replace(/background:\s*#fdf0e8/g, 'background: #161412')
    .replace(/background:#fdf0e8/g,    'background:#161412')
    // progress-step.done
    .replace(/background:\s*#c8c4be/g, 'background: #3a3835')
    .replace(/background:#c8c4be/g,    'background:#3a3835')
    // compare-good/bad в управление-командой
    .replace(/rgba\(232,97,42,\.06\)/g, 'rgba(232,97,42,.08)')
    .replace(/rgba\(232,97,42,\.2\)/g,  'rgba(232,97,42,.25)')
    .replace(/background: rgba\(204,53,53,\.06\)/g, 'background: rgba(255,85,85,.08)')
    .replace(/border: 1px solid rgba\(204,53,53,\.2\)/g, 'border: 1px solid rgba(255,85,85,.25)')
    .replace(/color: #b22a2a/g, 'color: #ff9090');

  // 3. Nav-ссылки → заменяем на тот же шаблон (orange underline)
  if (isAuto) {
    html = html.replace(NAV_PATTERN_MINIFIED, NAV_MINIFIED);
  } else {
    let replaced = false;
    for (const pat of NAV_PATTERNS_EXPANDED) {
      const next = html.replace(pat, NAV_EXPANDED);
      if (next !== html) { html = next; replaced = true; break; }
    }
    // fallback: продюсер-вход-в-задачу мультистрочный
    if (!replaced) {
      html = html.replace(
        /\.topbar-nav a \{\s*color: var\(--text-(?:secondary|muted)\);[\s\S]*?\.topbar-nav a\.active(?:::before)? \{[^}]*\}/,
        NAV_EXPANDED
      );
    }
  }

  if (html === before) return 'no-change';
  fs.writeFileSync(filePath, html);
  return 'ok';
}

const htmlDir = path.join(REPO, 'docs-src');
const files = fs.readdirSync(htmlDir).filter(f => f.endsWith('.html')).sort();

let ok = 0, skip = 0;
for (const f of files) {
  const r = migrate(path.join(htmlDir, f));
  console.log(`  ${r === 'ok' ? '✅' : '─'} ${f} [${r}]`);
  r === 'ok' ? ok++ : skip++;
}
console.log(`\nГотово: ${ok} обновлено, ${skip} без изменений`);

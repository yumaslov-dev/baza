#!/usr/bin/env node
'use strict';
// Восстановление исходной тёмной темы с зелёным акцентом (#c8ff00)

const fs   = require('fs');
const path = require('path');

const REPO        = '/Users/maslov/OBSIDIAN_ALL/BAZA/BAZA';
const AUTO_MARKER = '<!-- md-auto-generated -->';

// ─── Исходная палитра ──────────────────────────────────────────────────────

const ORIGINAL_ROOT = `:root {
      --bg: #0f0f0f; --surface: #1a1a1a; --surface-hover: #212121;
      --border: #2a2a2a; --border-active: #3d3d3d;
      --text-primary: #e8e8e8; --text-secondary: #888; --text-muted: #555;
      --accent: #c8ff00; --accent-dim: rgba(200,255,0,.08); --accent-border: rgba(200,255,0,.2);
      --danger: #ff4d4d; --tag-bg: #242424;
    }`;

// Исходный вид nav-ссылок (без анимации — чисто)
const NAV_ORIGINAL_EXPANDED = `    .topbar-nav a { color: var(--text-muted); text-decoration: none; font-size: 13px; transition: color .15s; }
    .topbar-nav a:hover { color: var(--text-secondary); }
    .topbar-nav a.active { color: var(--text-primary); }`;

const NAV_ORIGINAL_MINIFIED = `.topbar-nav a{color:var(--text-muted);text-decoration:none;font-size:13px;transition:color .15s}
    .topbar-nav a:hover{color:var(--text-secondary)}
    .topbar-nav a.active{color:var(--text-primary)}`;

function restore(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');
  const isAuto = html.startsWith(AUTO_MARKER);
  const before = html;

  // 1. :root переменные (любая текущая палитра → исходная)
  html = html.replace(/:root\s*\{[^}]*--bg:[^}]*\}/s, ORIGINAL_ROOT);

  // 2. Хардкоженные цвета → исходные тёмно-зелёные
  html = html
    // criteria-box
    .replace(/background:\s*#1f1208/g, 'background: #161f00')
    .replace(/background:#1f1208/g,    'background:#161f00')
    .replace(/border:\s*1px solid #3d2010/g, 'border: 1px solid #2d3d00')
    .replace(/border:1px solid #3d2010/g,    'border:1px solid #2d3d00')
    .replace(/color:\s*#e8a070/g, 'color: #b8d870')
    .replace(/color:#e8a070/g,    'color:#b8d870')
    // quote-block
    .replace(/background:\s*#161412/g, 'background: #191919')
    .replace(/background:#161412/g,    'background:#191919')
    // progress-step.done
    .replace(/background:\s*#3a3835/g, 'background: #4a4a4a')
    .replace(/background:#3a3835/g,    'background:#4a4a4a')
    // compare-good/bad (управление-командой)
    .replace(/background: rgba\(232,97,42,\.[0-9]+\)/g, 'background: rgba(200,255,0,.04)')
    .replace(/background:rgba\(232,97,42,\.[0-9]+\)/g,  'background:rgba(200,255,0,.04)')
    .replace(/border: 1px solid rgba\(232,97,42,\.[0-9]+\)/g, 'border: 1px solid rgba(200,255,0,.15)')
    .replace(/border:1px solid rgba\(232,97,42,\.[0-9]+\)/g,  'border:1px solid rgba(200,255,0,.15)')
    .replace(/color: #e8a070/g, 'color: #b8d870')   // already done above
    // compare-bad red
    .replace(/background: rgba\(255,85,85,\.[0-9]+\)/g, 'background: rgba(255,77,77,.05)')
    .replace(/background:rgba\(255,85,85,\.[0-9]+\)/g,  'background:rgba(255,77,77,.05)')
    .replace(/border: 1px solid rgba\(255,85,85,\.[0-9]+\)/g, 'border: 1px solid rgba(255,77,77,.15)')
    .replace(/border:1px solid rgba\(255,85,85,\.[0-9]+\)/g,  'border:1px solid rgba(255,77,77,.15)')
    .replace(/color: #ff9090/g, 'color: #ff9090'); // уже правильный

  // 3. Убираем nav-анимацию underline → исходный простой вид
  // Паттерн с ::before (добавили в cream/dark-orange миграции)
  const navWithAnim = /\.topbar-nav a(?:\s*\{[^}]*\}|\s*\{[\s\S]*?transition:color[\s\S]*?\})\s*\.topbar-nav a::before\s*\{[\s\S]*?\}\s*\.topbar-nav a:hover\s*\{[^}]*\}\s*\.topbar-nav a:hover::before\s*\{[^}]*\}\s*\.topbar-nav a\.active\s*\{[^}]*\}\s*\.topbar-nav a\.active::before\s*\{[^}]*\}/;

  if (isAuto) {
    html = html.replace(navWithAnim, NAV_ORIGINAL_MINIFIED);
    // fallback однострочный
    if (!html.includes('color:var(--text-muted)')) {
      html = html.replace(
        /\.topbar-nav a\{[^}]*\}\s*\.topbar-nav a::before\{[\s\S]*?\}[\s\S]*?\.topbar-nav a\.active::before\{[^}]*\}/,
        NAV_ORIGINAL_MINIFIED
      );
    }
  } else {
    html = html.replace(navWithAnim, NAV_ORIGINAL_EXPANDED);
    // fallback для продюсер-вход-в-задачу (мультистрочный)
    if (!html.includes('color: var(--text-muted)')) {
      html = html.replace(
        /\.topbar-nav a \{[\s\S]*?\}\s*\.topbar-nav a::before \{[\s\S]*?\}\s*\.topbar-nav a:hover \{[^}]*\}\s*\.topbar-nav a:hover::before \{[^}]*\}\s*\.topbar-nav a\.active \{[^}]*\}\s*\.topbar-nav a\.active::before \{[^}]*\}/,
        NAV_ORIGINAL_EXPANDED
      );
    }
  }

  if (html === before) return 'no-change';
  fs.writeFileSync(filePath, html);
  return 'restored';
}

const htmlDir = path.join(REPO, 'docs-src');
const files = fs.readdirSync(htmlDir).filter(f => f.endsWith('.html')).sort();

let ok = 0, skip = 0;
for (const f of files) {
  const r = restore(path.join(htmlDir, f));
  console.log(`  ${r === 'restored' ? '✅' : '─'} ${f} [${r}]`);
  r === 'restored' ? ok++ : skip++;
}
console.log(`\nГотово: ${ok} восстановлено, ${skip} без изменений`);

#!/usr/bin/env node
'use strict';
// migrate-cream.js — переводит все ручные HTML-файлы на Cream + Orange палитру
// в стиле massagency.ru

const fs   = require('fs');
const path = require('path');

const REPO        = '/Users/maslov/OBSIDIAN_ALL/BAZA/BAZA';
const AUTO_MARKER = '<!-- md-auto-generated -->';

// ─── Новая палитра ─────────────────────────────────────────────────────────

const NEW_ROOT = `:root {
      --bg: #f8f5f0; --surface: #ffffff; --surface-hover: #fdf9f5;
      --border: #e8e4dd; --border-active: #d0cbc3;
      --text-primary: #0d0c0a; --text-secondary: #4a4845; --text-muted: #9a9690;
      --accent: #e8612a; --accent-dim: rgba(232,97,42,.08); --accent-border: rgba(232,97,42,.25);
      --danger: #cc3535; --tag-bg: #f0ece5;
    }`;

// CSS топ-навигации — заменяем на анимацию underline как на massagency.ru (4px линия)
const NAV_LINK_OLD_PATTERNS = [
  // expanded CSS (ручные файлы)
  `.topbar-nav a { color: var(--text-muted); text-decoration: none; font-size: 13px; transition: color .15s; }
    .topbar-nav a:hover { color: var(--text-secondary); }
    .topbar-nav a.active { color: var(--text-primary); }`,
  // minified CSS (авто-файлы)
  `.topbar-nav a{color:var(--text-muted);text-decoration:none;font-size:13px;transition:color .15s}
    .topbar-nav a:hover{color:var(--text-secondary)}
    .topbar-nav a.active{color:var(--text-primary)}`,
];

const NAV_LINK_EXPANDED = `    .topbar-nav a { color: var(--text-secondary); text-decoration: none; font-size: 13px; position: relative; padding-bottom: 2px; transition: color .15s; }
    .topbar-nav a::before { content: ''; width: 0%; height: 3px; position: absolute; display: block; background: var(--accent); left: 0; bottom: -4px; transition: width .3s; }
    .topbar-nav a:hover { color: var(--text-primary); }
    .topbar-nav a:hover::before { width: 100%; }
    .topbar-nav a.active { color: var(--text-primary); }
    .topbar-nav a.active::before { width: 100%; }`;

const NAV_LINK_MINIFIED = `.topbar-nav a{color:var(--text-secondary);text-decoration:none;font-size:13px;position:relative;padding-bottom:2px;transition:color .15s}
    .topbar-nav a::before{content:'';width:0%;height:3px;position:absolute;display:block;background:var(--accent);left:0;bottom:-4px;transition:width .3s}
    .topbar-nav a:hover{color:var(--text-primary)}
    .topbar-nav a:hover::before{width:100%}
    .topbar-nav a.active{color:var(--text-primary)}
    .topbar-nav a.active::before{width:100%}`;

function migrate(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');
  const isAuto = html.startsWith(AUTO_MARKER);
  const before = html;

  // 1. CSS-переменные :root
  html = html.replace(
    /:root\s*\{[^}]*--bg:[^}]*\}/s,
    NEW_ROOT
  );

  // 2. Хардкоженные цвета — старые зелёные (от предыдущего light-theme)
  html = html
    // criteria-box → оранжево-кремовый
    .replace(/background:\s*#eef5e8/g, 'background: #fef3ec')
    .replace(/background:#eef5e8/g, 'background:#fef3ec')
    .replace(/border:\s*1px solid #c5dca0/g, 'border: 1px solid #f0c4a0')
    .replace(/border:1px solid #c5dca0/g, 'border:1px solid #f0c4a0')
    .replace(/color:\s*#3d6b00/g, 'color: #c04a10')
    .replace(/color:#3d6b00/g, 'color:#c04a10')
    // quote-block → теплее
    .replace(/background:\s*#f0ede8/g, 'background: #fdf0e8')
    .replace(/background:#f0ede8/g, 'background:#fdf0e8')
    // compare-good в управление-командой
    .replace(/rgba\(61,107,0,\.06\)/g, 'rgba(232,97,42,.06)')
    .replace(/rgba\(61,107,0,\.2\)/g, 'rgba(232,97,42,.2)')
    // progress-step.done — нейтральный тёплый серый (уже хорошо)
    // аватар ошибки (красный) — не трогаем
  ;

  // 3. CSS для навигационных ссылок → underline-анимация
  if (isAuto) {
    // minified
    html = html
      .replace(
        /\.topbar-nav a\{color:var\(--text-muted\);text-decoration:none;font-size:13px;transition:color \.15s\}\s*\.topbar-nav a:hover\{color:var\(--text-secondary\)\}\s*\.topbar-nav a\.active\{color:var\(--text-primary\)\}/,
        NAV_LINK_MINIFIED
      );
  } else {
    // expanded
    html = html
      .replace(
        /\.topbar-nav a \{ color: var\(--text-muted\); text-decoration: none; font-size: 13px; transition: color \.15s; \}\s*\.topbar-nav a:hover \{ color: var\(--text-secondary\); \}\s*\.topbar-nav a\.active \{ color: var\(--text-primary\); \}/,
        NAV_LINK_EXPANDED
      );
  }

  if (html === before) return 'no-change';
  fs.writeFileSync(filePath, html);
  return isAuto ? 'updated-auto' : 'migrated';
}

const htmlDir = path.join(REPO, 'docs-src');
const files = fs.readdirSync(htmlDir).filter(f => f.endsWith('.html')).sort();

let counts = { migrated: 0, 'no-change': 0 };
for (const f of files) {
  const result = migrate(path.join(htmlDir, f));
  const icon = result.startsWith('migrated') || result.startsWith('updated') ? '✅' : '─';
  console.log(`  ${icon} ${f} [${result}]`);
  counts[result.startsWith('m') || result.startsWith('u') ? 'migrated' : 'no-change']++;
}
console.log(`\nГотово: ${counts.migrated} обновлено, ${counts['no-change']} без изменений`);

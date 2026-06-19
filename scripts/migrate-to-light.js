#!/usr/bin/env node
'use strict';
// Одноразовый скрипт: темная тема → светлая, числа → иконки, эмодзи в хедеры разделов

const fs   = require('fs');
const path = require('path');

const REPO        = '/Users/maslov/OBSIDIAN_ALL/BAZA/BAZA';
const AUTO_MARKER = '<!-- md-auto-generated -->';

// Иконки для карточек по порядку (вместо цифр 1, 2, 3…)
const CARD_ICONS = [
  '🎯', '📋', '🔑', '💬', '⚡', '🛠', '🌱', '💡',
  '📊', '🔍', '✅', '💪', '🎓', '🌟', '🔮', '🧩'
];

// Эмодзи для заголовков разделов (h4)
const SECTION_EMOJIS = {
  'ситуация':                      '📍',
  'почему важно':                   '⚡',
  'где обычно ломается':            '🔴',
  'где ломается':                   '🔴',
  'как смотреть точнее':            '🔍',
  'что сделать':                    '✅',
  'какой артефакт остается':        '📄',
  'критерий хорошего результата':   '🎯',
  'главное правило':                '💡',
  'суть':                           '💎',
  'вопросы клиенту':                '❓',
  'что написать клиенту':           '✉️',
  'что сказать на созвоне':         '📞',
  'когда звать руководителя':       '🆘',
  'рабочие фразы':                  '💬',
  'структура':                      '📐',
  'структура разбора':              '📐',
  'структура задачи':               '📐',
  'шаблон':                         '📝',
  'шаблон письма':                  '📝',
  'принцип человеческого языка':    '🗣',
  'информация':                     'ℹ️',
  'шесть вопросов перед любой задачей': '❓',
};

// Светлая тема
const LIGHT_VARS = `--bg: #f5f4f0; --surface: #ffffff; --surface-hover: #fafaf8;
      --border: #e2e0db; --border-active: #c5c2bb;
      --text-primary: #1a1918; --text-secondary: #5c5a56; --text-muted: #9a9692;
      --accent: #3d6b00; --accent-dim: rgba(61,107,0,.08); --accent-border: rgba(61,107,0,.2);
      --danger: #cc3535; --tag-bg: #eeece8;`;

function migrate(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');
  if (html.startsWith(AUTO_MARKER)) return 'skip-auto';

  const before = html;

  // 1. Заменить :root переменные
  html = html.replace(
    /:root\s*\{([^}]*--bg:[^}]*)\}/s,
    `:root {\n      ${LIGHT_VARS}\n    }`
  );

  // 2. Жёстко зашитые тёмные цвета в CSS и inline-стилях
  html = html
    // quote-block background
    .replace(/background:\s*#191919/g, 'background: #f0ede8')
    .replace(/background:#191919/g, 'background:#f0ede8')
    // criteria-box
    .replace(/background:\s*#161f00/g, 'background: #eef5e8')
    .replace(/background:#161f00/g, 'background:#eef5e8')
    .replace(/border:\s*1px solid #2d3d00/g, 'border: 1px solid #c5dca0')
    .replace(/border:1px solid #2d3d00/g, 'border:1px solid #c5dca0')
    .replace(/color:\s*#b8d870/g, 'color: #3d6b00')
    .replace(/color:#b8d870/g, 'color:#3d6b00')
    // progress-step.done
    .replace(/background:\s*#4a4a4a/g, 'background: #c8c4be')
    .replace(/background:#4a4a4a/g, 'background:#c8c4be');

  // 3. card-num CSS: числовой стиль → размер для эмодзи
  html = html.replace(
    /\.card-num\s*\{[^}]*font-size:\s*12px[^}]*\}/s,
    m => m
      .replace('font-size: 12px', 'font-size: 20px')
      .replace('font-weight: 600;', '')
      .replace('color: var(--text-muted);', '')
      .replace('width: 30px', 'width: 36px')
      .replace('height: 30px', 'height: 36px')
  );
  // убираем color переопределение при открытой карточке (не нужно для эмодзи)
  // используем negative lookbehind чтобы не задеть border-color
  html = html.replace(
    /\.card\.open \.card-num\s*\{([^}]*)\}/s,
    (m, inner) => `.card.open .card-num {${inner.replace(/(?<![-\w])color:[^;]+;/g, '')}}`
  );

  // 4. Числа в card-num → иконки
  html = html.replace(/<div class="card-num">(\d+)<\/div>/g, (_, num) => {
    const idx = parseInt(num) - 1;
    return `<div class="card-num">${CARD_ICONS[idx] || '📌'}</div>`;
  });

  // 5. Добавить эмодзи к h4 (если ещё нет)
  html = html.replace(/<h4>([^<]+)<\/h4>/g, (match, text) => {
    const trimmed = text.trim();
    // уже есть эмодзи — пропустить
    if (/^\p{Emoji}/u.test(trimmed)) return match;
    const emoji = SECTION_EMOJIS[trimmed.toLowerCase()];
    if (emoji) return `<h4>${emoji} ${trimmed}</h4>`;
    return match;
  });

  if (html === before) return 'no-change';
  fs.writeFileSync(filePath, html);
  return 'migrated';
}

const htmlDir = path.join(REPO, 'docs-src');
const files = fs.readdirSync(htmlDir)
  .filter(f => f.endsWith('.html'))
  .sort();

for (const f of files) {
  const result = migrate(path.join(htmlDir, f));
  const icon = result === 'migrated' ? '✅' : result === 'skip-auto' ? '⏭' : '─';
  console.log(`  ${icon} ${f} [${result}]`);
}

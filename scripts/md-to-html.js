#!/usr/bin/env node
'use strict';
/**
 * md-to-html.js — авто-генерация HTML из markdown-карточек базы знаний
 *
 * Логика:
 *   - Сканирует знания/*.md
 *   - Если нет docs-src/имя.html → генерирует (помечает <!-- md-auto-generated -->)
 *   - Если HTML существует и помечен → перегенерирует, если md новее
 *   - Если HTML существует БЕЗ пометки (ручная правка) → не трогает
 *   - Обновляет docs-src/знания.html (добавляет карточку для новых страниц)
 */

const fs   = require('fs');
const path = require('path');

const REPO        = '/Users/maslov/OBSIDIAN_ALL/BAZA/BAZA';
const AUTO_MARKER = '<!-- md-auto-generated -->';
const SKIP_FILES  = new Set(['README.md', '_INDEX.md', 'общие.md']);

// Иконки карточек по порядку (вместо цифр 1, 2, 3…)
const CARD_ICONS = [
  '🎯', '📋', '🔑', '💬', '⚡', '🛠', '🌱', '💡',
  '📊', '🔍', '✅', '💪', '🎓', '🌟', '🔮', '🧩',
];

// Эмодзи для h4 заголовков разделов
const SECTION_H4_EMOJIS = {
  'Ситуация':                    '📍',
  'Почему важно':                 '⚡',
  'Где обычно ломается':          '🔴',
  'Как смотреть точнее':          '🔍',
  'Что сделать':                  '✅',
  'Какой артефакт остается':      '📄',
  'Критерий хорошего результата': '🎯',
  'Главное правило':              '💡',
  'Вопросы клиенту':              '❓',
  'Что написать клиенту':         '✉️',
  'Что сказать на созвоне':       '📞',
  'Когда звать руководителя':     '🆘',
  'Рабочие фразы':                '💬',
};

// ─────────────────────────────────────────────────────────────────────────────
// Markdown parser
// ─────────────────────────────────────────────────────────────────────────────

function parseMd(content) {
  const lines   = content.split('\n');
  let title = '', updated = '', desc = '', related = [];

  // Header metadata
  for (const line of lines) {
    if (line.startsWith('# ') && !title)
      title = line.slice(2).trim();
    if (line.includes('_Обновлено:'))
      updated = line.replace(/_/g, '').replace('Обновлено:', '').trim();
    if (line.startsWith('Связано:')) {
      const m = line.match(/\[\[([^\]|]+)/g) || [];
      related = m.map(x => x.slice(2));
    }
    if (!desc && !line.startsWith('#') && !line.startsWith('_') &&
        !line.startsWith('Связано') && line.trim() && !line.startsWith('>'))
      desc = line.trim();
  }

  // Split content by horizontal rules (---) into blocks
  const blocks = content.split(/\n---\n/);

  // Cards start from block index 1
  const cards = [];
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].trim();
    if (!block) continue;

    const blockLines = block.split('\n');
    let cardTitle = '', cardNum = 0;

    for (const line of blockLines) {
      const m = line.match(/^## Карточка (\d+)\.\s+(.+)/);
      if (m) { cardNum = parseInt(m[1]); cardTitle = m[2].trim(); break; }
      const m2 = line.match(/^## (.+)/);
      if (m2) { cardTitle = m2[1].trim(); break; }
    }
    if (!cardTitle) continue;

    // Parse ### subsections
    const subsections = [];
    let subName = null, subBuf = [];
    for (const line of blockLines) {
      if (line.startsWith('### ')) {
        if (subName !== null)
          subsections.push({ name: subName, content: subBuf.join('\n').trim() });
        subName = line.slice(4).trim();
        subBuf  = [];
      } else if (!line.startsWith('## ')) {
        subBuf.push(line);
      }
    }
    if (subName !== null)
      subsections.push({ name: subName, content: subBuf.join('\n').trim() });

    cards.push({ num: cardNum || (cards.length + 1), title: cardTitle, subsections });
  }

  return { title, updated, desc, related, cards };
}

// ─────────────────────────────────────────────────────────────────────────────
// Content → HTML helpers
// ─────────────────────────────────────────────────────────────────────────────

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function inline(s) {
  return escHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, (_, n) => `<em>${n}</em>`);
}

function contentToHtml(text) {
  if (!text) return '';
  const lines   = text.split('\n');
  const out     = [];
  let listType  = null;
  let listItems = [];

  const flushList = () => {
    if (!listType) return;
    const tag = listType === 'ol' ? 'ol' : 'ul';
    out.push(`<${tag}>${listItems.map(i => `<li>${i}</li>`).join('')}</${tag}>`);
    listType = null; listItems = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushList(); continue; }

    // Ordered list item
    const olM = line.match(/^(\d+)\.\s+(.*)/);
    if (olM) {
      if (listType && listType !== 'ol') flushList();
      listType = 'ol';
      listItems.push(inline(olM[2]));
      continue;
    }

    // Bullet list item
    const ulM = line.match(/^[-*]\s+(.*)/);
    if (ulM) {
      if (listType && listType !== 'ul') flushList();
      listType = 'ul';
      listItems.push(inline(ulM[1]));
      continue;
    }

    // Blockquote
    const qM = line.match(/^>\s?(.*)/);
    if (qM) {
      flushList();
      out.push(`<div class="quote-block">${inline(qM[1])}</div>`);
      continue;
    }

    flushList();
    out.push(`<p class="body-p">${inline(line)}</p>`);
  }
  flushList();
  return out.join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// Section → HTML block
// ─────────────────────────────────────────────────────────────────────────────

const FULL_WIDTH = new Set([
  'Ситуация','Почему важно','Как смотреть точнее','Какой артефакт остается',
  'Вопросы клиенту','Что написать клиенту','Что сказать на созвоне',
  'Когда звать руководителя','Структура письма','Шаблон письма','Шаблон',
  'Принцип человеческого языка','Минимальные вопросы перед вилкой',
  'Как давать вилку','Блоки вопросов','Рабочие фразы',
]);

function renderSectionBlock(name, content) {
  const html = contentToHtml(content);

  if (name === 'Главное правило') {
    const ruleText = content
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, (_, n) => n)
      .trim();
    return `<div class="rule-callout"><p>💡 <strong>Правило:</strong> ${ruleText}</p></div>`;
  }

  if (name === 'Критерий хорошего результата') {
    return `<div class="criteria-box"><p>🎯 ${html}</p></div>`;
  }

  if (name === 'Где обычно ломается') {
    return `<div class="section breaks"><h4>🔴 Где обычно ломается</h4>${html}</div>`;
  }

  const isFull = FULL_WIDTH.has(name);
  const emoji  = SECTION_H4_EMOJIS[name] ? `${SECTION_H4_EMOJIS[name]} ` : '';
  return `<div class="section${isFull ? ' full' : ''}"><h4>${emoji}${escHtml(name)}</h4>${html}</div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Card → HTML accordion item
// ─────────────────────────────────────────────────────────────────────────────

function renderCard(card) {
  const idx         = (card.num - 1);
  const icon        = CARD_ICONS[idx] || '📌';
  const ruleSection = card.subsections.find(s => s.name === 'Главное правило');
  const critSection = card.subsections.find(s => s.name === 'Критерий хорошего результата');
  const mainSecs    = card.subsections.filter(
    s => s.name !== 'Главное правило' && s.name !== 'Критерий хорошего результата'
  );

  // Try to put "Где обычно ломается" and "Что сделать" side-by-side
  const breakIdx = mainSecs.findIndex(s => s.name === 'Где обычно ломается');
  const doIdx    = mainSecs.findIndex(s => s.name === 'Что сделать');

  const bodyParts = [];
  if (ruleSection) bodyParts.push(renderSectionBlock('Главное правило', ruleSection.content));

  if (breakIdx !== -1 && doIdx !== -1) {
    for (let i = 0; i < mainSecs.length; i++) {
      if (i === breakIdx) {
        bodyParts.push(
          `<div class="body-grid">${renderSectionBlock(mainSecs[breakIdx].name, mainSecs[breakIdx].content)}${renderSectionBlock(mainSecs[doIdx].name, mainSecs[doIdx].content)}</div>`
        );
      } else if (i === doIdx) {
        continue; // already rendered in grid
      } else {
        bodyParts.push(renderSectionBlock(mainSecs[i].name, mainSecs[i].content));
      }
    }
  } else {
    for (const s of mainSecs)
      bodyParts.push(renderSectionBlock(s.name, s.content));
  }

  if (critSection) bodyParts.push(renderSectionBlock('Критерий хорошего результата', critSection.content));

  return `
      <div class="card" id="card-${idx}">
        <div class="card-header" onclick="toggleCard(${idx})">
          <div class="card-num">${icon}</div>
          <div class="card-header-text">
            <div class="card-title">${escHtml(card.title)}</div>
          </div>
          <div class="card-chevron">›</div>
        </div>
        <div class="card-body">
          ${bodyParts.join('\n          ')}
        </div>
      </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Full page HTML
// ─────────────────────────────────────────────────────────────────────────────

function buildPageHtml(data, filename, relatedLinks) {
  const { title, updated, desc, cards } = data;
  const total       = cards.length;
  const progressDots = Array.from({ length: total }, (_, i) =>
    `<div class="progress-step" onclick="toggleCard(${i})"></div>`
  ).join('');
  const tocItems = cards.map((c, i) =>
    `<li><a href="#" onclick="showCard(${i});return false;"><span class="side-toc-num">${c.num}</span>${escHtml(c.title)}</a></li>`
  ).join('');
  const relatedHtml = relatedLinks.map(r =>
    `<a href="${r.html}" class="side-link"><span>⇗</span>${escHtml(r.label)}</a>`
  ).join('');
  const cardsHtml = cards.map(c => renderCard(c)).join('');

  return `${AUTO_MARKER}
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="robots" content="noindex, nofollow" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(title)} — mass agency</title>
  <style>
    :root {
      --bg:#0f0f0f;--surface:#1a1a1a;--surface-hover:#212121;
      --border:#2a2a2a;--border-active:#3d3d3d;
      --text-primary:#e8e8e8;--text-secondary:#888;--text-muted:#555;
      --accent:#c8ff00;--accent-dim:rgba(200,255,0,.08);--accent-border:rgba(200,255,0,.2);
      --danger:#ff4d4d;--tag-bg:#242424;
    }
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:var(--bg);color:var(--text-primary);font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;line-height:1.6;min-height:100vh}
    .topbar{display:flex;align-items:center;justify-content:space-between;padding:0 32px;height:52px;border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--bg);z-index:100}
    .topbar-brand{font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
    .topbar-brand span{color:var(--accent)}
    .topbar-nav{display:flex;gap:24px}
    .topbar-nav a{color:var(--text-muted);text-decoration:none;font-size:13px;transition:color .15s}
    .topbar-nav a:hover{color:var(--text-secondary)}
    .topbar-nav a.active{color:var(--text-primary)}
    .breadcrumb{padding:20px 32px 0;display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-muted)}
    .breadcrumb a{color:var(--text-muted);text-decoration:none}
    .breadcrumb a:hover{color:var(--text-secondary)}
    .breadcrumb-sep{color:var(--border-active)}
    .layout{display:grid;grid-template-columns:1fr 280px;gap:0;max-width:1200px;margin:0 auto;padding:32px 32px 80px;align-items:start}
    .main{padding-right:48px}
    .page-header{margin-bottom:36px}
    .page-tag{display:inline-flex;align-items:center;gap:6px;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--accent);background:var(--accent-dim);border:1px solid var(--accent-border);padding:3px 10px;border-radius:4px;margin-bottom:14px}
    .page-tag::before{content:'';width:6px;height:6px;background:var(--accent);border-radius:50%}
    .page-title{font-size:26px;font-weight:700;line-height:1.25;color:var(--text-primary);margin-bottom:10px}
    .page-desc{color:var(--text-secondary);font-size:14px;max-width:580px;line-height:1.7}
    .page-meta{display:flex;align-items:center;gap:20px;margin-top:16px;font-size:12px;color:var(--text-muted)}
    .progress-bar{display:flex;gap:6px;margin-bottom:32px}
    .progress-step{flex:1;height:3px;background:var(--border);border-radius:2px;transition:background .3s;cursor:pointer}
    .progress-step.active{background:var(--accent)}
    .progress-step.done{background:#4a4a4a}
    .cards{display:flex;flex-direction:column;gap:8px}
    .card{border:1px solid var(--border);border-radius:10px;background:var(--surface);overflow:hidden;transition:border-color .2s}
    .card:hover{border-color:var(--border-active)}
    .card.open{border-color:var(--border-active);background:var(--surface-hover)}
    .card-header{display:flex;align-items:center;gap:16px;padding:18px 20px;cursor:pointer;user-select:none}
    .card-num{width:36px;height:36px;border-radius:8px;background:var(--tag-bg);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;transition:all .2s}
    .card.open .card-num{background:var(--accent-dim);border-color:var(--accent-border)}
    .card-header-text{flex:1}
    .card-title{font-size:15px;font-weight:600;color:var(--text-primary);margin-bottom:2px}
    .card-subtitle{font-size:12px;color:var(--text-muted)}
    .card-chevron{color:var(--text-muted);font-size:16px;transition:transform .25s;flex-shrink:0;margin-left:12px}
    .card.open .card-chevron{transform:rotate(180deg);color:var(--text-secondary)}
    .card-body{display:none;padding:0 20px 24px;border-top:1px solid var(--border)}
    .card.open .card-body{display:block}
    .rule-callout{display:flex;gap:12px;background:var(--accent-dim);border:1px solid var(--accent-border);border-radius:8px;padding:14px 16px;margin:20px 0 24px}
    .rule-callout p{font-size:13px;color:var(--text-primary);line-height:1.6}
    .body-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
    .section{background:var(--tag-bg);border:1px solid var(--border);border-radius:8px;padding:14px 16px;margin-bottom:16px}
    .section.full{grid-column:1/-1}
    .section h4{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);margin-bottom:10px}
    .section ul{list-style:none;display:flex;flex-direction:column;gap:6px}
    .section ul li{font-size:13px;color:var(--text-secondary);padding-left:14px;position:relative}
    .section ul li::before{content:'—';position:absolute;left:0;color:var(--text-muted)}
    .section.breaks ul li::before{content:'×';color:var(--danger);opacity:.7}
    .section ol{list-style:none;counter-reset:item;display:flex;flex-direction:column;gap:6px}
    .section ol li{font-size:13px;color:var(--text-secondary);padding-left:24px;position:relative;counter-increment:item}
    .section ol li::before{content:counter(item);position:absolute;left:0;font-size:11px;font-weight:700;color:var(--accent);width:16px;height:16px;background:var(--accent-dim);border-radius:4px;display:flex;align-items:center;justify-content:center;top:1px}
    .criteria-box{background:#161f00;border:1px solid #2d3d00;border-radius:8px;padding:14px 16px;margin-top:16px}
    .criteria-box p{font-size:13px;color:#b8d870;line-height:1.6}
    .quote-block{background:#191919;border-left:2px solid var(--accent);border-radius:0 6px 6px 0;padding:12px 14px;margin:8px 0;font-size:13px;color:var(--text-secondary);line-height:1.65}
    .body-p{font-size:13px;color:var(--text-secondary);line-height:1.65;margin-bottom:8px}
    .toolbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
    .toolbar-label{font-size:13px;font-weight:600;color:var(--text-secondary)}
    .btn-ghost{font-size:12px;color:var(--text-muted);background:var(--tag-bg);border:1px solid var(--border);border-radius:6px;padding:5px 12px;cursor:pointer;transition:all .15s}
    .btn-ghost:hover{color:var(--text-secondary);border-color:var(--border-active)}
    .sidebar{position:sticky;top:72px;display:flex;flex-direction:column;gap:16px}
    .side-block{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px}
    .side-block h3{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:var(--text-muted);margin-bottom:12px}
    .side-toc{list-style:none;display:flex;flex-direction:column;gap:2px}
    .side-toc li a{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:5px;font-size:12px;color:var(--text-muted);text-decoration:none;transition:all .15s}
    .side-toc li a:hover,.side-toc li a.active{color:var(--text-primary);background:var(--tag-bg)}
    .side-toc li a.active{color:var(--accent)}
    .side-toc-num{width:18px;height:18px;background:var(--tag-bg);border-radius:4px;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .side-links{display:flex;flex-direction:column;gap:6px}
    .side-link{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-muted);text-decoration:none;padding:6px 8px;border-radius:5px;transition:all .15s}
    .side-link:hover{background:var(--tag-bg);color:var(--text-secondary)}
    .side-info{display:flex;flex-direction:column;gap:8px}
    .side-info-row{display:flex;justify-content:space-between;font-size:12px}
    .side-info-label{color:var(--text-muted)}
    .side-info-value{color:var(--text-secondary);font-weight:500}
  </style>
</head>
<body>

<header class="topbar">
  <div class="topbar-brand"><a href="index.html" style="text-decoration:none;color:inherit">mass<span>.</span>agency</a></div>
  <nav class="topbar-nav">
    <a href="команда.html">Команда</a>
    <a href="процессы.html">Процессы</a>
    <a href="знания.html" class="active">Знания</a>
  </nav>
</header>

<div class="breadcrumb">
  <a href="index.html">База знаний</a>
  <span class="breadcrumb-sep">›</span>
  <a href="знания.html">Знания</a>
  <span class="breadcrumb-sep">›</span>
  <span>${escHtml(title)}</span>
</div>

<div class="layout">
  <main class="main">
    <div class="page-header">
      <div class="page-tag">Знания</div>
      <h1 class="page-title">${escHtml(title)}</h1>
      <p class="page-desc">${escHtml(desc)}</p>
      <div class="page-meta">
        <div>📅 Обновлено: ${escHtml(updated)}</div>
        <div>📋 ${total} карточек</div>
      </div>
    </div>

    <div class="progress-bar">${progressDots}</div>

    <div class="toolbar">
      <div class="toolbar-label">${total} карточек</div>
      <button class="btn-ghost" onclick="expandAll()">Развернуть все</button>
    </div>

    <div class="cards">${cardsHtml}
    </div>
  </main>

  <aside class="sidebar">
    <div class="side-block">
      <h3>На этой странице</h3>
      <ul class="side-toc">${tocItems}</ul>
    </div>
    ${relatedHtml ? `<div class="side-block"><h3>Связанные страницы</h3><div class="side-links">${relatedHtml}</div></div>` : ''}
    <div class="side-block">
      <h3>Информация</h3>
      <div class="side-info">
        <div class="side-info-row"><span class="side-info-label">Раздел</span><span class="side-info-value">Знания</span></div>
        <div class="side-info-row"><span class="side-info-label">Карточек</span><span class="side-info-value">${total}</span></div>
        <div class="side-info-row"><span class="side-info-label">Обновлено</span><span class="side-info-value">${escHtml(updated)}</span></div>
      </div>
    </div>
  </aside>
</div>

<script>
  const openCards = new Set();
  const TOTAL = ${total};
  function toggleCard(i) {
    const c = document.getElementById('card-'+i);
    if (c.classList.contains('open')) { c.classList.remove('open'); openCards.delete(i); }
    else { c.classList.add('open'); openCards.add(i); }
    updateProgress();
  }
  function showCard(i) {
    for (let j=0;j<TOTAL;j++) { document.getElementById('card-'+j).classList.remove('open'); openCards.delete(j); }
    document.getElementById('card-'+i).classList.add('open'); openCards.add(i);
    document.getElementById('card-'+i).scrollIntoView({behavior:'smooth',block:'start'});
    document.querySelectorAll('.side-toc li a').forEach((a,j)=>a.classList.toggle('active',j===i));
    updateProgress();
  }
  function expandAll() {
    const btn = document.querySelector('.btn-ghost');
    const allOpen = openCards.size === TOTAL;
    for (let i=0;i<TOTAL;i++) {
      const c = document.getElementById('card-'+i);
      if (allOpen) { c.classList.remove('open'); openCards.delete(i); }
      else { c.classList.add('open'); openCards.add(i); }
    }
    btn.textContent = allOpen ? 'Развернуть все' : 'Свернуть все';
    updateProgress();
  }
  function updateProgress() {
    document.querySelectorAll('.progress-step').forEach((s,i) => {
      s.classList.remove('active','done');
      if (openCards.has(i)) s.classList.add('active');
      else if (openCards.size>0) s.classList.add('done');
    });
  }
  toggleCard(0);
</script>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Index page updater (docs-src/знания.html)
// ─────────────────────────────────────────────────────────────────────────────

function addToIndex(indexPath, htmlFilename, mdData) {
  const fullIndex = path.join(REPO, indexPath);
  let html = fs.readFileSync(fullIndex, 'utf8');

  if (html.includes(`href="${htmlFilename}"`)) return false; // already there

  const cardCount = (html.match(/class="section-card"/g) || []).length;
  const num       = cardCount + 1;

  const topics = mdData.cards.slice(0, 4)
    .map(c => `<div class="card-topic">${escHtml(c.title)}</div>`)
    .join('\n        ');

  const newCard = `
    <a href="${htmlFilename}" class="section-card">
      <div class="card-top">
        <div class="card-num-badge">${num}</div>
        <div class="card-arrow">↗</div>
      </div>
      <div class="card-section-label">Знания</div>
      <div class="card-title">${escHtml(mdData.title)}</div>
      <div class="card-desc">${escHtml(mdData.desc)}</div>
      <div class="card-topics">
        ${topics}
      </div>
      <div class="card-footer">
        <div class="card-count"><div class="card-count-dot"></div>${mdData.cards.length} карточек</div>
        <div class="card-tags-row"><span class="ctag">Знания</span></div>
      </div>
    </a>`;

  // Insert before the closing </div></div> of section-grid
  html = html.replace(/(\n  <\/div>\n\n<\/div>\n<\/body>)/, `${newCard}\n$1`);

  // Update page count
  html = html.replace(/(\d+) страниц/, (_, n) => `${parseInt(n) + 1} страниц`);

  // Update date
  const today = new Date().toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' });
  html = html.replace(/Обновлено \d[^<"]+/, `Обновлено ${today}`);

  fs.writeFileSync(fullIndex, html);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Related links resolver
// ─────────────────────────────────────────────────────────────────────────────

// md filename stem → html filename
const KNOWN_PAGES = {
  'продюсер-вход-в-задачу':   { html: 'продюсер-вход-в-задачу.html',   label: 'Вход в задачу клиента' },
  'управление-проектом':      { html: 'управление-проектом.html',       label: 'Управление проектом' },
  'управление-командой':      { html: 'управление-командой.html',       label: 'Управление командой' },
  'продюсерское-мышление':    { html: 'продюсерское-мышление.html',     label: 'Продюсерское мышление' },
  'переговоры':               { html: 'переговоры.html',                label: 'Переговоры' },
  'рабочие-процессы':         { html: 'рабочие-процессы.html',          label: 'Рабочие процессы' },
};

function resolveRelated(related) {
  return related
    .map(name => KNOWN_PAGES[name])
    .filter(Boolean);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function main() {
  const mdDir   = path.join(REPO, 'знания');
  const htmlDir = path.join(REPO, 'docs-src');

  const files = fs.readdirSync(mdDir).filter(f => f.endsWith('.md') && !SKIP_FILES.has(f));
  let generated = 0, skipped = 0, upToDate = 0;

  for (const mdFile of files) {
    const stem     = path.basename(mdFile, '.md');
    const mdPath   = path.join(mdDir, mdFile);
    const htmlFile = `${stem}.html`;
    const htmlPath = path.join(htmlDir, htmlFile);

    const mdMtime = fs.statSync(mdPath).mtimeMs;
    let needsRegen = false;

    if (!fs.existsSync(htmlPath)) {
      needsRegen = true;
    } else {
      const existing = fs.readFileSync(htmlPath, 'utf8');
      if (existing.startsWith(AUTO_MARKER)) {
        const htmlMtime = fs.statSync(htmlPath).mtimeMs;
        needsRegen = mdMtime > htmlMtime;
      }
    }

    if (!needsRegen) {
      upToDate++;
      continue;
    }

    const mdContent  = fs.readFileSync(mdPath, 'utf8');
    const data       = parseMd(mdContent);

    if (!data.title || data.cards.length === 0) {
      console.log(`  skip (no cards): ${mdFile}`);
      skipped++;
      continue;
    }

    const related  = resolveRelated(data.related.filter(r => r !== stem));
    const pageHtml = buildPageHtml(data, htmlFile, related);
    fs.writeFileSync(htmlPath, pageHtml);
    console.log(`  generated: ${htmlFile} (${data.cards.length} карточек)`);

    const added = addToIndex('docs-src/знания.html', htmlFile, data);
    if (added) console.log(`  → добавлено в знания.html`);

    generated++;
  }

  console.log(`md-to-html: сгенерировано ${generated}, актуально ${upToDate}, пропущено ${skipped}`);
}

main();

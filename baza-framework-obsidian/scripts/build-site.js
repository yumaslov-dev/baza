#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '06-site', 'index.html');
const CONTENT_DIRS = ['02-cards', '03-processes', '04-templates', '05-principles'];

const TYPE_LABELS = {
  'situation-card': 'Ситуация',
  process: 'Процесс',
  template: 'Шаблон',
  principle: 'Принцип',
  guide: 'Раздел',
};

const TYPE_ICONS = {
  'situation-card': '🎯',
  process: '⚙️',
  template: '📄',
  principle: '💡',
  guide: '🗂️',
};

const SECTION_LABELS = {
  self: 'Начать с себя',
  client: 'Понять клиента',
  project: 'Собрать проект',
  team: 'Работать с командой',
  production: 'Довести до результата',
  money: 'Деньги',
  agency: 'Управлять агентством',
};

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...walk(full));
    if (entry.isFile() && entry.name.endsWith('.md')) result.push(full);
  }
  return result;
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inline(value) {
  return esc(value)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '<em>$1</em>');
}

function parseFrontmatter(text) {
  const fm = {};
  if (!text.startsWith('---\n')) return { fm, body: text };
  const end = text.indexOf('\n---\n', 4);
  if (end === -1) return { fm, body: text };

  let current = null;
  for (const line of text.slice(4, end).split('\n')) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kv) {
      current = kv[1];
      fm[current] = kv[2].trim().replace(/^"|"$/g, '') || '';
      continue;
    }
    const item = line.match(/^\s*-\s*(.*)$/);
    if (item && current) {
      if (!Array.isArray(fm[current])) fm[current] = [];
      fm[current].push(item[1].replace(/^"|"$/g, ''));
    }
  }

  return { fm, body: text.slice(end + 5).trim() };
}

function mdToHtml(md) {
  const lines = md.split('\n');
  const out = [];
  let list = null;
  let code = false;
  let codeLines = [];

  function flushList() {
    if (!list) return;
    out.push(`<${list.type}>${list.items.map(item => `<li>${inline(item)}</li>`).join('')}</${list.type}>`);
    list = null;
  }

  function flushCode() {
    if (!codeLines.length) return;
    out.push(`<pre><code>${esc(codeLines.join('\n'))}</code></pre>`);
    codeLines = [];
  }

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith('```')) {
      if (code) {
        code = false;
        flushCode();
      } else {
        flushList();
        code = true;
      }
      continue;
    }
    if (code) {
      codeLines.push(raw);
      continue;
    }
    if (!line.trim()) {
      flushList();
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushList();
      const level = Math.min(heading[1].length + 1, 5);
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    const ordered = line.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      if (!list || list.type !== 'ol') {
        flushList();
        list = { type: 'ol', items: [] };
      }
      list.items.push(ordered[1]);
      continue;
    }
    const bullet = line.match(/^-\s+(.+)$/);
    if (bullet) {
      if (!list || list.type !== 'ul') {
        flushList();
        list = { type: 'ul', items: [] };
      }
      list.items.push(bullet[1]);
      continue;
    }
    const quote = line.match(/^>\s?(.+)$/);
    if (quote) {
      flushList();
      out.push(`<div class="quote-block">${inline(quote[1])}</div>`);
      continue;
    }
    flushList();
    out.push(`<p class="body-p">${inline(line)}</p>`);
  }

  flushList();
  if (code) flushCode();
  return out.join('\n');
}

function excerpt(body) {
  return body
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^#.*$/gm, '')
    .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1')
    .replace(/\*\*/g, '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 40)[0] || '';
}

function collectItems() {
  const files = CONTENT_DIRS.flatMap(dir => walk(path.join(ROOT, dir)));
  return files.map(file => {
    const raw = fs.readFileSync(file, 'utf8');
    const { fm, body } = parseFrontmatter(raw);
    const title = fm.title || (body.match(/^#\s+(.+)$/m) || [null, path.basename(file, '.md')])[1];
    const type = fm.type || 'guide';
    const section = fm.section || 'agency';
    return {
      title,
      type,
      section,
      status: fm.status || 'draft',
      visibility: fm.visibility || 'internal',
      situation: fm.situation || excerpt(body),
      artifact: fm.artifact || '',
      tags: Array.isArray(fm.tags) ? fm.tags : [],
      path: path.relative(ROOT, file),
      html: mdToHtml(body.replace(/^#\s+.+\n?/, '').trim()),
    };
  }).filter(item => ['ready', 'published'].includes(item.status) && item.visibility !== 'private');
}

function sectionCard(type, items) {
  const label = TYPE_LABELS[type] || type;
  const icon = TYPE_ICONS[type] || '📌';
  const topics = items.slice(0, 4).map(item => `<div class="card-topic">${esc(item.title)}</div>`).join('');
  return `<a href="#${esc(type)}" class="section-card">
      <div class="card-top">
        <div class="card-num-badge">${icon}</div>
        <div class="card-arrow">↓</div>
      </div>
      <div class="card-section-label">Тип материала</div>
      <div class="card-title">${esc(label)}</div>
      <div class="card-desc">${typeDesc(type)}</div>
      <div class="card-topics">${topics}</div>
      <div class="card-footer">
        <div class="card-count"><div class="card-count-dot"></div>${items.length} материалов</div>
        <div class="card-tags-row"><span class="ctag">${esc(label)}</span></div>
      </div>
    </a>`;
}

function typeDesc(type) {
  return {
    'situation-card': 'Рабочие ситуации: что происходит, почему важно, где ломается и что делать дальше.',
    process: 'Повторяемые процессы для входа в задачу, ведения проекта и работы с командой.',
    template: 'Готовые структуры писем, статусов, чеклистов и разборов.',
    principle: 'Короткие управленческие правила, которые держат систему решений.',
  }[type] || 'Материалы базы знаний продюсера.';
}

function renderAccordion(type, items, startIndex) {
  const label = TYPE_LABELS[type] || type;
  return `<section class="material-section" id="${esc(type)}">
    <div class="section-heading">
      <div>
        <div class="page-tag">${esc(label)}</div>
        <h2>${esc(label)}</h2>
      </div>
      <div class="section-count">${items.length} материалов</div>
    </div>
    <div class="cards">
      ${items.map((item, idx) => renderItem(item, startIndex + idx)).join('\n')}
    </div>
  </section>`;
}

function renderItem(item, idx) {
  const section = SECTION_LABELS[item.section] || item.section;
  const type = TYPE_LABELS[item.type] || item.type;
  const tags = item.tags.slice(0, 4).map(tag => `<span class="ctag">${esc(tag)}</span>`).join('');
  return `<div class="card" id="card-${idx}">
    <div class="card-header" onclick="toggleCard(${idx})">
      <div class="card-num">${TYPE_ICONS[item.type] || '📌'}</div>
      <div class="card-header-text">
        <div class="card-title">${esc(item.title)}</div>
        <div class="card-subtitle">${esc(type)} · ${esc(section)}</div>
      </div>
      <div class="card-chevron">›</div>
    </div>
    <div class="card-body">
      <div class="rule-callout"><p><strong>Артефакт:</strong> ${esc(item.artifact || 'рабочий материал')}</p></div>
      ${item.situation ? `<div class="section full"><h4>Ситуация</h4><p class="body-p">${esc(item.situation)}</p></div>` : ''}
      <div class="section full material-content">${item.html}</div>
      <div class="card-tags-row">${tags}</div>
    </div>
  </div>`;
}

function page(items) {
  const byType = ['situation-card', 'process', 'template', 'principle']
    .map(type => [type, items.filter(item => item.type === type)])
    .filter(([, list]) => list.length);
  let index = 0;
  const sections = byType.map(([type, list]) => {
    const html = renderAccordion(type, list, index);
    index += list.length;
    return html;
  }).join('\n');
  const totalCards = items.length;

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="robots" content="noindex, nofollow" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>mass.agency — База знаний продюсера</title>
  <style>
    :root {
      --bg: #0f0f0f; --surface: #1a1a1a; --surface-hover: #212121;
      --border: #2a2a2a; --border-active: #3d3d3d;
      --text-primary: #e8e8e8; --text-secondary: #888; --text-muted: #555;
      --accent: #c8ff00; --accent-dim: rgba(200,255,0,.08); --accent-border: rgba(200,255,0,.2);
      --danger: #ff4d4d; --tag-bg: #242424;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--text-primary); font-family: 'Inter',-apple-system,BlinkMacSystemFont,sans-serif; font-size: 14px; line-height: 1.6; min-height: 100vh; }
    .topbar { display: flex; align-items: center; justify-content: space-between; padding: 0 32px; height: 52px; border-bottom: 1px solid var(--border); position: sticky; top: 0; background: var(--bg); z-index: 100; }
    .topbar-brand { font-size: 13px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
    .topbar-brand span { color: var(--accent); }
    .topbar-nav { display: flex; gap: 24px; }
    .topbar-nav a { color: var(--text-muted); text-decoration: none; font-size: 13px; transition: color .15s; }
    .topbar-nav a:hover { color: var(--text-secondary); }
    .topbar-nav a.active { color: var(--text-primary); }
    .breadcrumb { padding: 20px 32px 0; display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-muted); }
    .breadcrumb a { color: var(--text-muted); text-decoration: none; }
    .breadcrumb-sep { color: var(--border-active); }
    .page { max-width: 1080px; margin: 0 auto; padding: 40px 32px 80px; }
    .page-tag { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; text-transform: uppercase; letter-spacing: .1em; color: var(--accent); background: var(--accent-dim); border: 1px solid var(--accent-border); padding: 3px 10px; border-radius: 4px; margin-bottom: 14px; }
    .page-tag::before { content: ''; width: 6px; height: 6px; background: var(--accent); border-radius: 50%; }
    .page-title { font-size: 32px; font-weight: 700; line-height: 1.2; margin-bottom: 10px; }
    .page-desc { color: var(--text-secondary); font-size: 14px; max-width: 620px; line-height: 1.7; margin-bottom: 8px; }
    .page-meta { font-size: 12px; color: var(--text-muted); margin-bottom: 40px; }
    .divider { height: 1px; background: var(--border); margin-bottom: 32px; }
    .section-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 48px; }
    .section-card { display: block; text-decoration: none; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 24px; transition: border-color .2s, background .2s, transform .15s; position: relative; overflow: hidden; }
    .section-card:hover { border-color: var(--border-active); background: var(--surface-hover); transform: translateY(-1px); }
    .section-card:hover .card-arrow { opacity: 1; transform: translate(0, 0); }
    .section-card::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--accent); opacity: 0; transition: opacity .2s; }
    .section-card:hover::before { opacity: 1; }
    .card-top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
    .card-num-badge { width: 36px; height: 36px; background: var(--accent-dim); border: 1px solid var(--accent-border); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
    .card-arrow { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 16px; opacity: 0; transform: translate(-4px, 4px); transition: opacity .2s, transform .2s; }
    .card-section-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: var(--text-muted); margin-bottom: 6px; }
    .card-title { font-size: 17px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; line-height: 1.3; }
    .card-desc { font-size: 13px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 20px; }
    .card-footer { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .card-count { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-muted); }
    .card-count-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--accent); opacity: .6; }
    .card-tags-row { display: flex; gap: 6px; flex-wrap: wrap; }
    .ctag { font-size: 11px; padding: 2px 8px; border-radius: 4px; background: var(--tag-bg); color: var(--text-muted); border: 1px solid var(--border); }
    .card-topics { display: flex; flex-direction: column; gap: 4px; margin-bottom: 20px; }
    .card-topic { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-muted); }
    .card-topic::before { content: '·'; color: var(--accent); font-size: 16px; line-height: 1; }
    .material-section { margin-top: 40px; scroll-margin-top: 72px; }
    .section-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 16px; }
    .section-heading h2 { font-size: 22px; line-height: 1.2; }
    .section-count { color: var(--text-muted); font-size: 12px; margin-bottom: 4px; }
    .cards { display: flex; flex-direction: column; gap: 8px; }
    .card { border: 1px solid var(--border); border-radius: 10px; background: var(--surface); overflow: hidden; transition: border-color .2s; }
    .card:hover { border-color: var(--border-active); }
    .card.open { border-color: var(--border-active); background: var(--surface-hover); }
    .card-header { display: flex; align-items: center; gap: 16px; padding: 18px 20px; cursor: pointer; user-select: none; }
    .card-num { width: 36px; height: 36px; border-radius: 8px; background: var(--tag-bg); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; transition: all .2s; }
    .card.open .card-num { background: var(--accent-dim); border-color: var(--accent-border); }
    .card-header-text { flex: 1; }
    .card-subtitle { font-size: 12px; color: var(--text-muted); }
    .card-chevron { color: var(--text-muted); font-size: 16px; transition: transform .25s; flex-shrink: 0; margin-left: 12px; }
    .card.open .card-chevron { transform: rotate(90deg); color: var(--text-secondary); }
    .card-body { display: none; padding: 0 20px 24px; border-top: 1px solid var(--border); }
    .card.open .card-body { display: block; }
    .rule-callout { display: flex; gap: 12px; background: var(--accent-dim); border: 1px solid var(--accent-border); border-radius: 8px; padding: 14px 16px; margin: 20px 0 16px; }
    .rule-callout p { font-size: 13px; color: var(--text-primary); line-height: 1.6; }
    .section { background: var(--tag-bg); border: 1px solid var(--border); border-radius: 8px; padding: 14px 16px; margin-bottom: 16px; }
    .section h4, .section h3 { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; color: var(--text-muted); margin-bottom: 10px; }
    .section h5 { font-size: 13px; color: var(--text-primary); margin: 14px 0 8px; }
    .section ul, .section ol { display: flex; flex-direction: column; gap: 6px; padding-left: 18px; color: var(--text-secondary); }
    .section li, .body-p { font-size: 13px; color: var(--text-secondary); line-height: 1.65; margin-bottom: 8px; }
    .section pre { background: #191919; border: 1px solid var(--border); border-radius: 8px; padding: 14px; overflow: auto; color: var(--text-secondary); white-space: pre-wrap; font-size: 13px; line-height: 1.55; }
    .quote-block { background: #191919; border-left: 2px solid var(--accent); border-radius: 0 6px 6px 0; padding: 12px 14px; margin: 8px 0; font-size: 13px; color: var(--text-secondary); line-height: 1.65; }
    .material-content h3 { margin-top: 18px; }
    @media (max-width: 760px) {
      .topbar { padding: 0 16px; }
      .topbar-nav { gap: 12px; }
      .page { padding: 28px 16px 56px; }
      .section-grid { grid-template-columns: 1fr; }
      .card-footer, .section-heading { align-items: flex-start; flex-direction: column; }
    }
  </style>
</head>
<body>
<header class="topbar">
  <div class="topbar-brand"><a href="index.html" style="text-decoration:none;color:inherit">mass<span>.</span>agency</a></div>
  <nav class="topbar-nav">
    <a href="#situation-card" class="active">Ситуации</a>
    <a href="#process">Процессы</a>
    <a href="#template">Шаблоны</a>
  </nav>
</header>

<div class="breadcrumb">
  <span>База знаний</span>
  <span class="breadcrumb-sep">›</span>
  <span>Framework</span>
</div>

<div class="page">
  <div class="page-tag">Framework</div>
  <h1 class="page-title">База знаний продюсера</h1>
  <p class="page-desc">Параллельная система на основе BAZA: рабочие ситуации, процессы, шаблоны и принципы MASS AGENCY.</p>
  <div class="page-meta">Обновлено: 19 июня 2026 · ${totalCards} материалов</div>
  <div class="divider"></div>

  <div class="section-grid">
    ${byType.map(([type, list]) => sectionCard(type, list)).join('\n')}
  </div>

  ${sections}
</div>

<script>
  const TOTAL = ${totalCards};
  const openCards = new Set();
  function toggleCard(i) {
    const card = document.getElementById('card-' + i);
    if (!card) return;
    if (card.classList.contains('open')) {
      card.classList.remove('open');
      openCards.delete(i);
    } else {
      card.classList.add('open');
      openCards.add(i);
    }
  }
</script>
</body>
</html>`;
}

const items = collectItems().sort((a, b) => {
  const order = { 'situation-card': 1, process: 2, template: 3, principle: 4 };
  return (order[a.type] || 9) - (order[b.type] || 9) || a.title.localeCompare(b.title, 'ru');
});

fs.writeFileSync(OUT, page(items));
console.log(`generated ${path.relative(process.cwd(), OUT)} (${items.length} materials)`);

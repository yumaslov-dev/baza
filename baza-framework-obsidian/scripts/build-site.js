#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '06-site', 'index.html');
const CONTENT_DIRS = ['02-cards', '03-processes', '04-templates', '05-principles'];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    if (entry.isFile() && entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

function parseFrontmatter(text) {
  const fm = {};
  if (!text.startsWith('---\n')) return { fm, body: text };
  const end = text.indexOf('\n---\n', 4);
  if (end === -1) return { fm, body: text };
  const raw = text.slice(4, end).split('\n');
  let current = null;
  for (const line of raw) {
    const keyValue = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (keyValue) {
      current = keyValue[1];
      let value = keyValue[2].trim();
      value = value.replace(/^"|"$/g, '');
      fm[current] = value || '';
      continue;
    }
    const listItem = line.match(/^\s*-\s*(.*)$/);
    if (listItem && current) {
      if (!Array.isArray(fm[current])) fm[current] = [];
      fm[current].push(listItem[1].replace(/^"|"$/g, ''));
    }
  }
  return { fm, body: text.slice(end + 5).trim() };
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inline(s) {
  return esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '<span class="wiki-link">$1</span>');
}

function mdToHtml(md) {
  const lines = md.split('\n');
  const out = [];
  let list = null;
  let code = false;
  let codeBuf = [];

  const flushList = () => {
    if (!list) return;
    out.push(`<${list.type}>${list.items.map(item => `<li>${inline(item)}</li>`).join('')}</${list.type}>`);
    list = null;
  };
  const flushCode = () => {
    if (!codeBuf.length) return;
    out.push(`<pre><code>${esc(codeBuf.join('\n'))}</code></pre>`);
    codeBuf = [];
  };

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
      codeBuf.push(raw);
      continue;
    }
    if (!line.trim()) {
      flushList();
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.+)$/);
    if (h) {
      flushList();
      const level = Math.min(h[1].length + 1, 5);
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      continue;
    }
    const ol = line.match(/^\d+\.\s+(.+)$/);
    if (ol) {
      if (!list || list.type !== 'ol') {
        flushList();
        list = { type: 'ol', items: [] };
      }
      list.items.push(ol[1]);
      continue;
    }
    const ul = line.match(/^-\s+(.+)$/);
    if (ul) {
      if (!list || list.type !== 'ul') {
        flushList();
        list = { type: 'ul', items: [] };
      }
      list.items.push(ul[1]);
      continue;
    }
    const quote = line.match(/^>\s?(.+)$/);
    if (quote) {
      flushList();
      out.push(`<blockquote>${inline(quote[1])}</blockquote>`);
      continue;
    }
    flushList();
    out.push(`<p>${inline(line)}</p>`);
  }
  flushList();
  if (code) flushCode();
  return out.join('\n');
}

function excerpt(body) {
  const cleaned = body
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^#.*$/gm, '')
    .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1')
    .replace(/\*\*/g, '')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)
    .find(s => s.length > 40);
  return cleaned || '';
}

function collectItems() {
  const files = CONTENT_DIRS.flatMap(dir => walk(path.join(ROOT, dir)));
  return files.map(file => {
    const raw = fs.readFileSync(file, 'utf8');
    const { fm, body } = parseFrontmatter(raw);
    const title = fm.title || (body.match(/^#\s+(.+)$/m) || [null, path.basename(file, '.md')])[1];
    const slug = path.basename(file, '.md');
    return {
      title,
      slug,
      path: path.relative(ROOT, file),
      type: fm.type || 'guide',
      status: fm.status || 'draft',
      section: fm.section || 'agency',
      audience: fm.audience || '',
      situation: fm.situation || excerpt(body),
      artifact: fm.artifact || '',
      visibility: fm.visibility || 'internal',
      tags: Array.isArray(fm.tags) ? fm.tags : [],
      related: Array.isArray(fm.related) ? fm.related : [],
      html: mdToHtml(body.replace(/^#\s+.+\n?/, '').trim()),
    };
  }).filter(item => ['ready', 'published'].includes(item.status) && item.visibility !== 'private');
}

const sectionLabels = {
  self: 'начать с себя',
  client: 'понять клиента',
  project: 'собрать проект',
  team: 'работать с командой',
  production: 'довести до результата',
  money: 'деньги',
  agency: 'управлять агентством',
};

const typeLabels = {
  'situation-card': 'ситуация',
  process: 'процесс',
  template: 'шаблон',
  principle: 'принцип',
  guide: 'раздел',
};

function page(items) {
  const data = JSON.stringify(items).replace(/</g, '\\u003c');
  const counts = {
    cards: items.filter(i => i.type === 'situation-card').length,
    processes: items.filter(i => i.type === 'process').length,
    templates: items.filter(i => i.type === 'template').length,
    principles: items.filter(i => i.type === 'principle').length,
  };
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, nofollow" />
  <title>База знаний продюсера — MASS AGENCY</title>
  <style>
    :root {
      --bg: #0a0a09;
      --panel: #121211;
      --panel-2: #181815;
      --ink: #f3f0e8;
      --text: #d8d3c7;
      --muted: #8e897d;
      --line: #2d2b25;
      --line-strong: #4a4639;
      --acid: #d7ff2f;
      --paper: #e7dfcc;
      --black: #050505;
      --radius: 6px;
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font: 14px/1.5 Inter, Arial, Helvetica, sans-serif;
      letter-spacing: 0;
    }
    button, input { font: inherit; }
    a { color: inherit; }
    .noise { display: none; }
    .topbar {
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      justify-content: space-between;
      align-items: center;
      min-height: 48px;
      padding: 0 22px;
      border-bottom: 1px solid var(--line);
      background: rgba(10,10,9,.94);
      backdrop-filter: blur(12px);
    }
    .brand {
      text-transform: lowercase;
      font-weight: 700;
      letter-spacing: -.02em;
    }
    .brand span { color: var(--acid); }
    .nav {
      display: flex;
      gap: 18px;
      color: var(--muted);
      font-size: 13px;
      text-transform: lowercase;
    }
    .nav a { text-decoration: none; }
    .shell {
      position: relative;
      z-index: 1;
      width: min(1500px, calc(100vw - 28px));
      margin: 0 auto;
    }
    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 360px;
      gap: 18px;
      align-items: stretch;
      padding: 22px 0 14px;
    }
    .hero-copy {
      min-height: 178px;
      display: grid;
      align-content: space-between;
      gap: 18px;
      padding: 22px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--panel);
    }
    .kicker {
      display: flex;
      gap: 12px;
      align-items: center;
      color: var(--muted);
      text-transform: lowercase;
      font-size: 12px;
    }
    .kicker:before {
      content: "";
      width: 34px;
      height: 1px;
      background: var(--acid);
    }
    h1 {
      margin: 0;
      max-width: 900px;
      font-family: "Arial Narrow", "Helvetica Neue", Arial, sans-serif;
      font-size: clamp(42px, 5vw, 78px);
      line-height: .92;
      letter-spacing: -.052em;
      text-transform: lowercase;
    }
    .hero-text {
      max-width: 720px;
      color: var(--text);
      font-size: 18px;
      line-height: 1.35;
      letter-spacing: -.015em;
    }
    .hero-panel {
      display: grid;
      align-content: space-between;
      min-height: 178px;
      padding: 18px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--panel);
    }
    .years {
      display: flex;
      justify-content: space-between;
      color: var(--muted);
      text-transform: lowercase;
      font-size: 12px;
    }
    .big-count {
      font-family: "Arial Narrow", "Helvetica Neue", Arial, sans-serif;
      font-size: 48px;
      line-height: .95;
      letter-spacing: -.045em;
    }
    .big-count span { color: var(--acid); }
    .panel-caption {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 6px 12px;
      color: var(--muted);
      font-size: 12px;
      text-transform: lowercase;
    }
    .controls {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 10px;
      margin: 0 0 10px;
      padding: 10px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--panel);
    }
    .search {
      width: 100%;
      height: 42px;
      padding: 0 12px;
      color: var(--ink);
      border: 1px solid var(--line);
      border-radius: 6px;
      outline: none;
      background: var(--black);
    }
    .search:focus { border-color: var(--acid); }
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .filter {
      height: 42px;
      padding: 0 12px;
      border: 1px solid var(--line);
      border-radius: 6px;
      color: var(--muted);
      background: transparent;
      cursor: pointer;
      text-transform: lowercase;
    }
    .filter.active {
      color: #111;
      border-color: var(--acid);
      background: var(--acid);
    }
    .dashboard {
      display: grid;
      grid-template-columns: 230px minmax(430px, .86fr) minmax(430px, 1.14fr);
      gap: 10px;
      align-items: start;
      padding-bottom: 36px;
    }
    .rail, .detail {
      position: sticky;
      top: 58px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--panel);
      overflow: hidden;
    }
    .rail-head, .detail-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 12px;
      border-bottom: 1px solid var(--line);
      color: var(--muted);
      font-size: 12px;
      text-transform: lowercase;
    }
    .section-list { display: grid; }
    .section-button {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 10px;
      width: 100%;
      padding: 11px 12px;
      border: 0;
      border-bottom: 1px solid var(--line);
      color: var(--ink);
      text-align: left;
      background: transparent;
      cursor: pointer;
      text-transform: lowercase;
    }
    .section-button span { color: var(--muted); }
    .section-button.active {
      color: #111;
      background: var(--acid);
    }
    .section-button.active span { color: #111; }
    .grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 6px;
    }
    .card {
      min-height: 0;
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px 16px;
      padding: 13px 14px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--panel);
      cursor: pointer;
      transition: border-color .15s ease, background .15s ease;
    }
    .card:hover, .card.active {
      border-color: var(--acid);
      background: var(--panel-2);
    }
    .card-top {
      display: flex;
      gap: 8px;
      color: var(--muted);
      font-size: 12px;
      text-transform: lowercase;
      grid-column: 1 / -1;
    }
    .card-title {
      margin: 0;
      font-family: "Arial Narrow", "Helvetica Neue", Arial, sans-serif;
      font-size: 24px;
      line-height: 1;
      letter-spacing: -.035em;
      text-transform: lowercase;
    }
    .card p {
      margin: 0;
      color: var(--muted);
      grid-column: 1 / -1;
      max-width: 680px;
    }
    .artifact {
      color: var(--acid);
      font-size: 13px;
      text-transform: lowercase;
      grid-column: 1 / -1;
    }
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .tag {
      padding: 3px 7px;
      border: 1px solid var(--line);
      border-radius: 999px;
      color: var(--muted);
      font-size: 11px;
      text-transform: lowercase;
    }
    .detail {
      max-height: calc(100vh - 58px);
      overflow: auto;
    }
    .detail-body { padding: 20px 22px 28px; }
    .detail-title {
      margin: 0 0 14px;
      font-family: "Arial Narrow", "Helvetica Neue", Arial, sans-serif;
      font-size: 40px;
      line-height: .98;
      letter-spacing: -.04em;
      text-transform: lowercase;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 20px;
    }
    .pill {
      padding: 5px 9px;
      color: #111;
      background: #d9d1bd;
      border-radius: 999px;
      font-size: 12px;
      text-transform: lowercase;
    }
    .pill.acid { background: var(--acid); }
    .content h2, .content h3, .content h4 {
      margin: 24px 0 8px;
      font-family: "Arial Narrow", "Helvetica Neue", Arial, sans-serif;
      font-size: 22px;
      line-height: 1.05;
      letter-spacing: -.025em;
      text-transform: lowercase;
    }
    .content p, .content li {
      color: var(--text);
    }
    .content ul, .content ol {
      padding-left: 20px;
    }
    .content pre {
      overflow: auto;
      padding: 14px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--black);
      color: var(--paper);
      white-space: pre-wrap;
    }
    .wiki-link {
      color: var(--acid);
    }
    .empty {
      display: none;
      padding: 52px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      color: var(--muted);
      text-align: center;
      background: var(--panel);
    }
    .footer {
      display: flex;
      justify-content: space-between;
      gap: 18px;
      padding: 18px 0 32px;
      color: var(--muted);
      border-top: 1px solid var(--line);
      text-transform: lowercase;
    }
    @media (max-width: 1100px) {
      .hero, .dashboard { grid-template-columns: 1fr; }
      .hero-panel, .rail, .detail { position: static; }
      .grid { grid-template-columns: 1fr; }
      .controls { grid-template-columns: 1fr; }
    }
    @media (max-width: 620px) {
      .topbar { padding: 0 16px; }
      .nav { display: none; }
      .shell { width: min(100vw - 24px, 1480px); }
      .hero { min-height: auto; padding-top: 52px; }
      h1 { font-size: 44px; }
      .hero-copy { padding: 16px; }
      .hero-text { font-size: 16px; }
      .big-count { font-size: 40px; }
      .filters { display: grid; grid-template-columns: repeat(2, 1fr); }
      .filter { width: 100%; }
      .card-title { font-size: 22px; }
    }
    @media (prefers-reduced-motion: reduce) {
      * { scroll-behavior: auto !important; transition: none !important; }
    }
  </style>
</head>
<body>
  <div class="noise"></div>
  <header class="topbar">
    <div class="brand">mass<span>.</span> knowledge</div>
    <nav class="nav">
      <a href="#situations">ситуации</a>
      <a href="#processes">процессы</a>
      <a href="#templates">шаблоны</a>
      <a href="#principles">принципы</a>
    </nav>
  </header>

  <main class="shell">
    <section class="hero">
      <div class="hero-copy">
        <div class="kicker">2015-${year} / продакшн / люди / решения</div>
        <h1>база знаний продюсера</h1>
        <div class="hero-text">Рабочий интерфейс MASS AGENCY для ситуаций, где нужно быстро понять контекст, назвать риск и собрать следующий шаг.</div>
      </div>
      <aside class="hero-panel">
        <div class="years"><span>внутренняя версия</span><span>ready</span></div>
        <div>
          <div class="big-count"><span>${items.length}</span> материалов</div>
        </div>
        <div class="panel-caption">
          <span>${counts.cards} ситуаций</span>
          <span>${counts.processes} процесса</span>
          <span>${counts.templates} шаблонов</span>
          <span>${counts.principles} принципа</span>
        </div>
      </aside>
    </section>

    <section class="controls" aria-label="фильтры базы">
      <input class="search" id="search" placeholder="найти ситуацию, письмо, риск, задачу..." />
      <div class="filters" id="typeFilters"></div>
    </section>

    <section class="dashboard" id="situations">
      <aside class="rail">
        <div class="rail-head"><span>раздел</span><span id="totalCount"></span></div>
        <div class="section-list" id="sectionFilters"></div>
      </aside>

      <div>
        <div class="grid" id="grid"></div>
        <div class="empty" id="empty">ничего не найдено. попробуйте убрать фильтр или изменить запрос.</div>
      </div>

      <aside class="detail" id="detail">
        <div class="detail-head"><span>предпросмотр</span><span id="detailPath"></span></div>
        <div class="detail-body">
          <h2 class="detail-title" id="detailTitle"></h2>
          <div class="meta" id="detailMeta"></div>
          <div class="content" id="detailContent"></div>
        </div>
      </aside>
    </section>

    <footer class="footer">
      <span>mass agency / knowledge framework</span>
      <span>локальный html-прототип</span>
    </footer>
  </main>

  <script>
    const items = ${data};
    const sectionLabels = ${JSON.stringify(sectionLabels)};
    const typeLabels = ${JSON.stringify(typeLabels)};
    let activeType = 'all';
    let activeSection = 'all';
    let activeSlug = items[0]?.slug;

    const grid = document.getElementById('grid');
    const empty = document.getElementById('empty');
    const search = document.getElementById('search');
    const typeFilters = document.getElementById('typeFilters');
    const sectionFilters = document.getElementById('sectionFilters');
    const totalCount = document.getElementById('totalCount');
    const detailTitle = document.getElementById('detailTitle');
    const detailMeta = document.getElementById('detailMeta');
    const detailContent = document.getElementById('detailContent');
    const detailPath = document.getElementById('detailPath');

    function uniq(list) { return [...new Set(list)].filter(Boolean); }

    function renderFilters() {
      const types = ['all', ...uniq(items.map(i => i.type))];
      typeFilters.innerHTML = types.map(type => '<button class="filter ' + (activeType === type ? 'active' : '') + '" data-type="' + type + '">' + (type === 'all' ? 'все' : typeLabels[type] || type) + '</button>').join('');
      typeFilters.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', () => {
          activeType = button.dataset.type;
          render();
        });
      });

      const sections = ['all', ...uniq(items.map(i => i.section))];
      sectionFilters.innerHTML = sections.map(section => {
        const count = section === 'all' ? items.length : items.filter(i => i.section === section).length;
        return '<button class="section-button ' + (activeSection === section ? 'active' : '') + '" data-section="' + section + '"><strong>' + (section === 'all' ? 'вся база' : sectionLabels[section] || section) + '</strong><span>' + count + '</span></button>';
      }).join('');
      sectionFilters.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', () => {
          activeSection = button.dataset.section;
          render();
        });
      });
    }

    function filtered() {
      const q = search.value.trim().toLowerCase();
      return items.filter(item => {
        const haystack = [item.title, item.situation, item.artifact, item.type, item.section, ...item.tags].join(' ').toLowerCase();
        return (activeType === 'all' || item.type === activeType)
          && (activeSection === 'all' || item.section === activeSection)
          && (!q || haystack.includes(q));
      });
    }

    function renderCards(list) {
      grid.innerHTML = list.map(item => {
        const tags = item.tags.slice(0, 4).map(tag => '<span class="tag">' + tag + '</span>').join('');
        return '<article class="card ' + (activeSlug === item.slug ? 'active' : '') + '" data-slug="' + item.slug + '" tabindex="0">' +
          '<div class="card-top"><span>' + (typeLabels[item.type] || item.type) + '</span><span>' + (sectionLabels[item.section] || item.section) + '</span></div>' +
          '<div><h2 class="card-title">' + item.title + '</h2></div>' +
          '<p>' + (item.situation || '') + '</p>' +
          '<div class="artifact">' + (item.artifact || 'рабочий материал') + '</div>' +
          '<div class="tags">' + tags + '</div>' +
        '</article>';
      }).join('');
      grid.querySelectorAll('.card').forEach(card => {
        const open = () => {
          activeSlug = card.dataset.slug;
          showDetail(items.find(item => item.slug === activeSlug));
          renderCards(filtered());
        };
        card.addEventListener('click', open);
        card.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            open();
          }
        });
      });
      empty.style.display = list.length ? 'none' : 'block';
      totalCount.textContent = list.length;
    }

    function showDetail(item) {
      if (!item) return;
      detailTitle.textContent = item.title;
      detailPath.textContent = item.path;
      detailMeta.innerHTML = [
        '<span class="pill acid">' + (typeLabels[item.type] || item.type) + '</span>',
        '<span class="pill">' + (sectionLabels[item.section] || item.section) + '</span>',
        item.artifact ? '<span class="pill">' + item.artifact + '</span>' : ''
      ].join('');
      detailContent.innerHTML = item.html;
    }

    function render() {
      renderFilters();
      const list = filtered();
      if (!list.find(item => item.slug === activeSlug)) activeSlug = list[0]?.slug;
      renderCards(list);
      showDetail(items.find(item => item.slug === activeSlug) || list[0]);
    }

    search.addEventListener('input', render);
    render();
  </script>
</body>
</html>`;
}

const items = collectItems().sort((a, b) => {
  const order = { 'situation-card': 1, process: 2, template: 3, principle: 4, guide: 5 };
  return (order[a.type] || 9) - (order[b.type] || 9) || a.title.localeCompare(b.title, 'ru');
});

fs.writeFileSync(OUT, page(items));
console.log(`generated ${path.relative(process.cwd(), OUT)} (${items.length} materials)`);

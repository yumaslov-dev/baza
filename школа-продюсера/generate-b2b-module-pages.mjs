import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));

const modules = [
  { n: 1, md: 'b2b-modul-01-prodyuserskaya-rol.md', html: 'b2b-module-01.html', title: 'Продюсерская роль', subtitle: 'Роль, результат, видимая и невидимая работа.' },
  { n: 2, md: 'b2b-modul-02-vhod-v-professiyu.md', html: 'b2b-module-02.html', title: 'Вход в профессию', subtitle: 'Самопродюсирование, первый самостоятельный контур и честное предъявление опыта.' },
  { n: 3, md: 'b2b-modul-03-klient-i-zadacha.md', html: 'b2b-module-03.html', title: 'Клиент и задача', subtitle: 'Первичный запрос, бюджет, вопросы, саммари и защита решения.' },
  { n: 4, md: 'b2b-modul-04-proekt-i-dengi.md', html: 'b2b-module-04.html', title: 'Проект и деньги', subtitle: 'Риски, правки, доплаты, статус и экономическая управляемость.' },
  { n: 5, md: 'b2b-modul-05-komanda-i-otvetstvennost.md', html: 'b2b-module-05.html', title: 'Команда и ответственность', subtitle: 'Постановка задач, помощь, ошибки и рост самостоятельности.' },
  { n: 6, md: 'b2b-modul-06-slozhnye-razgovory-i-rost.md', html: 'b2b-module-06.html', title: 'Сложные разговоры и рост', subtitle: 'Твёрдость, позиция нужды, отказ и зрелость продюсера.' },
];

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function inlineMd(value) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1');
}

function cardId(index) {
  return `card-${String(index).padStart(2, '0')}`;
}

function parseMarkdown(source) {
  const body = source.replace(/^---[\s\S]*?---\s*/, '').trim();
  const lines = body.split(/\r?\n/);
  const cards = [];
  let current = null;
  let currentSection = null;
  let code = null;

  function addItem(item) {
    if (currentSection) currentSection.items.push(item);
  }

  function addLine(line) {
    if (code) {
      if (line.startsWith('```')) {
        addItem({ type: 'code', text: code.join('\n') });
        code = null;
      } else {
        code.push(line);
      }
      return;
    }

    if (line.startsWith('```')) {
      code = [];
      return;
    }

    if (line.startsWith('### ')) {
      currentSection = { title: line.replace(/^### /, '').trim(), items: [] };
      current.sections.push(currentSection);
      return;
    }

    if (!currentSection) return;

    const trimmed = line.trim();
    if (!trimmed) return;

    if (/^[-*] /.test(trimmed)) {
      const last = currentSection.items.at(-1);
      if (!last || last.type !== 'ul') addItem({ type: 'ul', items: [] });
      currentSection.items.at(-1).items.push(trimmed.replace(/^[-*] /, ''));
      return;
    }

    if (/^\d+\. /.test(trimmed)) {
      const last = currentSection.items.at(-1);
      if (!last || last.type !== 'ol') addItem({ type: 'ol', items: [] });
      currentSection.items.at(-1).items.push(trimmed.replace(/^\d+\. /, ''));
      return;
    }

    if (/^> /.test(trimmed)) {
      addItem({ type: 'quote', text: trimmed.replace(/^> /, '') });
      return;
    }

    addItem({ type: 'p', text: trimmed });
  }

  for (const line of lines) {
    if (line.startsWith('## Карточка ')) {
      current = { title: line.replace(/^## /, '').trim(), sections: [] };
      cards.push(current);
      currentSection = null;
      continue;
    }
    if (!current || line.startsWith('---')) continue;
    addLine(line);
  }

  return cards;
}

function renderItem(item) {
  if (item.type === 'p') return `<p>${inlineMd(item.text)}</p>`;
  if (item.type === 'quote') return `<blockquote>${inlineMd(item.text)}</blockquote>`;
  if (item.type === 'code') return `<pre><code>${escapeHtml(item.text)}</code></pre>`;
  if (item.type === 'ul') return `<ul>${item.items.map((entry) => `<li>${inlineMd(entry)}</li>`).join('')}</ul>`;
  if (item.type === 'ol') return `<ol>${item.items.map((entry) => `<li>${inlineMd(entry)}</li>`).join('')}</ol>`;
  return '';
}

function cleanCardTitle(title) {
  return title.replace(/^Карточка\s+\d+\.\s*/, '');
}

function renderCards(cards) {
  return cards.map((card, index) => {
    const sections = card.sections.map((section) => `
      <section class="card-section">
        <h3>${inlineMd(section.title)}</h3>
        ${section.items.map(renderItem).join('\n')}
      </section>`).join('\n');

    return `<article class="card" id="${cardId(index + 1)}">
      <div class="card-kicker">Карточка ${index + 1}</div>
      <h2>${inlineMd(cleanCardTitle(card.title))}</h2>
      ${sections}
    </article>`;
  }).join('\n');
}

function pageCss() {
  return `
    :root {
      --bg: #f5efe2;
      --paper: #fffaf0;
      --ink: #171713;
      --muted: #6f6a5f;
      --line: #ddd3bf;
      --green: #2f5138;
      --green-dark: #1e3426;
      --acid: #c8ff00;
      --panel: #ebe2cf;
      --shadow: 0 18px 70px rgba(35, 32, 25, .12);
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body { margin: 0; background: var(--bg); color: var(--ink); font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.62; }
    a { color: inherit; }
    .topbar { position: sticky; top: 0; z-index: 20; min-height: 58px; display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 12px clamp(18px, 5vw, 72px); border-bottom: 1px solid var(--line); background: rgba(245, 239, 226, .94); backdrop-filter: blur(14px); }
    .brand { text-decoration: none; font-size: 12px; font-weight: 900; letter-spacing: .14em; text-transform: uppercase; }
    .brand span { color: var(--green); }
    .topbar nav { display: flex; flex-wrap: wrap; gap: 10px; justify-content: flex-end; }
    .topbar nav a { display: inline-flex; align-items: center; min-height: 34px; padding: 6px 10px; border-radius: 7px; border: 1px solid transparent; color: var(--muted); font-size: 13px; text-decoration: none; }
    .topbar nav a:hover { border-color: var(--line); color: var(--ink); background: var(--paper); }
    .hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(300px, .42fr); gap: clamp(28px, 5vw, 72px); align-items: end; padding: clamp(44px, 7vw, 92px) clamp(18px, 6vw, 86px); background: radial-gradient(circle at 82% 10%, rgba(200,255,0,.18), transparent 18rem), linear-gradient(125deg, rgba(47,81,56,.10), transparent 48%); }
    .eyebrow { display: inline-flex; width: fit-content; margin-bottom: 18px; padding: 5px 9px; border-radius: 5px; border: 1px solid rgba(47,81,56,.24); color: var(--green); font-size: 11px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; }
    h1, h2, h3, p { margin-top: 0; }
    h1 { max-width: 980px; margin-bottom: 20px; font-size: clamp(44px, 7vw, 92px); line-height: .92; letter-spacing: -.052em; }
    .lead { max-width: 760px; margin-bottom: 0; color: var(--muted); font-size: clamp(18px, 2vw, 22px); line-height: 1.72; }
    .module-summary { border-radius: 20px; background: var(--green-dark); color: var(--paper); padding: 24px; box-shadow: var(--shadow); }
    .module-summary strong { display: block; margin-bottom: 12px; font-size: 22px; line-height: 1.14; }
    .module-summary p { color: rgba(255,250,240,.76); margin-bottom: 16px; }
    .progress { display: grid; grid-template-columns: repeat(6, 1fr); gap: 5px; }
    .progress a { height: 32px; display: grid; place-items: center; border-radius: 7px; background: rgba(255,250,240,.12); color: rgba(255,250,240,.76); text-decoration: none; font-size: 12px; font-weight: 900; }
    .progress a.active { background: var(--acid); color: var(--green-dark); }
    .layout { display: grid; grid-template-columns: 290px minmax(0, 1fr); gap: 28px; padding: 34px clamp(18px, 6vw, 86px) 78px; }
    .toc { position: sticky; top: 82px; align-self: start; border: 1px solid var(--line); border-radius: 16px; background: var(--paper); padding: 18px; max-height: calc(100vh - 110px); overflow: auto; }
    .toc-title { margin-bottom: 12px; color: var(--green); font-size: 12px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; }
    .toc a { display: block; padding: 8px 0; border-top: 1px solid rgba(221,211,191,.6); color: var(--muted); text-decoration: none; font-size: 14px; line-height: 1.25; }
    .toc a:hover { color: var(--ink); }
    .content { display: grid; gap: 18px; }
    .card { border: 1px solid var(--line); border-radius: 20px; background: var(--paper); padding: clamp(22px, 4vw, 34px); box-shadow: 0 1px 0 rgba(255,255,255,.72) inset; scroll-margin-top: 88px; }
    .card-kicker { margin-bottom: 10px; color: var(--green); font-size: 12px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; }
    .card h2 { margin-bottom: 22px; font-size: clamp(30px, 4vw, 46px); line-height: 1; letter-spacing: -.04em; }
    .card-section { padding: 18px 0; border-top: 1px solid var(--line); }
    .card-section h3 { margin-bottom: 10px; color: var(--green); font-size: 15px; line-height: 1.2; letter-spacing: -.01em; }
    .card-section p { color: var(--muted); }
    .card-section p:last-child, .card-section ul:last-child, .card-section ol:last-child, .card-section blockquote:last-child, .card-section pre:last-child { margin-bottom: 0; }
    ul, ol { padding-left: 22px; color: var(--muted); }
    li + li { margin-top: 6px; }
    strong { color: var(--ink); }
    blockquote { margin: 12px 0; padding: 14px 16px; border-left: 4px solid var(--green); border-radius: 8px; background: var(--panel); color: var(--ink); }
    pre { overflow: auto; margin: 14px 0; padding: 16px; border-radius: 12px; background: var(--panel); color: var(--ink); font-family: inherit; font-size: 14px; white-space: pre-wrap; }
    code { font-family: inherit; }
    .pager { display: flex; justify-content: space-between; gap: 14px; padding: 0 clamp(18px, 6vw, 86px) 56px; }
    .pager a { flex: 1; min-height: 64px; display: flex; align-items: center; justify-content: center; padding: 14px 18px; border: 1px solid var(--line); border-radius: 14px; background: var(--paper); color: var(--ink); text-align: center; text-decoration: none; font-weight: 800; }
    .pager a:hover { border-color: rgba(47,81,56,.36); box-shadow: var(--shadow); }
    .footer { padding: 0 clamp(18px, 6vw, 86px) 46px; color: var(--muted); font-size: 13px; }
    @media (max-width: 980px) { .hero, .layout { grid-template-columns: 1fr; } .toc { position: static; max-height: none; } }
    @media (max-width: 700px) { .topbar { align-items: flex-start; flex-direction: column; } .topbar nav { justify-content: flex-start; } h1 { font-size: 48px; } .pager { flex-direction: column; } }
`;
}

function renderPage(mod, cards) {
  const previous = modules[mod.n - 2];
  const next = modules[mod.n];
  const progress = modules.map((entry) => `<a class="${entry.n === mod.n ? 'active' : ''}" href="${entry.html}">${entry.n}</a>`).join('');
  const toc = cards.map((card, index) => `<a href="#${cardId(index + 1)}">${index + 1}. ${inlineMd(cleanCardTitle(card.title))}</a>`).join('\n');

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="robots" content="noindex, nofollow" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Модуль ${mod.n}. ${escapeHtml(mod.title)} — B2B-курс</title>
  <style>${pageCss()}</style>
</head>
<body>
  <header class="topbar">
    <a class="brand" href="b2b-course.html">mass<span>.</span>method</a>
    <nav>
      <a href="b2b-course.html">Все модули</a>
      <a href="b2b-kurs-prodyuserskoe-myshlenie.md">Карта курса</a>
      ${previous ? `<a href="${previous.html}">Предыдущий</a>` : ''}
      ${next ? `<a href="${next.html}">Следующий</a>` : ''}
    </nav>
  </header>

  <main>
    <section class="hero">
      <div>
        <div class="eyebrow">Модуль ${mod.n}</div>
        <h1>${escapeHtml(mod.title)}</h1>
        <p class="lead">${escapeHtml(mod.subtitle)}</p>
      </div>
      <aside class="module-summary">
        <strong>Навигация по курсу</strong>
        <p>В модуле 10 ситуационных карточек. Каждая ведёт от рабочей ситуации к действию, артефакту и критерию результата.</p>
        <div class="progress" aria-label="Модули курса">${progress}</div>
      </aside>
    </section>

    <div class="layout">
      <aside class="toc">
        <div class="toc-title">Карточки модуля</div>
        ${toc}
      </aside>
      <section class="content">
        ${renderCards(cards)}
      </section>
    </div>

    <nav class="pager" aria-label="Навигация между модулями">
      ${previous ? `<a href="${previous.html}">← Модуль ${previous.n}. ${escapeHtml(previous.title)}</a>` : '<a href="b2b-course.html">← Все модули</a>'}
      ${next ? `<a href="${next.html}">Модуль ${next.n}. ${escapeHtml(next.title)} →</a>` : '<a href="b2b-course.html">Все модули →</a>'}
    </nav>
  </main>

  <footer class="footer">B2B-курс «Продюсерское мышление». Модуль ${mod.n} из 6.</footer>
</body>
</html>`;
}

for (const mod of modules) {
  const markdown = await readFile(join(dir, mod.md), 'utf8');
  const cards = parseMarkdown(markdown);
  await writeFile(join(dir, mod.html), renderPage(mod, cards), 'utf8');
  console.log(`generated ${mod.html}: ${cards.length} cards`);
}

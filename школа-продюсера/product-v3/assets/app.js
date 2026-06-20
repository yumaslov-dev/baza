import { modules, cards, method, marketQuestions, validationMessage, allCards } from "./data.js";

const page = document.body.dataset.page;
const params = new URLSearchParams(window.location.search);
const moduleById = Object.fromEntries(modules.map((item) => [item.id, item]));
const all = allCards();
const cardById = Object.fromEntries(all.map((item) => [item.id, item]));

function esc(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function list(items = []) {
  return `<ol>${items.map((item) => `<li>${esc(item)}</li>`).join("")}</ol>`;
}

function pills(items = []) {
  return items.map((item) => `<span class="pill">${esc(item)}</span>`).join("");
}

function lessonLink(id) {
  return `card.html?id=${encodeURIComponent(id)}`;
}

function renderHome() {
  const root = document.querySelector("#entryGrid");
  if (!root) return;

  root.innerHTML = modules.map((module) => `
    <a class="entry-card" href="module.html?id=${module.id}">
      <small>${esc(module.short)}</small>
      <h3>${esc(module.title)}</h3>
      <p>${esc(module.promise)}</p>
      <div class="entry-meta">${pills(module.tags)}</div>
    </a>
  `).join("");
}

function renderModule() {
  const root = document.querySelector("#moduleRoot");
  if (!root) return;

  const moduleId = params.get("id") || "grow";
  const module = moduleById[moduleId] || modules[0];
  const lessons = module.lessons.map((id) => cardById[id]).filter(Boolean);

  root.innerHTML = `
    <section class="page-hero compact">
      <div class="eyebrow">Мини-модуль</div>
      <h1>${esc(module.title)}</h1>
      <p>${esc(module.promise)}</p>
    </section>

    <section class="section">
      <div class="module-layout">
        <aside class="module-aside">
          <h3>Методология модуля</h3>
          <p>${esc(module.theory)}</p>
          <p><strong>Для кого:</strong><br>${esc(module.audience)}</p>
          <p><strong>Артефакт:</strong><br>${esc(module.artifact)}</p>
          <a href="situations.html">Открыть все ситуации</a>
          <a href="method.html">Посмотреть авторский метод</a>
        </aside>

        <div>
          <div class="section-head">
            <div>
              <div class="eyebrow">От теории к практике</div>
              <h2>${lessons.length} карточек пути</h2>
            </div>
            <p>Карточки идут как маршрут: сначала управленческая теория, затем ситуации, упражнения и артефакты.</p>
          </div>
          <div class="lesson-list">
            ${lessons.map((lesson, index) => `
              <a class="lesson-card" href="${lessonLink(lesson.id)}">
                <small>${String(index + 1).padStart(2, "0")} · ${esc(lesson.type || "карточка")}</small>
                <h3>${esc(lesson.title)}</h3>
                <p>${esc(lesson.summary)}</p>
                <footer>${pills([lesson.artifact || "артефакт", module.short])}</footer>
              </a>
            `).join("")}
          </div>
        </div>
      </div>
    </section>

    <section class="section section-muted">
      <div class="section-head">
        <div>
          <div class="eyebrow">Что должно остаться</div>
          <h2>Артефакты модуля</h2>
        </div>
      </div>
      <div class="artifact-grid">
        ${lessons.slice(0, 6).map((lesson) => `
          <article class="artifact-card">
            <small>${esc(module.short)}</small>
            <h3>${esc(lesson.artifact || lesson.title)}</h3>
            <p>${esc(lesson.criterion || lesson.summary)}</p>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function fallbackCard(card) {
  const module = moduleById[card.module] || modules[0];
  return {
    theory: module.theory,
    situation: `Эта карточка нужна, когда человек находится в зоне "${module.title}" и сталкивается с проблемой: ${card.summary}`,
    breaks: [
      "Проблему замечают поздно.",
      "Нет общей картины ситуации.",
      "Разговор или решение не фиксируются.",
      "Артефакт появляется после конфликта, а не до него."
    ],
    actions: [
      "Назвать, что происходит фактически.",
      "Понять, на какой результат это влияет.",
      "Выбрать один следующий шаг.",
      "Зафиксировать договорённость письменно.",
      "Вернуться к критерию результата."
    ],
    template: `Факт: [что происходит].\nВлияние: [на что это влияет].\nСледующий шаг: [что делаем].\nОтветственный: [кто].\nСрок проверки: [когда].`,
    criterion: `В результате появляется ${card.artifact || "рабочий артефакт"}, по которому можно действовать дальше.`,
    rule: "Если ситуацию нельзя зафиксировать, ею трудно управлять."
  };
}

function renderCard() {
  const root = document.querySelector("#cardRoot");
  if (!root) return;

  const id = params.get("id") || "producer-as-manager";
  const card = cardById[id] || cardById["producer-as-manager"];
  const module = moduleById[card.module] || modules[0];
  const detail = { ...fallbackCard(card), ...card };
  const moduleLessons = module.lessons || [];
  const currentIndex = moduleLessons.indexOf(card.id);
  const nextId = moduleLessons[currentIndex + 1] || moduleLessons[0];

  root.innerHTML = `
    <section class="card-page">
      <article class="reading">
        <div class="eyebrow">${esc(module.title)}</div>
        <h1>${esc(card.title)}</h1>
        <p class="lead">${esc(card.summary)}</p>

        <div class="reading-section">
          <h2>Теория</h2>
          <p>${esc(detail.theory)}</p>
        </div>
        <div class="reading-section">
          <h2>Ситуация</h2>
          <p>${esc(detail.situation)}</p>
        </div>
        <div class="reading-section">
          <h2>Где обычно ломается</h2>
          ${list(detail.breaks)}
        </div>
        <div class="reading-section">
          <h2>Что делать</h2>
          ${list(detail.actions)}
        </div>
        <div class="reading-section">
          <h2>Критерий результата</h2>
          <p>${esc(detail.criterion)}</p>
        </div>
      </article>

      <aside class="side-panel">
        <div class="template-box">
          <h3>Шаблон / упражнение</h3>
          <pre>${esc(detail.template)}</pre>
        </div>
        <div class="template-box">
          <h3>Артефакт</h3>
          <p>${esc(detail.artifact || card.artifact || "Рабочий артефакт")}</p>
        </div>
        <div class="rule-box">
          <h3>Главное правило</h3>
          <p>${esc(detail.rule)}</p>
        </div>
        <div class="next-box">
          <h3>Дальше</h3>
          <p><a href="module.html?id=${module.id}">Вернуться в модуль</a></p>
          <p><a href="${lessonLink(nextId)}">Следующая карточка</a></p>
        </div>
      </aside>
    </section>
  `;
}

function renderSituations() {
  const root = document.querySelector("#situationGrid");
  const filtersRoot = document.querySelector("#situationFilters");
  if (!root || !filtersRoot) return;

  const categories = ["all", ...modules.map((item) => item.id)];
  let active = "all";

  function renderFilters() {
    filtersRoot.innerHTML = categories.map((category) => {
      const label = category === "all" ? "Все" : moduleById[category].title;
      return `<button class="filter ${category === active ? "active" : ""}" data-filter="${category}">${esc(label)}</button>`;
    }).join("");
  }

  function renderGrid() {
    const items = active === "all" ? all : all.filter((item) => item.module === active);
    root.innerHTML = items.map((card) => {
      const module = moduleById[card.module] || modules[0];
      return `
        <a class="catalog-card" href="${lessonLink(card.id)}">
          <small>${esc(module.short)}</small>
          <h3>${esc(card.title)}</h3>
          <p>${esc(card.summary)}</p>
          <footer>${pills([card.artifact || "артефакт"])}</footer>
        </a>
      `;
    }).join("");
  }

  filtersRoot.addEventListener("click", (event) => {
    const button = event.target.closest(".filter");
    if (!button) return;
    active = button.dataset.filter;
    renderFilters();
    renderGrid();
  });

  renderFilters();
  renderGrid();
}

function renderMethod() {
  const root = document.querySelector("#methodRoot");
  if (!root) return;

  root.innerHTML = `
    <section class="page-hero compact">
      <div class="eyebrow">Авторский слой</div>
      <h1>Метод управления креативной работой</h1>
      <p>Этот блок должен объяснять, почему карточки устроены именно так. Начало метода — человек уже управляет. Конец метода — человек удерживает больше реальности и создаёт систему вокруг себя.</p>
    </section>

    <section class="section">
      <div class="method-map">
        <aside class="method-thesis">
          <div class="eyebrow">Тезис</div>
          <h2>От ремесла к ответственности</h2>
          <p>Метод не учит “быть начальником”. Он помогает творческому специалисту увидеть, что вокруг его работы уже есть клиент, деньги, сроки, люди, риск и результат. Управленческий рост начинается с ясности в этих связях.</p>
        </aside>
        <div class="principle-grid">
          ${method.map((item) => `
            <article class="principle-card">
              <small>Принцип</small>
              <h3>${esc(item.title)}</h3>
              <p>${esc(item.text)}</p>
            </article>
          `).join("")}
        </div>
      </div>
    </section>
  `;
}

function renderMarket() {
  const root = document.querySelector("#marketRoot");
  if (!root) return;

  root.innerHTML = `
    <section class="page-hero compact">
      <div class="eyebrow">Маркетинговая система</div>
      <h1>Как проверять MVP</h1>
      <p>На этом этапе задача — найти не идеальную упаковку, а живые ниши: кому это полезно, в какой ситуации, каким языком и в каком формате.</p>
    </section>

    <section class="section">
      <div class="section-head">
        <div>
          <div class="eyebrow">Вопросы респонденту</div>
          <h2>Что спрашивать</h2>
        </div>
      </div>
      <div class="question-grid">
        ${marketQuestions.map((question, index) => `
          <article class="question-card">
            <small>${String(index + 1).padStart(2, "0")}</small>
            <h3>${esc(question)}</h3>
          </article>
        `).join("")}
      </div>
    </section>

    <section class="section section-muted">
      <div class="market-message">
        <div class="eyebrow">Сообщение</div>
        <h2>Текст для первых людей</h2>
        <pre>${esc(validationMessage)}</pre>
      </div>
    </section>
  `;
}

if (page === "home") renderHome();
if (page === "module") renderModule();
if (page === "card") renderCard();
if (page === "situations") renderSituations();
if (page === "method") renderMethod();
if (page === "market") renderMarket();

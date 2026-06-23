const DB_NAME = "zsb-question-bank-trainer-v1";
const DB_VERSION = 1;
const QUESTION_STORE = "questions";
const PROGRESS_STORE = "progress";
const BUNDLED_DATA_URL = "question-bank-data.json";
const PAGE_SIZE = QuestionBankCore.PAGE_SIZE;

const els = {
  searchInput: document.querySelector("#searchInput"),
  subjectFilter: document.querySelector("#subjectFilter"),
  chapterFilter: document.querySelector("#chapterFilter"),
  statusFilter: document.querySelector("#statusFilter"),
  questionsList: document.querySelector("#questionsList"),
  detailPanel: document.querySelector("#detailPanel"),
  totalCount: document.querySelector("#totalCount"),
  filteredCount: document.querySelector("#filteredCount"),
  wrongCount: document.querySelector("#wrongCount"),
  wrongBookCount: document.querySelector("#wrongBookCount"),
  pageInfo: document.querySelector("#pageInfo"),
  prevPageButton: document.querySelector("#prevPageButton"),
  nextPageButton: document.querySelector("#nextPageButton"),
  sampleButton: document.querySelector("#sampleButton"),
  stressButton: document.querySelector("#stressButton"),
  importButton: document.querySelector("#importButton"),
  importInput: document.querySelector("#importInput"),
  exportButton: document.querySelector("#exportButton")
};

const state = {
  db: null,
  questions: [],
  progressById: new Map(),
  filtered: [],
  page: 1,
  selectedId: ""
};

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(QUESTION_STORE)) {
        db.createObjectStore(QUESTION_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(PROGRESS_STORE)) {
        db.createObjectStore(PROGRESS_STORE, { keyPath: "questionId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAll(storeName) {
  return new Promise((resolve, reject) => {
    const transaction = state.db.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function clearStore(storeName) {
  return new Promise((resolve, reject) => {
    const transaction = state.db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

function putMany(storeName, items) {
  return new Promise((resolve, reject) => {
    const transaction = state.db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    items.forEach((item) => store.put(item));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

function putOne(storeName, item) {
  return putMany(storeName, [item]);
}

async function replaceQuestions(questions, options = {}) {
  const normalized = questions.map(QuestionBankCore.normalizeQuestion).filter((question) => question.id && question.stem);
  await clearStore(QUESTION_STORE);
  await putMany(QUESTION_STORE, normalized);
  state.questions = normalized;
  state.page = 1;
  state.selectedId = normalized[0] ? normalized[0].id : "";
  updateFilters();
  applyFilters();
  if (!options.silent) {
    showToast(`已载入 ${normalized.length} 道题`);
  }
}

async function loadState() {
  state.questions = (await getAll(QUESTION_STORE)).map(QuestionBankCore.normalizeQuestion);
  const progressList = await getAll(PROGRESS_STORE);
  state.progressById = new Map(progressList.map((progress) => [progress.questionId, QuestionBankCore.normalizeProgress(progress, progress.questionId)]));
  if (await ensureBundledQuestionsCurrent()) {
    return;
  }
  if (!state.questions.length) {
    await replaceQuestions(createSampleQuestions(36));
    return;
  }
  state.selectedId = state.questions[0].id;
  updateFilters();
  applyFilters();
}

function repairWrongBookOptionsFromProgress() {
  const wrongRecords = QuestionBankCore.loadWrongBookRecords();
  if (!wrongRecords.length || !state.questions.length) {
    return;
  }
  const questionsById = new Map(state.questions.map((question) => [question.id, question]));
  let changed = false;
  const nextRecords = wrongRecords.map((record) => {
    const recordId = String(record.id || "");
    const bankQuestionId = record.bankQuestionId || (recordId.startsWith("QB-") ? recordId.slice(3) : "");
    const question = questionsById.get(bankQuestionId);
    if (!question || !Array.isArray(question.options) || !question.options.length) {
      return record;
    }
    const existingOptions = Array.isArray(record.options) ? record.options : [];
    if (JSON.stringify(existingOptions) === JSON.stringify(question.options)) {
      return record;
    }
    changed = true;
    return { ...record, options: question.options, updatedAt: new Date().toISOString() };
  });
  if (changed) {
    QuestionBankCore.saveWrongBookRecords(nextRecords);
  }
}

async function ensureBundledQuestionsCurrent() {
  const bundled = await loadBundledQuestions();
  if (!bundled.length) {
    return false;
  }

  if (!state.questions.length) {
    await replaceQuestions(bundled, { silent: true });
    showToast(`已载入内置题库 ${bundled.length} 道`);
    return true;
  }

  const localIds = new Set(state.questions.map((question) => question.id));
  const localLooksLikeBundled = state.questions.some((question) =>
    question.id.startsWith("COMP-") || question.id.startsWith("MATH-BASIC1-")
  );
  const bundledHasNewTextEnglish = bundled.some((question) => question.id === "ENG-TEXT-001") && !localIds.has("ENG-TEXT-001");
  if (localLooksLikeBundled && (bundled.length > state.questions.length || bundledHasNewTextEnglish)) {
    await replaceQuestions(bundled, { silent: true });
    showToast(`内置题库已更新到 ${bundled.length} 道，已保留做题记录`);
    return true;
  }

  return false;
}

async function loadBundledQuestions() {
  if (globalThis.BUNDLED_QUESTION_BANK) {
    const data = globalThis.BUNDLED_QUESTION_BANK;
    const questions = Array.isArray(data) ? data : data.questions;
    if (Array.isArray(questions)) {
      return questions;
    }
  }
  try {
    const response = await fetch(BUNDLED_DATA_URL, { cache: "no-store" });
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    const questions = Array.isArray(data) ? data : data.questions;
    return Array.isArray(questions) ? questions : [];
  } catch (error) {
    return [];
  }
}

function createSampleQuestions(count) {
  const subjects = ["高数", "英语", "计算机"];
  const chapters = {
    高数: ["函数与极限", "导数", "积分"],
    英语: ["语法", "阅读", "词汇"],
    计算机: ["基础知识", "网络", "Office"]
  };
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    const subject = subjects[index % subjects.length];
    const chapter = chapters[subject][index % chapters[subject].length];
    const isChoice = index % 2 === 0;
    return {
      id: `DEMO-${String(number).padStart(5, "0")}`,
      subject,
      chapter,
      type: isChoice ? "选择题" : "解答题",
      stem: `${subject} ${chapter} 示例题 ${number}：请完成本题并核对答案。`,
      options: isChoice ? ["A. 选项一", "B. 选项二", "C. 选项三", "D. 选项四"] : [],
      answer: isChoice ? "B" : "按步骤写出关键过程",
      analysis: `示例解析 ${number}：先判断考点，再按固定步骤计算或排除选项。`,
      difficulty: String((index % 5) + 1),
      tags: ["示例题", chapter]
    };
  });
}

function updateFilters() {
  refillSelect(els.subjectFilter, ["all", ...QuestionBankCore.uniqueValues(state.questions.map((question) => question.subject))], "全部");
  const selectedSubject = els.subjectFilter.value || "all";
  refillSelect(els.chapterFilter, ["all", ...QuestionBankCore.availableChapters(state.questions, selectedSubject)], "全部");
}

function refillSelect(select, values, allText) {
  const previous = select.value || "all";
  select.innerHTML = "";
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value === "all" ? allText : value;
    select.append(option);
  });
  select.value = values.includes(previous) ? previous : "all";
}

function applyFilters() {
  state.filtered = QuestionBankCore.filterQuestions(state.questions, {
    keyword: els.searchInput.value,
    subject: els.subjectFilter.value,
    chapter: els.chapterFilter.value,
    status: els.statusFilter.value,
    progressById: state.progressById
  });
  const page = QuestionBankCore.paginate(state.filtered, state.page, PAGE_SIZE);
  state.page = page.page;
  if (!state.selectedId || !state.filtered.some((question) => question.id === state.selectedId)) {
    state.selectedId = page.items[0] ? page.items[0].id : "";
  }
  render();
}

function render() {
  const page = QuestionBankCore.paginate(state.filtered, state.page, PAGE_SIZE);
  renderStats();
  renderList(page);
  renderDetail();
  els.pageInfo.textContent = `${page.page} / ${page.totalPages}`;
  els.prevPageButton.disabled = page.page <= 1;
  els.nextPageButton.disabled = page.page >= page.totalPages;
}

function renderStats() {
  const progressList = [...state.progressById.values()];
  els.totalCount.textContent = state.questions.length;
  els.filteredCount.textContent = state.filtered.length;
  els.wrongCount.textContent = progressList.filter((progress) => progress.lastResult === "wrong").length;
  els.wrongBookCount.textContent = progressList.filter((progress) => progress.addedToWrongBookAt).length;
}

function renderList(page) {
  const fragment = document.createDocumentFragment();
  page.items.forEach((question) => {
    const progress = getProgress(question.id);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `question-row${question.id === state.selectedId ? " active" : ""}`;
    button.dataset.id = question.id;
    button.innerHTML = `
      <div class="meta-line">
        <span class="badge">${escapeHtml(question.subject)}</span>
        <span>${escapeHtml(question.chapter)}</span>
        <span>${escapeHtml(question.type)}</span>
      </div>
      <h3>${escapeHtml(question.id)} ${escapeHtml(question.stem)}</h3>
      <div class="tag-line">
        ${renderStatusBadges(progress)}
        <span>难度 ${escapeHtml(question.difficulty)}</span>
      </div>
    `;
    button.addEventListener("click", () => {
      state.selectedId = question.id;
      render();
    });
    fragment.append(button);
  });
  els.questionsList.replaceChildren(fragment);
  if (!page.items.length) {
    els.questionsList.innerHTML = `<div class="hidden-solution">没有符合条件的题</div>`;
  }
}

function renderStatusBadges(progress) {
  const badges = [];
  if (!progress || !progress.attempts) {
    badges.push(`<span class="badge">未做</span>`);
  } else if (progress.lastResult === "correct") {
    badges.push(`<span class="badge correct">最近做对</span>`);
  } else {
    badges.push(`<span class="badge wrong">最近做错</span>`);
  }
  if (progress && progress.addedToWrongBookAt) {
    badges.push(`<span class="badge book">已进错题本</span>`);
  }
  return badges.join("");
}

function renderDetail() {
  const question = state.questions.find((item) => item.id === state.selectedId);
  if (!question) {
    els.detailPanel.innerHTML = `
      <div class="empty-detail">
        <p class="eyebrow">Detail</p>
        <h2>选择一道题开始</h2>
        <p>答案和解析会先隐藏，检查时再打开。</p>
      </div>
    `;
    return;
  }

  const progress = getProgress(question.id);
  const visible = QuestionBankCore.isSolutionVisible(progress);
  const inWrongBook = Boolean(progress.addedToWrongBookAt);
  els.detailPanel.innerHTML = `
    <article class="question-detail">
      <header class="detail-header">
        <p class="eyebrow">${escapeHtml(question.subject)} · ${escapeHtml(question.chapter)}</p>
        <h2>${escapeHtml(question.id)} ${escapeHtml(question.type)}</h2>
        <div class="meta-line">
          ${renderStatusBadges(progress)}
          <span>已做 ${progress.attempts} 次</span>
          <span>对 ${progress.correct} 次</span>
          <span>错 ${progress.wrong} 次</span>
        </div>
      </header>

      <section class="stem-box">
        <strong>题目</strong>
        <p>${escapeHtml(question.stem)}</p>
        ${renderImages(question.images)}
        ${renderOptions(question.options)}
      </section>

      ${visible ? renderSolution(question) : `<div class="hidden-solution">答案与解析已隐藏</div>`}

      <div class="detail-actions">
        <button class="secondary-button" id="revealButton" type="button">${visible ? "隐藏答案解析" : "查看答案解析"}</button>
        <button class="primary-button" id="correctButton" type="button">做对了</button>
        <button class="secondary-button" id="wrongButton" type="button">做错了</button>
        <button class="secondary-button" id="addWrongBookButton" type="button">${inWrongBook ? "取消错题本" : "加入错题本"}</button>
      </div>
    </article>
  `;

  document.querySelector("#revealButton").addEventListener("click", () => toggleSolution(question.id));
  document.querySelector("#correctButton").addEventListener("click", () => saveAttempt(question.id, "correct"));
  document.querySelector("#wrongButton").addEventListener("click", () => saveAttempt(question.id, "wrong"));
  document.querySelector("#addWrongBookButton").addEventListener("click", () => {
    if (getProgress(question.id).addedToWrongBookAt) {
      removeFromWrongBook(question.id);
      return;
    }
    addToWrongBook(question.id);
  });
}

function renderOptions(options) {
  if (!options.length) {
    return "";
  }
  return `<ul class="options-list">${options.map((option) => `<li>${escapeHtml(option)}</li>`).join("")}</ul>`;
}

function renderImages(images) {
  if (!images || !images.length) {
    return "";
  }
  return `
    <div class="question-images">
      ${images.map((image, index) => `
        <figure class="question-image">
          <img src="${escapeHtml(image)}" alt="原题图片 ${index + 1}" loading="lazy">
        </figure>
      `).join("")}
    </div>
  `;
}

function renderSolution(question) {
  return `
    <section class="solution-box">
      <strong>答案</strong>
      <p>${escapeHtml(question.answer || "未填写")}</p>
    </section>
    <section class="analysis-box">
      <strong>解析</strong>
      <p>${escapeHtml(question.analysis || "未填写")}</p>
    </section>
  `;
}

function getProgress(questionId) {
  if (!state.progressById.has(questionId)) {
    state.progressById.set(questionId, QuestionBankCore.createProgress(questionId));
  }
  return state.progressById.get(questionId);
}

async function saveProgress(progress) {
  state.progressById.set(progress.questionId, progress);
  await putOne(PROGRESS_STORE, progress);
}

async function toggleSolution(questionId) {
  const progress = QuestionBankCore.setSolutionVisible(getProgress(questionId), !QuestionBankCore.isSolutionVisible(getProgress(questionId)));
  await saveProgress(progress);
  render();
}

async function saveAttempt(questionId, result) {
  const progress = QuestionBankCore.recordAttempt(getProgress(questionId), result);
  await saveProgress(progress);
  if (result === "wrong") {
    await addToWrongBook(questionId, { silent: true });
    showToast("已记录做错，并加入错题本");
  } else {
    showToast("已记录做对");
  }
  applyFilters();
}

async function addToWrongBook(questionId, options = {}) {
  const question = state.questions.find((item) => item.id === questionId);
  if (!question) {
    return;
  }
  const progress = getProgress(questionId);
  const today = new Date().toISOString().slice(0, 10);
  const record = QuestionBankCore.toWrongBookRecord(question, progress, today);
  const existing = QuestionBankCore.loadWrongBookRecords();
  const next = QuestionBankCore.upsertWrongBookRecord(existing, record);
  QuestionBankCore.saveWrongBookRecords(next);
  await saveProgress(QuestionBankCore.markAddedToWrongBook(progress, today));
  if (!options.silent) {
    showToast("已加入错题本");
    applyFilters();
  }
}

async function removeFromWrongBook(questionId, options = {}) {
  const existing = QuestionBankCore.loadWrongBookRecords();
  const next = QuestionBankCore.removeWrongBookRecord(existing, questionId);
  QuestionBankCore.saveWrongBookRecords(next);
  await saveProgress(QuestionBankCore.clearAddedToWrongBook(getProgress(questionId)));
  if (!options.silent) {
    showToast("已取消错题本");
    applyFilters();
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function debounce(fn, wait = 180) {
  let timer = 0;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.append(toast);
  setTimeout(() => toast.remove(), 1800);
}

async function handleImport(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  const questions = Array.isArray(parsed) ? parsed : parsed.questions;
  if (!Array.isArray(questions)) {
    throw new Error("题库 JSON 需要是数组，或包含 questions 数组。");
  }
  await replaceQuestions(questions);
}

async function exportData() {
  const payload = {
    exportedAt: new Date().toISOString(),
    questions: state.questions,
    progress: [...state.progressById.values()]
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "专升本题库训练中心备份.json";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function bindEvents() {
  const debouncedFilter = debounce(() => {
    state.page = 1;
    applyFilters();
  });
  els.searchInput.addEventListener("input", debouncedFilter);
  els.subjectFilter.addEventListener("change", () => {
    els.chapterFilter.value = "all";
    updateFilters();
    state.page = 1;
    applyFilters();
  });
  [els.chapterFilter, els.statusFilter].forEach((select) => {
    select.addEventListener("change", () => {
      state.page = 1;
      applyFilters();
    });
  });
  els.prevPageButton.addEventListener("click", () => {
    state.page -= 1;
    applyFilters();
  });
  els.nextPageButton.addEventListener("click", () => {
    state.page += 1;
    applyFilters();
  });
  els.sampleButton.addEventListener("click", () => replaceQuestions(createSampleQuestions(120)));
  els.stressButton.addEventListener("click", () => replaceQuestions(createSampleQuestions(10000)));
  els.importButton.addEventListener("click", () => els.importInput.click());
  els.importInput.addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) {
      return;
    }
    try {
      await handleImport(file);
    } catch (error) {
      showToast(error.message || "导入失败");
    } finally {
      els.importInput.value = "";
    }
  });
  els.exportButton.addEventListener("click", exportData);
}

async function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register("sw.js");
    } catch (error) {
      console.warn("Service worker registration failed", error);
    }
  }
}

async function init() {
  bindEvents();
  state.db = await openDatabase();
  await loadState();
  repairWrongBookOptionsFromProgress();
  await registerServiceWorker();
}

init().catch((error) => {
  console.error(error);
  showToast("题库启动失败，请刷新重试");
});

const DB_NAME = "zsb-question-bank-trainer-v1";
const DB_VERSION = 1;
const QUESTION_STORE = "questions";
const PROGRESS_STORE = "progress";
const BUNDLED_DATA_URL = "question-bank-data.json";
const PAGE_SIZE = QuestionBankCore.PAGE_SIZE;

const FORCE_CLEAN_VERSION_KEY = "zsb-question-bank-trainer:clean-version";
const FORCE_CLEAN_VERSION = "20260626-official-existing-sections-v5";
const STUDY_MODE_KEY = "zsb-question-bank-trainer:study-mode";
const STUDY_DAYS_KEY = "zsb-question-bank-trainer:study-days";
const AUTO_HIDE_MASTERED_KEY = "zsb-question-bank-trainer:auto-hide-mastered";
const DAILY_GOAL_KEY = "zsb-question-bank-trainer:daily-goal";
const DAILY_ATTEMPTS_KEY = "zsb-question-bank-trainer:daily-attempts";
const TIMER_REMAINING_KEY = "zsb-question-bank-trainer:timer-remaining";
const STUDY_TOTAL_SECONDS_KEY = "zsb-question-bank-trainer:study-total-seconds";
const STUDY_DAILY_SECONDS_KEY = "zsb-question-bank-trainer:study-daily-seconds";
const TIMER_DEFAULT_SECONDS = 25 * 60;
const MOBILE_TAB_KEY = "zsb-question-bank-trainer:mobile-tab";
const REVIEW_INTERVALS = [1, 2, 4, 7, 15, 30, 45, 60];
const SUPABASE_URL = "https://fsizdxkwrxzopkoouipr.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_BfWyJfb6c4GrV0JYLXejUg_QnkuhPvw";
const CLOUD_SLUG_KEY = "zsb-question-bank-trainer:cloud-slug";
const CLOUD_PIN_KEY = "zsb-question-bank-trainer:cloud-pin";
const CLOUD_DISPLAY_NAME_KEY = "zsb-question-bank-trainer:cloud-display-name";
const CLOUD_LAST_SYNC_KEY = "zsb-question-bank-trainer:cloud-last-sync";
const CLOUD_RECORD_ID = "question_bank_progress";
const CLOUD_SYNC_DELAY_MS = 2500;

const els = {
  searchInput: document.querySelector("#searchInput"),
  subjectFilter: document.querySelector("#subjectFilter"),
  chapterFilter: document.querySelector("#chapterFilter"),
  sourceFilter: document.querySelector("#sourceFilter"),
  statusFilter: document.querySelector("#statusFilter"),
  difficultyFilter: document.querySelector("#difficultyFilter"),
  questionsList: document.querySelector("#questionsList"),
  detailPanel: document.querySelector("#detailPanel"),
  totalCount: document.querySelector("#totalCount"),
  filteredCount: document.querySelector("#filteredCount"),
  wrongCount: document.querySelector("#wrongCount"),
  wrongBookCount: document.querySelector("#wrongBookCount"),
  dueReviewCount: document.querySelector("#dueReviewCount"),
  streakCount: document.querySelector("#streakCount"),
  dailyProgressCount: document.querySelector("#dailyProgressCount"),
  masteredCount: document.querySelector("#masteredCount"),
  totalStudyTimeCount: document.querySelector("#totalStudyTimeCount"),
  mobileTotalStudyTime: document.querySelector("#mobileTotalStudyTime"),
  mobileTodayStudyTime: document.querySelector("#mobileTodayStudyTime"),
  dashboardPanel: document.querySelector("#dashboardPanel"),
  mobileFilterToggle: document.querySelector("#mobileFilterToggle"),
  mobileTimerPill: document.querySelector("#mobileTimerPill"),
  mobileScreenTitle: document.querySelector("#mobileScreenTitle"),
  mobileTabButtons: [...document.querySelectorAll("[data-mobile-tab]")],
  mobileMePanel: document.querySelector("#mobileMePanel"),
  mobileSimilarPanel: document.querySelector("#mobileSimilarPanel"),
  mobileTotalCount: document.querySelector("#mobileTotalCount"),
  mobileFilteredCount: document.querySelector("#mobileFilteredCount"),
  mobileCloudButton: document.querySelector("#mobileCloudButton"),
  mobileDailyGoalInput: document.querySelector("#mobileDailyGoalInput"),
  mobileMeStudyModeButton: document.querySelector("#mobileMeStudyModeButton"),
  mobileMeAutoHideMasteredButton: document.querySelector("#mobileMeAutoHideMasteredButton"),
  mobileMeTimerButton: document.querySelector("#mobileMeTimerButton"),
  mobileBackupButton: document.querySelector("#mobileBackupButton"),
  pageInfo: document.querySelector("#pageInfo"),
  prevPageButton: document.querySelector("#prevPageButton"),
  nextPageButton: document.querySelector("#nextPageButton"),
  reviewQueueButton: document.querySelector("#reviewQueueButton"),
  studyModeButton: document.querySelector("#studyModeButton"),
  autoHideMasteredButton: document.querySelector("#autoHideMasteredButton"),
  timerButton: document.querySelector("#timerButton"),
  cloudButton: document.querySelector("#cloudButton")
};

const state = {
  db: null,
  questions: [],
  progressById: new Map(),
  filtered: [],
  page: 1,
  selectedId: "",
  studyMode: localStorage.getItem(STUDY_MODE_KEY) === "single",
  autoHideMastered: localStorage.getItem(AUTO_HIDE_MASTERED_KEY) === "1",
  mobileTab: localStorage.getItem(MOBILE_TAB_KEY) || "quiz",
  filtersOpen: false,
  timerSecondsRemaining: Number(localStorage.getItem(TIMER_REMAINING_KEY) || TIMER_DEFAULT_SECONDS) || TIMER_DEFAULT_SECONDS,
  timerRunning: false,
  timerId: 0,
  studyTimeTickerId: 0,
  studyTimeUnsavedSeconds: 0,
  cloudSyncTimer: 0,
  cloudSaving: false
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
    updateFilters();
    applyFilters();
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

function normalizeDedupeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/^[\s*]*\d+[.．、]\s*/, "")
    .replace(/[（）]/g, (char) => (char === "（" ? "(" : ")"))
    .replace(/\s+/g, "")
    .toLowerCase();
}

function questionContentKey(question) {
  const normalized = QuestionBankCore.normalizeQuestion(question);
  const optionKey = (normalized.options || []).map(normalizeDedupeText).join("||");
  return `${normalizeDedupeText(normalized.stem)}||${optionKey}`;
}

function mergeQuestionsPreferBundled(localQuestions, bundledQuestions) {
  const merged = [];
  const seenIds = new Set();
  const seenContent = new Set();

  function addMany(list) {
    (list || []).forEach((item) => {
      const question = QuestionBankCore.normalizeQuestion(item);
      if (!question.id || !question.stem) {
        return;
      }
      const idKey = question.id;
      const contentKey = questionContentKey(question);
      if (seenIds.has(idKey) || seenContent.has(contentKey)) {
        return;
      }
      seenIds.add(idKey);
      seenContent.add(contentKey);
      merged.push(question);
    });
  }

  // 内置题库优先，保证已补答案/图片的题能覆盖旧内置题；再追加用户本地已有题。
  addMany(bundledQuestions);
  addMany(localQuestions);
  return merged;
}

async function ensureBundledQuestionsCurrent() {
  const bundled = await loadBundledQuestions();
  if (!bundled.length) {
    return false;
  }

  const savedCleanVersion = localStorage.getItem(FORCE_CLEAN_VERSION_KEY) || "";
  const bundledIds = new Set(bundled.map((question) => String(question.id || "")));
  const localIds = new Set(state.questions.map((question) => String(question.id || "")));
  const sameQuestionSet = state.questions.length === bundled.length &&
    bundled.every((question) => localIds.has(String(question.id || ""))) &&
    state.questions.every((question) => bundledIds.has(String(question.id || "")));

  if (savedCleanVersion !== FORCE_CLEAN_VERSION || !sameQuestionSet) {
    await replaceQuestions(bundled, { silent: true });
    localStorage.setItem(FORCE_CLEAN_VERSION_KEY, FORCE_CLEAN_VERSION);
    showToast(`题库已更新：默认只显示已核对题，答案待核对题已单独放到筛选里`);
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

function updateFilters() {
  refillSelect(els.subjectFilter, ["all", ...QuestionBankCore.uniqueValues(state.questions.map((question) => question.subject))], "全部");
  const selectedSubject = els.subjectFilter.value || "all";
  refillSelect(els.chapterFilter, ["all", ...QuestionBankCore.availableChapters(state.questions, selectedSubject)], "全部");
  const selectedChapter = els.chapterFilter.value || "all";
  const sourceValues = state.questions
    .filter((question) => selectedSubject === "all" || question.subject === selectedSubject)
    .filter((question) => selectedChapter === "all" || question.chapter === selectedChapter)
    .map((question) => question.source || "题库");
  if (els.sourceFilter) {
    refillSelect(els.sourceFilter, ["all", ...QuestionBankCore.uniqueValues(sourceValues)], "全部题源");
  }
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
  const status = els.statusFilter.value;
  const coreStatus = ["dueReview", "weakChapter", "mastered", "answerReview"].includes(status) ? "all" : status;
  const difficulty = els.difficultyFilter ? els.difficultyFilter.value : "all";
  const source = els.sourceFilter ? els.sourceFilter.value : "all";
  const weakKeys = new Set(getWeakChapterStats().map((item) => item.key));

  state.filtered = QuestionBankCore.filterQuestions(state.questions, {
    keyword: els.searchInput.value,
    subject: els.subjectFilter.value,
    chapter: els.chapterFilter.value,
    status: coreStatus,
    progressById: state.progressById
  })
    .filter((question) => source === "all" || String(question.source || "题库") === source)
    .filter((question) => difficulty === "all" || String(question.difficulty) === difficulty)
    .filter((question) => status === "answerReview" ? isUnverifiedAnswer(question) : !isUnverifiedAnswer(question))
    .filter((question) => status !== "dueReview" || isDueReview(question))
    .filter((question) => status !== "weakChapter" || weakKeys.has(chapterKey(question)))
    .filter((question) => status !== "mastered" || isMasteredQuestion(question))
    .filter((question) => !state.autoHideMastered || status === "mastered" || !isMasteredQuestion(question))
    .sort((a, b) => sortQuestionsForMode(a, b, status));

  const page = QuestionBankCore.paginate(state.filtered, state.page, PAGE_SIZE);
  state.page = page.page;
  if (!state.selectedId || !state.filtered.some((question) => question.id === state.selectedId)) {
    state.selectedId = page.items[0] ? page.items[0].id : "";
  }
  render();
}


function renderMobileChrome() {
  const tabTitles = { quiz: "刷题", similar: "同类", review: "复习", stats: "统计", me: "我的" };
  const safeTab = tabTitles[state.mobileTab] ? state.mobileTab : "quiz";
  state.mobileTab = safeTab;
  ["quiz", "similar", "review", "stats", "me"].forEach((tab) => {
    document.body.classList.toggle(`mobile-tab-${tab}`, safeTab === tab);
  });
  document.body.classList.toggle("filters-open", Boolean(state.filtersOpen));
  if (els.mobileScreenTitle) {
    els.mobileScreenTitle.textContent = tabTitles[safeTab];
  }
  els.mobileTabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mobileTab === safeTab);
  });
  if (els.mobileTotalCount) {
    els.mobileTotalCount.textContent = state.questions.length;
  }
  if (els.mobileFilteredCount) {
    els.mobileFilteredCount.textContent = state.filtered.length;
  }
  if (els.mobileDailyGoalInput) {
    els.mobileDailyGoalInput.value = getDailyGoal();
  }
  if (els.mobileMeStudyModeButton) {
    els.mobileMeStudyModeButton.classList.toggle("active", state.studyMode);
    els.mobileMeStudyModeButton.textContent = state.studyMode ? "已开单题模式" : "单题模式";
  }
  if (els.mobileMeAutoHideMasteredButton) {
    els.mobileMeAutoHideMasteredButton.classList.toggle("active", state.autoHideMastered);
    els.mobileMeAutoHideMasteredButton.textContent = state.autoHideMastered ? "已隐藏熟练题" : "隐藏熟练题";
  }
  if (els.mobileMeTimerButton) {
    els.mobileMeTimerButton.classList.toggle("active", state.timerRunning);
    els.mobileMeTimerButton.textContent = state.timerRunning ? `暂停 ${formatTimer(state.timerSecondsRemaining)}` : "开始倒计时";
  }
}

function setMobileTab(tab) {
  const safe = ["quiz", "similar", "review", "stats", "me"].includes(tab) ? tab : "quiz";
  state.mobileTab = safe;
  state.filtersOpen = false;
  localStorage.setItem(MOBILE_TAB_KEY, safe);
  render();
  window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
}

function render() {
  const page = QuestionBankCore.paginate(state.filtered, state.page, PAGE_SIZE);
  document.body.classList.toggle("study-mode", state.studyMode);
  if (els.studyModeButton) {
    els.studyModeButton.classList.toggle("active", state.studyMode);
    els.studyModeButton.querySelector("span:last-child").textContent = state.studyMode ? "退出单题" : "单题模式";
  }
  if (els.autoHideMasteredButton) {
    els.autoHideMasteredButton.classList.toggle("active", state.autoHideMastered);
    els.autoHideMasteredButton.querySelector("span:last-child").textContent = state.autoHideMastered ? "已隐藏熟练题" : "隐藏熟练题";
  }
  updateTimerUI();
  renderMobileChrome();
  renderStats();
  renderDashboard();
  renderList(page);
  renderDetail();
  renderSimilarPanel();
  els.pageInfo.textContent = `${page.page} / ${page.totalPages}`;
  els.prevPageButton.disabled = page.page <= 1;
  els.nextPageButton.disabled = page.page >= page.totalPages;
  typesetMathSoon();
}

function renderStats() {
  const progressList = [...state.progressById.values()];
  els.totalCount.textContent = state.questions.length;
  els.filteredCount.textContent = state.filtered.length;
  els.wrongCount.textContent = progressList.filter((progress) => progress.lastResult === "wrong").length;
  els.wrongBookCount.textContent = progressList.filter((progress) => progress.addedToWrongBookAt).length;
  if (els.dueReviewCount) {
    els.dueReviewCount.textContent = state.questions.filter(isDueReview).length;
  }
  if (els.streakCount) {
    els.streakCount.textContent = `${getStudyStreak()}天`;
  }
  if (els.dailyProgressCount) {
    els.dailyProgressCount.textContent = `${getTodayAttemptCount()}/${getDailyGoal()}`;
  }
  if (els.masteredCount) {
    els.masteredCount.textContent = state.questions.filter(isMasteredQuestion).length;
  }
  updateStudyTimeUI();
}



function renderDashboard() {
  if (!els.dashboardPanel) {
    return;
  }
  const mastery = getChapterMasteryStats();
  const weak = getWeakChapterStats();
  const due = state.questions.filter(isDueReview).length;
  const english = getEnglishGrammarStats();
  const dailyDone = getTodayAttemptCount();
  const dailyGoal = getDailyGoal();
  const dailyPercent = Math.min(100, Math.round((dailyDone / Math.max(1, dailyGoal)) * 100));
  const backup = getBackupStatus();
  const topMastery = mastery.slice(0, 8);
  const weakList = weak.slice(0, 5);
  const englishList = english.slice(0, 8);
  const totalStudySeconds = getTotalStudySeconds();
  const todayStudySeconds = getTodayStudySeconds();

  els.dashboardPanel.innerHTML = `
    <div class="dashboard-card dashboard-summary-card review-card">
      <div>
        <p class="eyebrow">Review</p>
        <h2>今日队列 ${due} 题</h2>
        <p>按 1、2、4、7、15 天复习间隔推进。今日任务 ${dailyDone}/${dailyGoal} 题。</p>
      </div>
      <button class="primary-button" id="dashboardReviewButton" type="button">只刷今日复习</button>
      <div class="mobile-review-actions" aria-label="复习入口">
        <button type="button" class="review-action" id="mobileDueReviewButton"><strong>${due}</strong><span>今日复习</span></button>
        <button type="button" class="review-action" id="mobileWeakChapterButton"><strong>${weak.length}</strong><span>薄弱章节</span></button>
        <button type="button" class="review-action" id="mobileWrongRecentButton"><strong>${[...state.progressById.values()].filter((progress) => progress.lastResult === "wrong").length}</strong><span>最近做错</span></button>
        <button type="button" class="review-action" id="mobileWrongBookReviewButton"><strong>${[...state.progressById.values()].filter((progress) => progress.addedToWrongBookAt).length}</strong><span>错题本</span></button>
        <button type="button" class="review-action" id="mobileMasteredReviewButton"><strong>${state.questions.filter(isMasteredQuestion).length}</strong><span>熟练回顾</span></button>
      </div>
    </div>
    <div class="dashboard-card mastery-card">
      <div class="dashboard-card-head">
        <div>
          <p class="eyebrow">Mastery</p>
          <h2>章节掌握度</h2>
        </div>
        <button class="secondary-button" id="weakOnlyButton" type="button">只刷薄弱章节</button>
      </div>
      <div class="mastery-list">
        ${topMastery.length ? topMastery.map(renderMasteryRow).join("") : `<p class="muted-text">开始做题后这里会显示每章正确率。</p>`}
      </div>
      ${weakList.length ? `<div class="weak-tags">${weakList.map((item) => `<button type="button" class="weak-tag" data-subject="${escapeHtml(item.subject)}" data-chapter="${escapeHtml(item.chapter)}">${escapeHtml(item.subject)} · ${escapeHtml(item.chapter)} ${item.accuracy}%</button>`).join("")}</div>` : ""}
    </div>
    <div class="dashboard-card english-card">
      <p class="eyebrow">English</p>
      <h2>英语语法归类</h2>
      <div class="grammar-grid">
        ${englishList.length ? englishList.map((item) => `<button type="button" class="grammar-pill" data-grammar="${escapeHtml(item.name)}"><strong>${escapeHtml(item.name)}</strong><span>${item.total}题</span></button>`).join("") : `<p class="muted-text">当前英语题暂未识别到更多语法分类。</p>`}
      </div>
    </div>
    <div class="dashboard-card daily-card">
      <div class="dashboard-card-head">
        <div>
          <p class="eyebrow">Daily</p>
          <h2>每日任务 ${dailyDone}/${dailyGoal}</h2>
        </div>
        <label class="mini-field">目标 <input id="dailyGoalInput" type="number" min="10" max="500" step="10" value="${dailyGoal}"></label>
      </div>
      <div class="mastery-bar daily-bar"><i style="width:${dailyPercent}%"></i></div>
      <p>${dailyPercent >= 100 ? "今日任务已完成，可以转入错题复盘。" : `还差 ${Math.max(0, dailyGoal - dailyDone)} 题完成今日目标。`}</p>
    </div>
    <div class="dashboard-card study-time-card">
      <p class="eyebrow">Study Time</p>
      <h2>累计学习 ${formatStudyDuration(totalStudySeconds)}</h2>
      <p>今日学习 ${formatStudyDuration(todayStudySeconds)}。只要页面处于打开状态，就会自动累计；切到后台会暂停计时。</p>
    </div>
    <div class="dashboard-card timer-card">
      <p class="eyebrow">Timer</p>
      <h2 id="timerDisplay">${formatTimer(state.timerSecondsRemaining)}</h2>
      <div class="timer-actions">
        <button class="primary-button" id="timerStartPauseButton" type="button">${state.timerRunning ? "暂停" : "开始"}</button>
        <button class="secondary-button" id="timerResetButton" type="button">重置25分钟</button>
      </div>
      <p>倒计时适合限时刷题，时间到会提示，不会自动清掉进度。</p>
    </div>
    <div class="dashboard-card backup-card ${backup.needsBackup ? "needs-backup" : ""}">
      <p class="eyebrow">Backup</p>
      <h2>${backup.title}</h2>
      <p>${backup.message}</p>
      <button class="secondary-button" id="backupNowButton" type="button">立即保存到云端</button>
    </div>
  `;

  const dashboardReviewButton = els.dashboardPanel.querySelector("#dashboardReviewButton");
  if (dashboardReviewButton) {
    dashboardReviewButton.addEventListener("click", () => {
      els.statusFilter.value = "dueReview";
      state.page = 1;
      applyFilters();
    });
  }

  const mobileReviewFilters = {
    mobileDueReviewButton: "dueReview",
    mobileWeakChapterButton: "weakChapter",
    mobileWrongRecentButton: "wrong",
    mobileWrongBookReviewButton: "wrongBook",
    mobileMasteredReviewButton: "mastered"
  };
  Object.entries(mobileReviewFilters).forEach(([buttonId, status]) => {
    const button = els.dashboardPanel.querySelector(`#${buttonId}`);
    if (!button) {
      return;
    }
    button.addEventListener("click", () => {
      els.statusFilter.value = status;
      state.mobileTab = "quiz";
      localStorage.setItem(MOBILE_TAB_KEY, "quiz");
      state.page = 1;
      applyFilters();
    });
  });
  const weakOnlyButton = els.dashboardPanel.querySelector("#weakOnlyButton");
  if (weakOnlyButton) {
    weakOnlyButton.addEventListener("click", () => {
      els.statusFilter.value = "weakChapter";
      state.page = 1;
      applyFilters();
    });
  }
  const dailyGoalInput = els.dashboardPanel.querySelector("#dailyGoalInput");
  if (dailyGoalInput) {
    dailyGoalInput.addEventListener("change", () => {
      setDailyGoal(dailyGoalInput.value);
      render();
    });
  }
  const timerStartPauseButton = els.dashboardPanel.querySelector("#timerStartPauseButton");
  if (timerStartPauseButton) {
    timerStartPauseButton.addEventListener("click", toggleTimer);
  }
  const timerResetButton = els.dashboardPanel.querySelector("#timerResetButton");
  if (timerResetButton) {
    timerResetButton.addEventListener("click", resetTimer);
  }
  const backupNowButton = els.dashboardPanel.querySelector("#backupNowButton");
  if (backupNowButton) {
    backupNowButton.addEventListener("click", () => saveCloudState({ interactive: true }));
  }
  els.dashboardPanel.querySelectorAll(".weak-tag").forEach((button) => {
    button.addEventListener("click", () => {
      els.subjectFilter.value = button.dataset.subject || "all";
      updateFilters();
      els.chapterFilter.value = button.dataset.chapter || "all";
      els.statusFilter.value = "all";
      state.page = 1;
      applyFilters();
    });
  });
  els.dashboardPanel.querySelectorAll(".grammar-pill").forEach((button) => {
    button.addEventListener("click", () => {
      els.subjectFilter.value = "英语";
      updateFilters();
      els.searchInput.value = button.dataset.grammar || "";
      state.page = 1;
      applyFilters();
    });
  });
}

function renderMasteryRow(item) {
  const label = `${item.subject} · ${item.chapter}`;
  const barWidth = Math.max(3, Math.min(100, item.accuracy));
  const statusText = item.attempts ? `${item.correct}/${item.attempts} 对` : "未做";
  return `
    <div class="mastery-row">
      <div class="mastery-row-top">
        <strong>${escapeHtml(label)}</strong>
        <span>${item.accuracy}% · ${statusText}</span>
      </div>
      <div class="mastery-bar"><i style="width:${barWidth}%"></i></div>
    </div>
  `;
}

function renderList(page) {
  const fragment = document.createDocumentFragment();
  page.items.forEach((question) => {
    const progress = readProgress(question.id);
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
      <h3>${escapeHtml(question.id)} ${renderRichText(question.stem)}</h3>
      <div class="tag-line">
        ${renderStatusBadges(progress)}
        <span>难度 ${escapeHtml(question.difficulty)}</span>
      </div>
    `;
    button.addEventListener("click", () => {
      selectQuestion(question.id);
    });
    fragment.append(button);
  });
  els.questionsList.replaceChildren(fragment);
  if (!page.items.length) {
    els.questionsList.innerHTML = `<div class="hidden-solution">没有符合条件的题</div>`;
  }
}

function selectQuestion(questionId) {
  state.selectedId = questionId;
  render();
  scrollDetailPanelIntoView();
}

function isMobileStudyLayout() {
  return window.matchMedia && window.matchMedia("(max-width: 980px)").matches;
}

function scrollDetailPanelIntoView() {
  if (!isMobileStudyLayout() || !els.detailPanel) {
    return;
  }
  window.requestAnimationFrame(() => {
    els.detailPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    const firstAction = els.detailPanel.querySelector(".detail-action-dock button");
    if (firstAction) {
      firstAction.focus({ preventScroll: true });
    }
  });
}

function getSelectedQuestionPosition() {
  const index = state.filtered.findIndex((question) => question.id === state.selectedId);
  return {
    index,
    total: state.filtered.length
  };
}

function selectAdjacentQuestion(direction) {
  const position = getSelectedQuestionPosition();
  const nextIndex = position.index + direction;
  if (nextIndex < 0 || nextIndex >= position.total) {
    return;
  }
  const nextQuestion = state.filtered[nextIndex];
  state.page = Math.floor(nextIndex / PAGE_SIZE) + 1;
  selectQuestion(nextQuestion.id);
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
  if (progress && isProgressMastered(progress)) {
    badges.push(`<span class="badge mastered">熟练</span>`);
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
  const position = getSelectedQuestionPosition();
  const currentPosition = position.index >= 0 ? position.index + 1 : 0;
  const canGoPrev = position.index > 0;
  const canGoNext = position.index >= 0 && position.index < position.total - 1;
  const grammar = getEnglishGrammarCategory(question);
  els.detailPanel.innerHTML = `
    <article class="question-detail">
      <header class="detail-header">
        <p class="eyebrow">${escapeHtml(question.subject)} · ${escapeHtml(question.chapter)}</p>
        <h2><span class="desktop-question-title">${escapeHtml(question.id)} ${escapeHtml(question.type)}</span><span class="mobile-question-title">第 ${currentPosition} 题</span></h2>
        <div class="mobile-question-topnav">
          <button class="secondary-button nav-button" id="mobilePrevQuestionButton" type="button" aria-label="上一题"${canGoPrev ? "" : " disabled"}>←</button>
          <span class="detail-position">${currentPosition} / ${position.total}</span>
          <button class="secondary-button nav-button" id="mobileNextQuestionButton" type="button" aria-label="下一题"${canGoNext ? "" : " disabled"}>→</button>
        </div>
        <div class="meta-line">
          ${renderStatusBadges(progress)}
          ${isDueReview(question) ? `<span class="badge review">今日复习</span>` : ""}
          ${grammar ? `<span class="badge grammar">${escapeHtml(grammar)}</span>` : ""}
          <span>已做 ${progress.attempts} 次</span>
          <span>对 ${progress.correct} 次</span>
          <span>错 ${progress.wrong} 次</span>
          ${progress.nextReviewAt ? `<span>下次 ${escapeHtml(progress.nextReviewAt)}</span>` : ""}
        </div>
      </header>

      <section class="stem-box">
        <strong>题目</strong>
        <p>${renderRichText(question.stem)}</p>
        ${renderImages(question.images)}
        ${renderOptions(question.options)}
      </section>

      <div class="detail-action-dock">
        <div class="detail-nav-actions">
          <button class="secondary-button nav-button" id="prevQuestionButton" type="button" aria-label="上一题"${canGoPrev ? "" : " disabled"}>←</button>
          <span class="detail-position">${currentPosition} / ${position.total}</span>
          <button class="secondary-button nav-button" id="nextQuestionButton" type="button" aria-label="下一题"${canGoNext ? "" : " disabled"}>→</button>
        </div>
        <div class="detail-actions">
          <button class="secondary-button" id="hintButton" type="button">${progress.hintVisible ? "隐藏公式提示" : "公式提示"}</button>
          <button class="secondary-button" id="revealButton" type="button">${visible ? "隐藏答案解析" : "查看答案解析"}</button>
          <button class="primary-button" id="correctButton" type="button">做对了</button>
          <button class="secondary-button" id="wrongButton" type="button">做错了</button>
          <button class="secondary-button" id="addWrongBookButton" type="button">${inWrongBook ? "取消错题本" : "加入错题本"}</button>
        </div>
      </div>

      ${progress.hintVisible ? renderFormulaHint(question) : ""}
      ${visible ? renderSolution(question, progress) : `<div class="hidden-solution">答案与解析已隐藏</div>`}

    </article>
  `;

  document.querySelector("#prevQuestionButton").addEventListener("click", () => selectAdjacentQuestion(-1));
  document.querySelector("#nextQuestionButton").addEventListener("click", () => selectAdjacentQuestion(1));
  const mobilePrevQuestionButton = document.querySelector("#mobilePrevQuestionButton");
  const mobileNextQuestionButton = document.querySelector("#mobileNextQuestionButton");
  if (mobilePrevQuestionButton) {
    mobilePrevQuestionButton.addEventListener("click", () => selectAdjacentQuestion(-1));
  }
  if (mobileNextQuestionButton) {
    mobileNextQuestionButton.addEventListener("click", () => selectAdjacentQuestion(1));
  }
  document.querySelector("#hintButton").addEventListener("click", () => toggleHint(question.id));
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
  els.detailPanel.querySelectorAll("[data-solution-level]").forEach((button) => {
    button.addEventListener("click", () => setSolutionLevel(question.id, button.dataset.solutionLevel));
  });
  els.detailPanel.querySelectorAll("[data-similar-id]").forEach((button) => {
    button.addEventListener("click", () => selectQuestion(button.dataset.similarId));
  });
}

function renderOptions(options) {
  if (!options.length) {
    return "";
  }
  return `<ul class="options-list">${options.map((option) => `<li>${renderRichText(option)}</li>`).join("")}</ul>`;
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


function isUnverifiedAnswer(question) {
  return String(question && question.answerStatus || "") === "unverified" || (question && Array.isArray(question.tags) && question.tags.includes("答案待核对"));
}

function renderAnswerQualityNotice(question) {
  if (!isUnverifiedAnswer(question)) {
    return "";
  }
  return `
    <section class="answer-quality-box">
      <strong>答案待核对</strong>
      <p>这题题目还保留，但答案和解析暂不作为可背内容；已从默认刷题、今日复习和同类推荐中移出。需要核对原答案后再恢复。</p>
    </section>
  `;
}

function renderSolution(question, progress) {
  const level = progress.solutionLevel || "answer";
  const showAnalysis = ["analysis", "mistake"].includes(level);
  const showMistake = level === "mistake";
  return `
    <section class="solution-tabs" aria-label="分层答案">
      <button type="button" class="secondary-button ${level === "answer" ? "active" : ""}" data-solution-level="answer">只看答案</button>
      <button type="button" class="secondary-button ${level === "analysis" ? "active" : ""}" data-solution-level="analysis">再看解析</button>
      <button type="button" class="secondary-button ${level === "mistake" ? "active" : ""}" data-solution-level="mistake">最后看易错点</button>
    </section>
    ${renderAnswerQualityNotice(question)}
    <section class="solution-box ${isUnverifiedAnswer(question) ? "unverified-solution" : ""}">
      <strong>答案</strong>
      <p>${renderRichText(question.answer || "未填写")}</p>
    </section>
    ${showAnalysis ? `<section class="analysis-box"><strong>解析</strong><p>${renderRichText(question.analysis || "未填写")}</p></section>` : ""}
    ${showMistake ? renderMistakePoint(question) : ""}
  `;
}

function enrichProgress(progress, questionId) {
  const base = QuestionBankCore.normalizeProgress(progress, questionId);
  return {
    ...base,
    reviewLevel: Number(progress && progress.reviewLevel || 0),
    nextReviewAt: String(progress && progress.nextReviewAt || ""),
    hintVisible: Boolean(progress && progress.hintVisible),
    solutionLevel: String(progress && progress.solutionLevel || "answer"),
    correctStreak: Number(progress && progress.correctStreak || 0)
  };
}


function readProgress(questionId) {
  return enrichProgress(state.progressById.get(questionId), questionId);
}

function getProgress(questionId) {
  if (!state.progressById.has(questionId)) {
    state.progressById.set(questionId, enrichProgress(QuestionBankCore.createProgress(questionId), questionId));
  }
  const progress = enrichProgress(state.progressById.get(questionId), questionId);
  state.progressById.set(questionId, progress);
  return progress;
}

async function saveProgress(progress) {
  const next = enrichProgress(progress, progress.questionId);
  state.progressById.set(next.questionId, next);
  await putOne(PROGRESS_STORE, next);
  queueCloudSync();
}

async function toggleHint(questionId) {
  const progress = getProgress(questionId);
  await saveProgress({ ...progress, hintVisible: !progress.hintVisible });
  render();
}

async function setSolutionLevel(questionId, level) {
  const safeLevel = ["answer", "analysis", "mistake"].includes(level) ? level : "answer";
  await saveProgress({ ...getProgress(questionId), solutionLevel: safeLevel, solutionVisible: true });
  render();
}

async function toggleSolution(questionId) {
  const progress = getProgress(questionId);
  const visible = !QuestionBankCore.isSolutionVisible(progress);
  const next = QuestionBankCore.setSolutionVisible(progress, visible);
  await saveProgress({ ...next, solutionLevel: progress.solutionLevel || "answer" });
  render();
}

async function saveAttempt(questionId, result) {
  markStudyToday();
  markDailyAttempt();
  const before = getProgress(questionId);
  let progress = QuestionBankCore.recordAttempt(before, result);
  progress = {
    ...progress,
    correctStreak: result === "correct" ? Number(before.correctStreak || 0) + 1 : 0
  };
  progress = scheduleNextReview(progress, result);
  await saveProgress(progress);
  if (result === "wrong") {
    await addToWrongBook(questionId, { silent: true });
    showToast("已记录做错，已排入明天复习");
  } else if (isProgressMastered(progress)) {
    showToast("已连续做对3次，已归为熟练题");
  } else {
    showToast(progress.nextReviewAt ? `已记录做对，下次复习 ${progress.nextReviewAt}` : "已记录做对");
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
  await saveProgress({ ...progress, addedToWrongBookAt: today });
  if (!options.silent) {
    showToast("已加入错题本");
    applyFilters();
  }
}

async function removeFromWrongBook(questionId, options = {}) {
  const existing = QuestionBankCore.loadWrongBookRecords();
  const next = QuestionBankCore.removeWrongBookRecord(existing, questionId);
  QuestionBankCore.saveWrongBookRecords(next);
  await saveProgress({ ...getProgress(questionId), addedToWrongBookAt: "" });
  if (!options.silent) {
    showToast("已取消错题本");
    applyFilters();
  }
}




function createSupabaseClient() {
  async function rpc(functionName, payload) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${functionName}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const message = data && (data.message || data.error_description || data.error) || text || "云端请求失败";
      throw new Error(message);
    }
    return data;
  }
  return { rpc };
}

const cloudClient = createSupabaseClient();

function readCloudProfile(interactive = false) {
  const params = new URLSearchParams(window.location.search);
  const urlSlug = (params.get("edit") || params.get("view") || "").trim().toLowerCase();
  let slug = (urlSlug || localStorage.getItem(CLOUD_SLUG_KEY) || "").trim().toLowerCase();
  let pin = localStorage.getItem(CLOUD_PIN_KEY) || "";
  let displayName = localStorage.getItem(CLOUD_DISPLAY_NAME_KEY) || "";
  if (interactive) {
    slug = (window.prompt("公开编号，例如 cyrus329", slug) || "").trim().toLowerCase();
    if (!slug) {
      return null;
    }
    pin = window.prompt("编辑密码，至少4位", pin) || "";
    if (pin.length < 4) {
      showToast("编辑密码至少4位");
      return null;
    }
    displayName = window.prompt("显示名称，可留空", displayName) || "";
  }
  if (!slug) {
    return null;
  }
  localStorage.setItem(CLOUD_SLUG_KEY, slug);
  if (pin) {
    localStorage.setItem(CLOUD_PIN_KEY, pin);
  }
  if (displayName) {
    localStorage.setItem(CLOUD_DISPLAY_NAME_KEY, displayName);
  }
  return { slug, pin, displayName };
}

function buildCloudRecord() {
  return {
    id: CLOUD_RECORD_ID,
    app: "question-bank",
    version: FORCE_CLEAN_VERSION,
    updatedAt: new Date().toISOString(),
    progress: [...state.progressById.values()].map((progress) => enrichProgress(progress, progress.questionId)),
    wrongBookRecords: QuestionBankCore.loadWrongBookRecords(),
    settings: {
      studyMode: state.studyMode,
      autoHideMastered: state.autoHideMastered,
      dailyGoal: getDailyGoal(),
      mobileTab: state.mobileTab,
      timerSecondsRemaining: state.timerSecondsRemaining
    },
    study: {
      studyDays: readStudyDays(),
      dailyAttempts: readJsonMap(DAILY_ATTEMPTS_KEY),
      totalStudySeconds: getTotalStudySeconds(),
      dailyStudySeconds: getDailyStudySecondsMap()
    }
  };
}

async function readCloudRecords(profile) {
  try {
    const records = await cloudClient.rpc("load_study_cloud", {
      p_slug: profile.slug,
      p_pin: profile.pin || null
    });
    return Array.isArray(records) ? records : [];
  } catch (error) {
    if (/not found|profile/i.test(error.message || "")) {
      return [];
    }
    throw error;
  }
}

async function saveCloudState(options = {}) {
  const profile = readCloudProfile(Boolean(options.interactive));
  if (!profile || !profile.pin) {
    if (options.interactive) {
      showToast("请先填写公开编号和编辑密码");
    }
    return false;
  }
  if (state.cloudSaving) {
    return false;
  }
  state.cloudSaving = true;
  try {
    const existingRecords = await readCloudRecords(profile);
    const keptRecords = existingRecords.filter((record) => record && record.id !== CLOUD_RECORD_ID);
    const records = [...keptRecords, buildCloudRecord()];
    await cloudClient.rpc("save_study_cloud", {
      p_slug: profile.slug,
      p_pin: profile.pin,
      p_records: records,
      p_display_name: profile.displayName || profile.slug,
      p_is_public: true
    });
    localStorage.setItem(CLOUD_LAST_SYNC_KEY, new Date().toISOString());
    if (!options.silent) {
      showToast(`已保存到云端：${profile.slug}`);
    }
    return true;
  } catch (error) {
    if (!options.silent) {
      showToast(error.message || "云端保存失败");
    }
    return false;
  } finally {
    state.cloudSaving = false;
  }
}

async function applyCloudRecord(record) {
  if (!record || typeof record !== "object") {
    throw new Error("云端没有题库进度");
  }
  const progressList = Array.isArray(record.progress) ? record.progress.map((progress) => enrichProgress(progress, progress.questionId)).filter((progress) => progress.questionId) : [];
  await clearStore(PROGRESS_STORE);
  await putMany(PROGRESS_STORE, progressList);
  state.progressById = new Map(progressList.map((progress) => [progress.questionId, progress]));
  if (Array.isArray(record.wrongBookRecords)) {
    QuestionBankCore.saveWrongBookRecords(record.wrongBookRecords);
  }
  if (record.settings && typeof record.settings === "object") {
    state.studyMode = Boolean(record.settings.studyMode);
    state.autoHideMastered = Boolean(record.settings.autoHideMastered);
    state.mobileTab = record.settings.mobileTab || state.mobileTab;
    state.timerSecondsRemaining = Number(record.settings.timerSecondsRemaining || state.timerSecondsRemaining);
    localStorage.setItem(STUDY_MODE_KEY, state.studyMode ? "single" : "list");
    localStorage.setItem(AUTO_HIDE_MASTERED_KEY, state.autoHideMastered ? "1" : "0");
    localStorage.setItem(MOBILE_TAB_KEY, state.mobileTab);
    localStorage.setItem(TIMER_REMAINING_KEY, String(state.timerSecondsRemaining));
    if (record.settings.dailyGoal) {
      localStorage.setItem(DAILY_GOAL_KEY, String(record.settings.dailyGoal));
    }
  }
  if (record.study && typeof record.study === "object") {
    if (Array.isArray(record.study.studyDays)) {
      saveStudyDays(record.study.studyDays);
    }
    if (record.study.dailyAttempts) {
      writeJsonMap(DAILY_ATTEMPTS_KEY, record.study.dailyAttempts);
    }
    if (record.study.dailyStudySeconds) {
      writeJsonMap(STUDY_DAILY_SECONDS_KEY, record.study.dailyStudySeconds);
    }
    if (Number.isFinite(Number(record.study.totalStudySeconds))) {
      setTotalStudySeconds(Number(record.study.totalStudySeconds));
    }
  }
  updateFilters();
  applyFilters();
  updateStudyTimeUI();
  updateTimerUI();
}

async function loadCloudState(options = {}) {
  const profile = readCloudProfile(Boolean(options.interactive));
  if (!profile) {
    if (options.interactive) {
      showToast("请先填写公开编号");
    }
    return false;
  }
  try {
    const records = await readCloudRecords(profile);
    const record = records.find((item) => item && item.id === CLOUD_RECORD_ID);
    await applyCloudRecord(record);
    if (!options.silent) {
      showToast(`已从云端加载：${profile.slug}`);
    }
    return true;
  } catch (error) {
    if (!options.silent) {
      showToast(error.message || "云端加载失败");
    }
    return false;
  }
}

function queueCloudSync() {
  const profile = readCloudProfile(false);
  if (!profile || !profile.pin) {
    return;
  }
  window.clearTimeout(state.cloudSyncTimer);
  state.cloudSyncTimer = window.setTimeout(() => {
    saveCloudState({ silent: true });
  }, CLOUD_SYNC_DELAY_MS);
}

async function openCloudPanel() {
  const profile = readCloudProfile(true);
  if (!profile) {
    return;
  }
  const shouldSave = window.confirm("确定：保存本机进度到云端\n取消：从云端加载进度");
  if (shouldSave) {
    await saveCloudState({ interactive: false });
  } else {
    await loadCloudState({ interactive: false });
  }
}

function getTotalStudySeconds() {
  const raw = Number(localStorage.getItem(STUDY_TOTAL_SECONDS_KEY) || 0);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
}

function setTotalStudySeconds(seconds) {
  localStorage.setItem(STUDY_TOTAL_SECONDS_KEY, String(Math.max(0, Math.floor(Number(seconds || 0)))));
}

function getDailyStudySecondsMap() {
  return readJsonMap(STUDY_DAILY_SECONDS_KEY);
}

function getTodayStudySeconds() {
  const map = getDailyStudySecondsMap();
  return Math.floor(Number(map[todayISO()] || 0));
}

function addStudySeconds(seconds) {
  const add = Math.max(0, Math.floor(Number(seconds || 0)));
  if (!add) {
    return;
  }
  setTotalStudySeconds(getTotalStudySeconds() + add);
  const map = getDailyStudySecondsMap();
  const today = todayISO();
  map[today] = Math.floor(Number(map[today] || 0)) + add;
  writeJsonMap(STUDY_DAILY_SECONDS_KEY, map);
  if (getTotalStudySeconds() % 60 === 0) {
    queueCloudSync();
  }
}

function formatStudyDuration(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds || 0)));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  if (hours <= 0) {
    return `${minutes}分钟`;
  }
  return `${hours}小时${String(minutes).padStart(2, "0")}分钟`;
}

function updateStudyTimeUI() {
  const total = getTotalStudySeconds();
  const today = getTodayStudySeconds();
  if (els.totalStudyTimeCount) {
    els.totalStudyTimeCount.textContent = formatStudyDuration(total);
  }
  if (els.mobileTotalStudyTime) {
    els.mobileTotalStudyTime.textContent = formatStudyDuration(total);
  }
  if (els.mobileTodayStudyTime) {
    els.mobileTodayStudyTime.textContent = formatStudyDuration(today);
  }
}

function startStudyTimeCounter() {
  if (state.studyTimeTickerId) {
    return;
  }
  state.studyTimeTickerId = window.setInterval(() => {
    if (document.visibilityState === "hidden") {
      return;
    }
    addStudySeconds(1);
    state.studyTimeUnsavedSeconds += 1;
    if (state.studyTimeUnsavedSeconds >= 10) {
      state.studyTimeUnsavedSeconds = 0;
      updateStudyTimeUI();
    }
  }, 1000);
  document.addEventListener("visibilitychange", updateStudyTimeUI);
  window.addEventListener("beforeunload", updateStudyTimeUI);
  updateStudyTimeUI();
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(dateISO, days) {
  const date = new Date(`${dateISO}T00:00:00`);
  date.setDate(date.getDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function readStudyDays() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STUDY_DAYS_KEY) || "[]");
    return Array.isArray(parsed) ? [...new Set(parsed.filter(Boolean))].sort() : [];
  } catch (error) {
    return [];
  }
}

function saveStudyDays(days) {
  localStorage.setItem(STUDY_DAYS_KEY, JSON.stringify([...new Set(days)].sort()));
}

function markStudyToday() {
  const days = readStudyDays();
  days.push(todayISO());
  saveStudyDays(days);
}

function getStudyStreak() {
  const days = new Set(readStudyDays());
  let date = new Date(`${todayISO()}T00:00:00`);
  let streak = 0;
  while (days.has(date.toISOString().slice(0, 10))) {
    streak += 1;
    date.setDate(date.getDate() - 1);
  }
  return streak;
}

function readJsonMap(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    return {};
  }
}

function writeJsonMap(key, value) {
  localStorage.setItem(key, JSON.stringify(value || {}));
}

function getDailyGoal() {
  const raw = Number(localStorage.getItem(DAILY_GOAL_KEY) || 80);
  return Math.min(500, Math.max(10, Number.isFinite(raw) ? raw : 80));
}

function setDailyGoal(value) {
  const next = Math.min(500, Math.max(10, Number(value || 80)));
  localStorage.setItem(DAILY_GOAL_KEY, String(next));
  showToast(`每日目标已设为 ${next} 题`);
  queueCloudSync();
}

function getTodayAttemptCount() {
  const map = readJsonMap(DAILY_ATTEMPTS_KEY);
  return Number(map[todayISO()] || 0);
}

function markDailyAttempt() {
  const map = readJsonMap(DAILY_ATTEMPTS_KEY);
  const today = todayISO();
  map[today] = Number(map[today] || 0) + 1;
  writeJsonMap(DAILY_ATTEMPTS_KEY, map);
}

function daysBetweenISO(startISO, endISO = todayISO()) {
  if (!startISO) {
    return Infinity;
  }
  const start = new Date(`${startISO}T00:00:00`).getTime();
  const end = new Date(`${endISO}T00:00:00`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return Infinity;
  }
  return Math.floor((end - start) / 86400000);
}

function getBackupStatus() {
  const last = localStorage.getItem(CLOUD_LAST_SYNC_KEY) || "";
  const attempted = [...state.progressById.values()].some((progress) => Number(progress.attempts || 0) > 0);
  const days = daysBetweenISO(last ? last.slice(0, 10) : "");
  if (!attempted) {
    return { needsBackup: false, title: "暂不需要云端保存", message: "开始做题后，系统会自动把进度保存到云端。" };
  }
  if (!last) {
    return { needsBackup: true, title: "还没有云端保存", message: "你已经有做题记录，建议现在保存一次到云端。" };
  }
  if (days >= 3) {
    return { needsBackup: true, title: `上次云端保存 ${days} 天前`, message: "建议点一次云端保存，避免手机或浏览器缓存变化影响进度。" };
  }
  return { needsBackup: false, title: "云端保存正常", message: `上次云端保存：${last.slice(0, 10)}。继续刷题即可。` };
}
function isProgressMastered(progress) {
  return Boolean(progress && progress.lastResult === "correct" && (Number(progress.correctStreak || 0) >= 3 || (Number(progress.correct || 0) >= 3 && Number(progress.wrong || 0) === 0)));
}

function isMasteredQuestion(question) {
  const progress = readProgress(question.id);
  return isProgressMastered(progress) && !isDueReview(question);
}

function formatTimer(seconds) {
  const safe = Math.max(0, Number(seconds || 0));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function updateTimerUI() {
  if (els.timerButton) {
    els.timerButton.classList.toggle("active", state.timerRunning);
    const label = els.timerButton.querySelector("span:last-child");
    if (label) {
      label.textContent = state.timerRunning ? formatTimer(state.timerSecondsRemaining) : "倒计时";
    }
  }
  if (els.mobileTimerPill) {
    els.mobileTimerPill.textContent = state.timerRunning ? formatTimer(state.timerSecondsRemaining) : formatTimer(state.timerSecondsRemaining);
    els.mobileTimerPill.classList.toggle("active", state.timerRunning);
  }
  const display = document.querySelector("#timerDisplay");
  if (display) {
    display.textContent = formatTimer(state.timerSecondsRemaining);
  }
  const button = document.querySelector("#timerStartPauseButton");
  if (button) {
    button.textContent = state.timerRunning ? "暂停" : "开始";
  }
}

function startTimer() {
  if (state.timerRunning) {
    return;
  }
  if (state.timerSecondsRemaining <= 0) {
    state.timerSecondsRemaining = TIMER_DEFAULT_SECONDS;
  }
  state.timerRunning = true;
  state.timerId = window.setInterval(() => {
    state.timerSecondsRemaining = Math.max(0, state.timerSecondsRemaining - 1);
    localStorage.setItem(TIMER_REMAINING_KEY, String(state.timerSecondsRemaining));
    updateTimerUI();
    if (state.timerSecondsRemaining <= 0) {
      pauseTimer();
      showToast("倒计时结束，建议先核对本轮错题");
    }
  }, 1000);
  updateTimerUI();
}

function pauseTimer() {
  state.timerRunning = false;
  if (state.timerId) {
    window.clearInterval(state.timerId);
    state.timerId = 0;
  }
  updateTimerUI();
}

function toggleTimer() {
  if (state.timerRunning) {
    pauseTimer();
  } else {
    startTimer();
  }
}

function resetTimer() {
  pauseTimer();
  state.timerSecondsRemaining = TIMER_DEFAULT_SECONDS;
  localStorage.setItem(TIMER_REMAINING_KEY, String(state.timerSecondsRemaining));
  updateTimerUI();
  showToast("倒计时已重置为25分钟");
}

function scheduleNextReview(progress, result) {
  const today = todayISO();
  const next = enrichProgress(progress, progress.questionId);
  if (result === "wrong") {
    next.reviewLevel = 0;
    next.nextReviewAt = addDaysISO(today, REVIEW_INTERVALS[0]);
    return next;
  }
  const level = Math.min(Number(next.reviewLevel || 0) + 1, REVIEW_INTERVALS.length - 1);
  next.reviewLevel = level;
  next.nextReviewAt = addDaysISO(today, REVIEW_INTERVALS[level]);
  return next;
}

function isDueReview(question) {
  const progress = readProgress(question.id);
  if (!progress.attempts && !progress.addedToWrongBookAt) {
    return false;
  }
  const due = progress.nextReviewAt || progress.addedToWrongBookAt || progress.lastAt;
  if (!due) {
    return progress.lastResult === "wrong";
  }
  return due <= todayISO();
}

function sortQuestionsForMode(a, b, status) {
  if (status === "dueReview") {
    const pa = readProgress(a.id);
    const pb = readProgress(b.id);
    const da = pa.nextReviewAt || pa.lastAt || "9999-12-31";
    const db = pb.nextReviewAt || pb.lastAt || "9999-12-31";
    if (da !== db) {
      return da.localeCompare(db);
    }
    return Number(pb.wrong || 0) - Number(pa.wrong || 0);
  }
  if (status === "weakChapter") {
    const pa = readProgress(a.id);
    const pb = readProgress(b.id);
    return Number(pb.wrong || 0) - Number(pa.wrong || 0);
  }
  return 0;
}

function chapterKey(question) {
  return `${question.subject}||${question.chapter}`;
}

function getChapterMasteryStats() {
  const groups = new Map();
  state.questions.forEach((question) => {
    const key = chapterKey(question);
    if (!groups.has(key)) {
      groups.set(key, { key, subject: question.subject, chapter: question.chapter, total: 0, attempts: 0, correct: 0, wrong: 0, unseen: 0, accuracy: 0 });
    }
    const item = groups.get(key);
    const progress = readProgress(question.id);
    item.total += 1;
    item.attempts += Number(progress.attempts || 0);
    item.correct += Number(progress.correct || 0);
    item.wrong += Number(progress.wrong || 0);
    if (!progress.attempts) {
      item.unseen += 1;
    }
  });
  return [...groups.values()].map((item) => ({
    ...item,
    accuracy: item.attempts ? Math.round((item.correct / item.attempts) * 100) : 0
  })).sort((a, b) => {
    if (a.attempts && b.attempts && a.accuracy !== b.accuracy) {
      return a.accuracy - b.accuracy;
    }
    if (a.wrong !== b.wrong) {
      return b.wrong - a.wrong;
    }
    return b.total - a.total;
  });
}

function getWeakChapterStats() {
  return getChapterMasteryStats().filter((item) => {
    if (!item.attempts) {
      return false;
    }
    return item.accuracy < 70 || item.wrong >= 2;
  });
}

function normalizeSearchText(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, "");
}

function getEnglishGrammarCategory(question) {
  if (question.subject !== "英语") {
    return "";
  }
  const text = normalizeSearchText([question.chapter, question.stem, question.answer, question.analysis, ...(question.tags || [])].join(" "));
  const rules = [
    ["名词", /名词|noun|可数|不可数|复数|单数/],
    ["代词", /代词|pronoun|物主|反身|指示|不定代词|it用法/],
    ["冠词", /冠词|article|\ba\b|\ban\b|\bthe\b/],
    ["介词", /介词|preposition|in|on|at|of|for|with|from|to/],
    ["时态", /时态|现在时|过去时|完成时|进行时|将来时|tense/],
    ["从句", /从句|定语从句|宾语从句|状语从句|主语从句|clause|which|that|who|where|when/],
    ["非谓语", /非谓语|动名词|不定式|分词|todo|doing|done/],
    ["主谓一致", /主谓一致|就近原则|谓语单复数|therebe/],
    ["句子结构", /句子结构|句型|倒装|强调句|祈使句|感叹句/]
  ];
  const found = rules.find(([, pattern]) => pattern.test(text));
  return found ? found[0] : "基础语法";
}

function getEnglishGrammarStats() {
  const map = new Map();
  state.questions.filter((question) => question.subject === "英语").forEach((question) => {
    const name = getEnglishGrammarCategory(question) || "基础语法";
    map.set(name, (map.get(name) || 0) + 1);
  });
  return [...map.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
}

function getFormulaHints(question) {
  const text = [question.chapter, question.stem, question.analysis].join(" ");
  if (question.subject === "高数") {
    if (/定义域|根号|分母|对数|ln|lg/.test(text)) {
      return ["根号内：被开方数 ≥ 0", "分母：分母 ≠ 0", "对数：真数 > 0", "偶次根号在分母：被开方数 > 0"];
    }
    if (/极限|无穷小|无穷大/.test(text)) {
      return ["先代入，能直接算先直接算", "0/0 型：因式分解、约分、等价无穷小", "常用：sinx ~ x，1-cosx ~ x²/2，ln(1+x) ~ x"];
    }
    if (/导数|求导|微分|切线|法线/.test(text)) {
      return ["(u±v)'=u'±v'", "(uv)'=u'v+uv'", "(u/v)'=(u'v-uv')/v²", "复合函数：外层导数 × 内层导数"];
    }
    if (/单调|极值|最值|凹凸|拐点/.test(text)) {
      return ["单调性看 f'(x) 的正负", "极值点通常先找 f'(x)=0 或不可导点", "凹凸性看 f''(x) 的正负", "拐点要求凹凸性发生改变"];
    }
    return ["先判断题型，再找对应条件：定义域、连续、可导、单调、极值。"];
  }
  if (question.subject === "英语") {
    const grammar = getEnglishGrammarCategory(question);
    return [`本题归类：${grammar || "基础语法"}`, "先看空格位置，再判断词性、单复数、时态或从句连接词。"];
  }
  if (question.subject === "计算机") {
    return ["先抓关键词，再定位概念：硬件、系统软件、Office、网络、安全。", "概念题优先背定义，操作题优先背菜单/快捷键/步骤。"];
  }
  return ["先看考点，再按固定步骤检查条件。"];
}

function renderFormulaHint(question) {
  const hints = getFormulaHints(question);
  return `
    <section class="hint-box">
      <strong>公式 / 思路提示</strong>
      <ul>${hints.map((item) => `<li>${renderRichText(item)}</li>`).join("")}</ul>
    </section>
  `;
}

function normalizeAnswerLetters(answer) {
  const text = String(answer || "").toUpperCase();
  const letters = new Set();
  const compact = text.replace(/\s+/g, "");
  const answerLike = compact.match(/(?:答案|选|正确答案|为|是|：|:)?([A-D](?:[、,，/和及]*[A-D]){0,3})(?:$|[^A-Z])/);
  if (answerLike) {
    answerLike[1].replace(/[A-D]/g, (letter) => {
      letters.add(letter);
      return letter;
    });
    return letters;
  }
  text.replace(/(^|[^A-Z])([A-D])([^A-Z]|$)/g, (_, before, letter) => {
    letters.add(letter);
    return `${before}${letter}`;
  });
  return letters;
}

function extractOptionLetter(option, index) {
  const text = String(option || "").trim();
  const match = text.match(/^([A-D])\s*[.．、)]/i);
  return match ? match[1].toUpperCase() : String.fromCharCode(65 + index);
}

function englishDistractorReason(grammar) {
  const map = {
    "名词": "重点检查可数/不可数、单复数和名词所有格。",
    "代词": "重点检查指代对象、人称、物主代词和反身代词。",
    "冠词": "重点检查泛指/特指，以及 a、an、the 的搭配。",
    "介词": "重点检查固定搭配、时间地点介词和动词介词搭配。",
    "时态": "重点检查时间标志词、主谓一致和动作先后。",
    "从句": "重点检查连接词在从句中充当的成分。",
    "非谓语": "重点检查主动/被动、to do/doing/done 的区别。",
    "主谓一致": "重点检查真正主语、就近原则和单复数。",
    "句子结构": "重点检查句子成分是否完整，以及是否缺谓语或连接词。"
  };
  return map[grammar] || "重点检查词性、搭配、句子结构和中文直译陷阱。";
}

function renderEnglishOptionAnalysis(question) {
  return "";
}

function renderMistakePoint(question) {
  return "";
}

function getMistakePoints(question) {
  const text = [question.chapter, question.stem, question.analysis].join(" ");
  if (question.subject === "高数") {
    if (/定义域|根号|分母|对数/.test(text)) {
      return ["不要只看根号，分母和对数真数也要一起限制。", "最后结果要取交集，不是并集。"];
    }
    if (/导数|求导|切线|法线/.test(text)) {
      return ["复合函数求导容易漏乘内层导数。", "切线斜率用 f'(x₀)，法线斜率是 -1/f'(x₀)。"];
    }
    if (/极值|单调|最值/.test(text)) {
      return ["f'(x)=0 只是候选点，不一定就是极值点。", "闭区间最值要比较端点和驻点。"];
    }
    return ["先补全限制条件，再计算；最后检查答案是否落在定义域内。"];
  }
  if (question.subject === "英语") {
    return ["不要只凭中文意思选，先判断空格需要的词性。", "名词题注意单复数，代词题注意指代对象和格。"];
  }
  if (question.subject === "计算机") {
    return ["相近概念要区分：内存/外存、系统软件/应用软件、RAM/ROM。", "缩写题不要只背中文，还要记清英文全称或作用。"];
  }
  return ["先定位考点，再按步骤排除干扰项。"];
}

function textTokens(question) {
  return new Set(normalizeSearchText([question.chapter, question.type, question.stem, ...(question.tags || [])].join(" ")).match(/[a-z0-9]+|[\u4e00-\u9fa5]{2,}/g) || []);
}

function questionSignature(question) {
  return normalizeSearchText(String(question && question.stem || ""))
    .replace(/^\d+[\.、．]/, "")
    .replace(/[abcd][\.、．][^abcd]+/gi, "")
    .replace(/[（）()\s，。,.；;：:？！?]/g, "");
}

function getSimilarQuestions(question, limit = 5) {
  const baseTokens = textTokens(question);
  const baseTags = new Set(question.tags || []);
  const baseSignature = questionSignature(question);
  const seen = new Set([baseSignature]);
  const ranked = state.questions
    .filter((item) => item.id !== question.id)
    .filter((item) => !isUnverifiedAnswer(item))
    .filter((item) => !((item.tags || []).includes("不进同类推荐")))
    .map((item) => {
      let score = 0;
      if (item.subject === question.subject) score += 10;
      if (item.chapter === question.chapter) score += 14;
      if (String(item.type || "") === String(question.type || "")) score += 3;
      if (String(item.difficulty) === String(question.difficulty)) score += 2;
      (item.tags || []).forEach((tag) => { if (baseTags.has(tag)) score += 4; });
      textTokens(item).forEach((token) => { if (baseTokens.has(token)) score += 1; });
      return { item, score, signature: questionSignature(item) };
    })
    .filter((entry) => entry.signature && entry.signature !== baseSignature)
    .filter((entry) => entry.score >= 10)
    .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id));
  const unique = [];
  for (const entry of ranked) {
    if (seen.has(entry.signature)) continue;
    seen.add(entry.signature);
    unique.push(entry.item);
    if (unique.length >= limit) break;
  }
  return unique;
}

function renderSimilarPanel() {
  if (!els.mobileSimilarPanel) {
    return;
  }
  const question = state.questions.find((item) => item.id === state.selectedId);
  if (!question) {
    els.mobileSimilarPanel.innerHTML = `<div class="mobile-similar-card"><h2>同类题</h2><p>先选择一道题，再查看同类题。</p></div>`;
    return;
  }
  const similar = getSimilarQuestions(question, 5);
  els.mobileSimilarPanel.innerHTML = `
    <div class="mobile-similar-card">
      <p class="mobile-similar-kicker">当前题</p>
      <h2>${escapeHtml(question.subject || "")} · ${escapeHtml(question.chapter || "")}</h2>
      <p class="mobile-similar-current">${escapeHtml(String(question.stem || "").slice(0, 120))}</p>
      <p class="mobile-similar-note">同类题只从现有题库里挑，不新编；已排除当前题、重复题干和答案待核对题。</p>
    </div>
    <div class="mobile-similar-card">
      <h2>同类题推荐</h2>
      ${similar.length ? `<div class="similar-list standalone">${similar.map((item, index) => `
        <button type="button" class="similar-item" data-similar-id="${escapeHtml(item.id)}">
          <b>同类 ${index + 1}</b>
          <span>${escapeHtml(item.subject || "")} · ${escapeHtml(item.chapter || "")}</span>
          <small>${escapeHtml(String(item.stem || "").slice(0, 90))}</small>
        </button>
      `).join("")}</div>` : `<p class="mobile-similar-note">这道题暂时没有足够可靠的同类题。可以换同章节其它题再看。</p>`}
    </div>
  `;
  els.mobileSimilarPanel.querySelectorAll("[data-similar-id]").forEach((button) => {
    button.addEventListener("click", () => {
      selectQuestion(button.dataset.similarId);
      setMobileTab("quiz");
    });
  });
}

function renderSimilarQuestions(question) {
  return "";
}

function typesetMathSoon() {
  if (!window.MathJax || !window.MathJax.typesetPromise) {
    return;
  }
  window.clearTimeout(typesetMathSoon.timer);
  typesetMathSoon.timer = window.setTimeout(() => {
    window.MathJax.typesetPromise([els.detailPanel, els.questionsList]).catch(() => {});
  }, 60);
}


function renderRichText(value) {
  let html = escapeHtml(value);
  html = prettifyMathHtml(html);
  return html.replace(/\r?\n/g, "<br>");
}

function prettifyMathHtml(html, depth = 0) {
  let output = String(html || "");
  if (depth > 5) {
    return output;
  }

  const placeholders = [];
  const placeholderPattern = /\uE000(\d+)\uE001/g;
  const makePlaceholder = (value) => {
    const token = `\uE000${placeholders.length}\uE001`;
    placeholders.push(value);
    return token;
  };
  const restorePlaceholders = (value) => String(value || "").replace(placeholderPattern, (_, index) => placeholders[Number(index)] || "");
  const hasPlaceholder = (value) => {
    placeholderPattern.lastIndex = 0;
    return placeholderPattern.test(String(value || ""));
  };
  const formatOperand = (value) => {
    const text = String(value || "");
    if (hasPlaceholder(text)) {
      placeholderPattern.lastIndex = 0;
      return restorePlaceholders(text);
    }
    return prettifyMathHtml(text, depth + 1);
  };
  const makeFraction = (top, bottom) => makePlaceholder(`<span class="math-frac"><span>${formatOperand(top)}</span><span>${formatOperand(bottom)}</span></span>`);
  const makeRoot = (symbol, radicand, degree = 2) => makePlaceholder(
    `<span class="math-root ${degree === 3 ? "cube-root" : "square-root"}"><span class="math-root-sign">${symbol}</span><span class="math-radicand">${prettifyMathHtml(radicand, depth + 1)}</span></span>`
  );

  function findMatching(text, start, openChar, closeChar) {
    let level = 0;
    for (let index = start; index < text.length; index += 1) {
      const char = text[index];
      if (char === openChar) {
        level += 1;
      } else if (char === closeChar) {
        level -= 1;
        if (level === 0) {
          return index;
        }
      }
    }
    return -1;
  }

  function readGrouped(text, start) {
    const openChar = text[start];
    const closeChar = openChar === "(" ? ")" : (openChar === "[" ? "]" : "}");
    const end = findMatching(text, start, openChar, closeChar);
    if (end < 0) {
      return null;
    }
    return {
      value: text.slice(start + 1, end),
      end: end + 1
    };
  }

  function readRadicand(text, start) {
    let index = start;
    while (text[index] === " ") {
      index += 1;
    }
    if (text[index] === "(" || text[index] === "[" || text[index] === "{") {
      return readGrouped(text, index);
    }

    const atomStart = index;
    while (index < text.length) {
      const char = text[index];
      if (/^[\s,，;；。:：=<>≤≥+\-*\/\\|&\)\]\}]$/.test(char)) {
        break;
      }
      if (char === "^" && (text[index + 1] === "(" || text[index + 1] === "[")) {
        const grouped = readGrouped(text, index + 1);
        if (!grouped) {
          index += 1;
        } else {
          index = grouped.end;
        }
        continue;
      }
      index += 1;
    }

    if (index <= atomStart) {
      return null;
    }
    return {
      value: text.slice(atomStart, index),
      end: index
    };
  }

  function convertRadicals(text) {
    let result = "";
    for (let index = 0; index < text.length;) {
      const tail = text.slice(index);
      const sqrtMatch = tail.match(/^sqrt\s*(?=[\(\[\{])/i);
      let symbol = "";
      let degree = 2;
      let radicandStart = -1;

      if (sqrtMatch) {
        symbol = "√";
        degree = 2;
        radicandStart = index + sqrtMatch[0].length;
      } else if (text.startsWith("根号", index)) {
        symbol = "√";
        degree = 2;
        radicandStart = index + 2;
      } else if (text.startsWith("³√", index)) {
        symbol = "∛";
        degree = 3;
        radicandStart = index + 2;
      } else if (text[index] === "∛") {
        symbol = "∛";
        degree = 3;
        radicandStart = index + 1;
      } else if (text[index] === "√") {
        symbol = "√";
        degree = 2;
        radicandStart = index + 1;
      }

      if (!symbol) {
        result += text[index];
        index += 1;
        continue;
      }

      const radicand = readRadicand(text, radicandStart);
      if (!radicand) {
        result += symbol;
        index = radicandStart;
        continue;
      }

      result += makeRoot(symbol, radicand.value, degree);
      index = radicand.end;
    }
    return result;
  }


  function findMatchingBackward(text, closeIndex, openChar, closeChar) {
    let level = 0;
    for (let index = closeIndex; index >= 0; index -= 1) {
      const char = text[index];
      if (char === closeChar) {
        level += 1;
      } else if (char === openChar) {
        level -= 1;
        if (level === 0) {
          return index;
        }
      }
    }
    return -1;
  }

  function readPlaceholderForward(text, start) {
    if (text[start] !== "\uE000") {
      return null;
    }
    const end = text.indexOf("\uE001", start + 1);
    if (end < 0) {
      return null;
    }
    return { start, end: end + 1, value: text.slice(start, end + 1) };
  }

  function readPlaceholderBackward(text, end) {
    if (text[end - 1] !== "\uE001") {
      return null;
    }
    const start = text.lastIndexOf("\uE000", end - 2);
    if (start < 0) {
      return null;
    }
    return { start, end, value: text.slice(start, end) };
  }

  function extendLeftCoefficient(text, start) {
    let index = start;
    while (index > 0 && /[A-Za-z0-9π∞φθξαβγ]/.test(text[index - 1])) {
      index -= 1;
    }
    return index;
  }

  function readLeftOperand(text, slashIndex) {
    let end = slashIndex;
    while (end > 0 && text[end - 1] === " ") {
      end -= 1;
    }
    if (end <= 0) {
      return null;
    }

    const placeholder = readPlaceholderBackward(text, end);
    if (placeholder) {
      const start = extendLeftCoefficient(text, placeholder.start);
      return { start, end, value: text.slice(start, end) };
    }

    const closeChar = text[end - 1];
    if (closeChar === ")" || closeChar === "]") {
      const openChar = closeChar === ")" ? "(" : "[";
      const groupStart = findMatchingBackward(text, end - 1, openChar, closeChar);
      if (groupStart >= 0) {
        const start = extendLeftCoefficient(text, groupStart);
        return { start, end, value: text.slice(start, end) };
      }
    }

    let start = end;
    while (start > 0 && /[A-Za-z0-9π∞φθξαβγ₀₁₂₃₄₅₆₇₈₉ₙₖ₊₋⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]/.test(text[start - 1])) {
      start -= 1;
    }
    if (start === end) {
      return null;
    }
    return { start, end, value: text.slice(start, end) };
  }

  function readRightOperand(text, slashIndex) {
    let start = slashIndex + 1;
    while (start < text.length && text[start] === " ") {
      start += 1;
    }
    if (start >= text.length) {
      return null;
    }

    let end = start;
    while (end < text.length && /[A-Za-z0-9π∞φθξαβγ]/.test(text[end])) {
      end += 1;
    }
    const placeholder = readPlaceholderForward(text, end);
    if (placeholder) {
      return { start, end: placeholder.end, value: text.slice(start, placeholder.end) };
    }

    const directPlaceholder = readPlaceholderForward(text, start);
    if (directPlaceholder) {
      return directPlaceholder;
    }

    const openChar = text[start];
    if (openChar === "(" || openChar === "[" || openChar === "{") {
      const grouped = readGrouped(text, start);
      if (grouped) {
        return { start, end: grouped.end, value: text.slice(start, grouped.end) };
      }
    }

    end = start;
    while (end < text.length && /[A-Za-z0-9π∞φθξαβγ₀₁₂₃₄₅₆₇₈₉ₙₖ₊₋⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]/.test(text[end])) {
      end += 1;
    }
    if (end === start) {
      return null;
    }
    return { start, end, value: text.slice(start, end) };
  }

  function looksLikeMathOperand(value) {
    const text = String(value || "");
    return /[A-Za-z0-9π∞φθξαβγ\uE000⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉]/.test(text) && !/[\u4e00-\u9fa5]/.test(text);
  }

  function convertBalancedFractions(text) {
    let result = String(text || "");
    let index = 0;
    while (index < result.length) {
      if (result[index] !== "/") {
        index += 1;
        continue;
      }
      const left = readLeftOperand(result, index);
      const right = readRightOperand(result, index);
      if (!left || !right || !looksLikeMathOperand(left.value) || !looksLikeMathOperand(right.value)) {
        index += 1;
        continue;
      }
      const replacement = makeFraction(left.value, right.value);
      result = result.slice(0, left.start) + replacement + result.slice(right.end);
      index = left.start + replacement.length;
    }
    return result;
  }

  output = convertRadicals(output);

  // Powers first, so x^(3/2) becomes a compact exponent instead of a stacked fraction.
  output = output.replace(/([A-Za-z0-9πφθξαβγ]|\)|\])\^\(([^()<>\n]{1,60})\)/g, (_, base, exponent) => `${base}<sup>${String(exponent).replace(/\//g, "⁄")}</sup>`);
  output = output.replace(/([A-Za-z0-9πφθξαβγ]|\)|\])\^\[([^\[\]<>\n]{1,60})\]/g, (_, base, exponent) => `${base}<sup>${String(exponent).replace(/\//g, "⁄")}</sup>`);
  output = output.replace(/([A-Za-z0-9πφθξαβγ]|\)|\])\^([A-Za-z0-9πφθξαβγ]|-?\d+)/g, "$1<sup>$2</sup>");

  // Common differential quotients such as dy/dx, dy/dt, dx/dt.
  output = output.replace(/\b(d[xyzt])\s*\/\s*(d[xyzt])\b/g, (_, top, bottom) => makeFraction(top, bottom));

  // Fractions after radicals: supports 1/√(...), 3√2/2, (dy/dt)/(dx/dt), x/(x-1)².
  const placeholderAtom = "\\uE000\\d+\\uE001";
  const placeholderWithCoeff = `(?:[A-Za-z0-9π∞φθξαβγ]*${placeholderAtom})`;
  const roundGroup = "(?:\\([^()<>]{1,90}\\)|\\[[^\\[\\]<>]{1,90}\\])(?:[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]+|\\^[A-Za-z0-9πφθξαβγ+-]+)?";
  const plainAtom = "[A-Za-z0-9π∞φθξαβγ]+[₀₁₂₃₄₅₆₇₈₉ₙₖ₊₋]*(?:[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]+|\\^[A-Za-z0-9πφθξαβγ+-]+)?";
  const atom = `(?:${placeholderWithCoeff}|${placeholderAtom}|${roundGroup}|${plainAtom})`;
  const fractionPattern = new RegExp(`(${atom})\\s*\\/\\s*(${atom})`, "g");
  output = convertBalancedFractions(output);
  output = output.replace(fractionPattern, (_, top, bottom) => makeFraction(top, bottom));



  return restorePlaceholders(output);
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
  [els.chapterFilter, els.sourceFilter, els.statusFilter, els.difficultyFilter].filter(Boolean).forEach((select) => {
    select.addEventListener("change", () => {
      state.page = 1;
      applyFilters();
    });
  });
  if (els.reviewQueueButton) {
    els.reviewQueueButton.addEventListener("click", () => {
      els.statusFilter.value = "dueReview";
      state.page = 1;
      applyFilters();
    });
  }
  if (els.studyModeButton) {
    els.studyModeButton.addEventListener("click", () => {
      state.studyMode = !state.studyMode;
      localStorage.setItem(STUDY_MODE_KEY, state.studyMode ? "single" : "list");
      queueCloudSync();
      render();
    });
  }
  if (els.autoHideMasteredButton) {
    els.autoHideMasteredButton.addEventListener("click", () => {
      state.autoHideMastered = !state.autoHideMastered;
      localStorage.setItem(AUTO_HIDE_MASTERED_KEY, state.autoHideMastered ? "1" : "0");
      queueCloudSync();
      state.page = 1;
      applyFilters();
    });
  }
  if (els.timerButton) {
    els.timerButton.addEventListener("click", toggleTimer);
  }

  if (els.mobileFilterToggle) {
    els.mobileFilterToggle.addEventListener("click", () => {
      state.filtersOpen = !state.filtersOpen;
      renderMobileChrome();
    });
  }
  if (els.mobileTimerPill) {
    els.mobileTimerPill.addEventListener("click", toggleTimer);
  }
  els.mobileTabButtons.forEach((button) => {
    button.addEventListener("click", () => setMobileTab(button.dataset.mobileTab));
  });
  if (els.mobileCloudButton) {
    els.mobileCloudButton.addEventListener("click", openCloudPanel);
  }
  if (els.mobileDailyGoalInput) {
    els.mobileDailyGoalInput.addEventListener("change", () => {
      setDailyGoal(els.mobileDailyGoalInput.value);
      render();
    });
  }
  if (els.mobileMeStudyModeButton) {
    els.mobileMeStudyModeButton.addEventListener("click", () => {
      state.studyMode = !state.studyMode;
      localStorage.setItem(STUDY_MODE_KEY, state.studyMode ? "single" : "list");
      queueCloudSync();
      render();
    });
  }
  if (els.mobileMeAutoHideMasteredButton) {
    els.mobileMeAutoHideMasteredButton.addEventListener("click", () => {
      state.autoHideMastered = !state.autoHideMastered;
      localStorage.setItem(AUTO_HIDE_MASTERED_KEY, state.autoHideMastered ? "1" : "0");
      queueCloudSync();
      state.page = 1;
      applyFilters();
    });
  }
  if (els.mobileMeTimerButton) {
    els.mobileMeTimerButton.addEventListener("click", toggleTimer);
  }
  els.prevPageButton.addEventListener("click", () => {
    state.page -= 1;
    applyFilters();
  });
  els.nextPageButton.addEventListener("click", () => {
    state.page += 1;
    applyFilters();
  });
  if (els.cloudButton) {
    els.cloudButton.addEventListener("click", openCloudPanel);
  }
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
  if (new URLSearchParams(window.location.search).has("view")) {
    await loadCloudState({ silent: true });
  }
  startStudyTimeCounter();
  await registerServiceWorker();
}

init().catch((error) => {
  console.error(error);
  showToast("题库启动失败，请刷新重试");
});

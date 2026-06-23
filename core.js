(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.QuestionBankCore = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const WRONG_BOOK_KEY = "wrong-question-organizer:v1";
  const PAGE_SIZE = 30;

  function uniqueValues(values) {
    return [...new Set((values || []).filter(Boolean).map((value) => String(value).trim()).filter(Boolean))];
  }

  function normalizeChapter(subject, chapter) {
    const safeSubject = String(subject || "").trim();
    const safeChapter = String(chapter || "未分章").trim();

    if (safeSubject === "英语") {
      if (/名词|代词/.test(safeChapter)) {
        return "名词与代词";
      }
      if (/基础语法|句子结构/.test(safeChapter)) {
        return "基础语法·句子结构";
      }
    }

    return safeChapter;
  }

  function availableChapters(questions, subject = "all") {
    const selectedSubject = subject || "all";
    return uniqueValues(
      (questions || [])
        .map(normalizeQuestion)
        .filter((question) => selectedSubject === "all" || question.subject === selectedSubject)
        .map((question) => question.chapter)
    );
  }

  function todayISO(now = new Date()) {
    return now.toISOString().slice(0, 10);
  }

  function addDaysISO(dateISO, days) {
    const date = new Date(`${dateISO}T00:00:00`);
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function normalizeQuestion(question) {
    const source = question || {};
    const id = String(source.id || source.questionId || cryptoRandomId()).trim();
    return {
      id,
      subject: String(source.subject || "未分类").trim(),
      chapter: normalizeChapter(String(source.subject || "未分类").trim(), source.chapter),
      type: String(source.type || source.questionType || "练习题").trim(),
      stem: String(source.stem || source.question || source.title || "").trim(),
      options: Array.isArray(source.options) ? source.options.map((option) => String(option).trim()).filter(Boolean) : [],
      answer: String(source.answer || source.correctAnswer || "").trim(),
      analysis: String(source.analysis || source.solution || source.explanation || "").trim(),
      difficulty: String(source.difficulty || "2").trim(),
      tags: uniqueValues(source.tags || []),
      images: Array.isArray(source.images) ? source.images.map((image) => String(image).trim()).filter(Boolean) : [],
      source: String(source.source || "题库").trim()
    };
  }

  function cryptoRandomId() {
    return `Q-${Math.random().toString(36).slice(2, 10)}`;
  }

  function createProgress(questionId) {
    return {
      questionId,
      attempts: 0,
      correct: 0,
      wrong: 0,
      lastResult: "",
      lastAt: "",
      solutionVisible: false,
      addedToWrongBookAt: ""
    };
  }

  function normalizeProgress(progress, questionId) {
    const source = progress || {};
    return {
      questionId: source.questionId || questionId,
      attempts: Number(source.attempts || 0),
      correct: Number(source.correct || 0),
      wrong: Number(source.wrong || 0),
      lastResult: String(source.lastResult || ""),
      lastAt: String(source.lastAt || ""),
      solutionVisible: Boolean(source.solutionVisible),
      addedToWrongBookAt: String(source.addedToWrongBookAt || "")
    };
  }

  function setSolutionVisible(progress, visible) {
    return { ...normalizeProgress(progress, progress && progress.questionId), solutionVisible: Boolean(visible) };
  }

  function isSolutionVisible(progress) {
    return Boolean(progress && progress.solutionVisible);
  }

  function recordAttempt(progress, result, dateISO = todayISO()) {
    const next = normalizeProgress(progress, progress && progress.questionId);
    next.attempts += 1;
    next.lastResult = result === "correct" ? "correct" : "wrong";
    next.lastAt = dateISO;
    if (next.lastResult === "correct") {
      next.correct += 1;
    } else {
      next.wrong += 1;
    }
    return next;
  }

  function markAddedToWrongBook(progress, dateISO = todayISO()) {
    return { ...normalizeProgress(progress, progress && progress.questionId), addedToWrongBookAt: dateISO };
  }

  function clearAddedToWrongBook(progress) {
    return { ...normalizeProgress(progress, progress && progress.questionId), addedToWrongBookAt: "" };
  }

  function questionMatchesKeyword(question, keyword) {
    if (!keyword) {
      return true;
    }
    const haystack = [
      question.id,
      question.subject,
      question.chapter,
      question.type,
      question.stem,
      question.answer,
      question.analysis,
      ...(question.options || []),
      ...(question.tags || [])
    ].join(" ").toLowerCase();
    return haystack.includes(keyword.toLowerCase());
  }

  function questionMatchesStatus(question, status, progressById) {
    if (!status || status === "all") {
      return true;
    }
    const progress = progressById instanceof Map ? progressById.get(question.id) : progressById && progressById[question.id];
    if (status === "unseen") {
      return !progress || !progress.attempts;
    }
    if (status === "wrong") {
      return progress && progress.lastResult === "wrong";
    }
    if (status === "correct") {
      return progress && progress.lastResult === "correct";
    }
    if (status === "wrongBook") {
      return progress && progress.addedToWrongBookAt;
    }
    return true;
  }

  function filterQuestions(questions, filters = {}) {
    const keyword = String(filters.keyword || "").trim();
    const subject = filters.subject || "all";
    const chapter = filters.chapter || "all";
    const status = filters.status || "all";
    const progressById = filters.progressById || new Map();

    return (questions || [])
      .map(normalizeQuestion)
      .filter((question) => subject === "all" || question.subject === subject)
      .filter((question) => chapter === "all" || question.chapter === chapter)
      .filter((question) => questionMatchesStatus(question, status, progressById))
      .filter((question) => questionMatchesKeyword(question, keyword));
  }

  function paginate(items, page = 1, pageSize = PAGE_SIZE) {
    const safePageSize = Math.max(1, Number(pageSize || PAGE_SIZE));
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / safePageSize));
    const currentPage = Math.min(Math.max(1, Number(page || 1)), totalPages);
    const startIndex = (currentPage - 1) * safePageSize;
    const pageItems = items.slice(startIndex, startIndex + safePageSize);
    return {
      items: pageItems,
      total,
      page: currentPage,
      pageSize: safePageSize,
      totalPages,
      start: total === 0 ? 0 : startIndex + 1,
      end: startIndex + pageItems.length
    };
  }

  function toWrongBookRecord(questionInput, progressInput, dateISO = todayISO()) {
    const question = normalizeQuestion(questionInput);
    const progress = normalizeProgress(progressInput, question.id);
    const title = `${question.id} ${question.chapter}`;
    const solutionParts = [
      question.answer ? `【答案】${question.answer}` : "",
      question.analysis ? `【解析】${question.analysis}` : "",
      progress.lastResult === "wrong" ? "【错因】题库练习中做错，建议加入错题本复盘。" : ""
    ].filter(Boolean);

    return {
      id: `QB-${question.id}`,
      title,
      subject: question.subject,
      chapter: question.chapter,
      source: "题库练习",
      wrongAt: dateISO,
      nextReview: addDaysISO(dateISO, 1),
      status: "reviewing",
      difficulty: question.difficulty,
      question: question.stem,
      options: question.options,
      wrongAnswer: "",
      correctAnswer: question.answer,
      reason: progress.lastResult === "wrong" ? "题库练习中做错。" : "主动加入错题本。",
      analysis: question.analysis,
      solution: solutionParts.join("\n"),
      tags: uniqueValues(["题库导入", question.subject, question.chapter, ...(question.tags || [])]),
      images: question.images || [],
      reviews: [],
      createdAt: `${dateISO}T00:00:00`,
      updatedAt: `${dateISO}T00:00:00`,
      bankQuestionId: question.id
    };
  }

  function mergeWrongBookRecord(existingRecord, nextRecord) {
    return {
      ...existingRecord,
      ...nextRecord,
      reviews: Array.isArray(existingRecord.reviews) ? existingRecord.reviews : [],
      tags: uniqueValues([...(existingRecord.tags || []), ...(nextRecord.tags || [])]),
      createdAt: existingRecord.createdAt || nextRecord.createdAt,
      updatedAt: nextRecord.updatedAt
    };
  }

  function upsertWrongBookRecord(records, nextRecord) {
    const list = Array.isArray(records) ? records.slice() : [];
    const index = list.findIndex((record) => record && record.id === nextRecord.id);
    if (index >= 0) {
      list[index] = mergeWrongBookRecord(list[index], nextRecord);
      return list;
    }
    return [nextRecord, ...list];
  }

  function removeWrongBookRecord(records, questionOrRecordId) {
    const target = String(questionOrRecordId || "");
    const recordId = target.startsWith("QB-") ? target : `QB-${target}`;
    return (Array.isArray(records) ? records : []).filter((record) => {
      if (!record) {
        return false;
      }
      return record.id !== recordId && record.bankQuestionId !== target;
    });
  }

  function loadWrongBookRecords(storage = globalThis.localStorage) {
    try {
      const raw = storage.getItem(WRONG_BOOK_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function saveWrongBookRecords(records, storage = globalThis.localStorage) {
    storage.setItem(WRONG_BOOK_KEY, JSON.stringify(records));
  }

  return {
    WRONG_BOOK_KEY,
    PAGE_SIZE,
    addDaysISO,
    availableChapters,
    clearAddedToWrongBook,
    createProgress,
    filterQuestions,
    isSolutionVisible,
    loadWrongBookRecords,
    markAddedToWrongBook,
    normalizeProgress,
    normalizeQuestion,
    paginate,
    recordAttempt,
    removeWrongBookRecord,
    saveWrongBookRecords,
    setSolutionVisible,
    toWrongBookRecord,
    normalizeChapter,
    uniqueValues,
    upsertWrongBookRecord
  };
});

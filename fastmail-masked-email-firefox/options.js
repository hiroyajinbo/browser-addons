'use strict';

const $ = (selector) => document.querySelector(selector);

const tokenEl = $('#token');
const historyLimitEl = $('#history-limit');
const historyMaxAgeDaysEl = $('#history-max-age-days');
const statusEl = $('#status');
const historyStatusEl = $('#history-status');
const saveTokenEl = $('#save-token');
const diagnoseEl = $('#diagnose');

let autoSaveTimer = 0;

function clampNumber(value, { min, max, fallback }) {
  const number = Number.parseInt(value, 10);
  if (Number.isNaN(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function setStatus(text, kind = '') {
  statusEl.textContent = text;
  statusEl.className = `status ${kind}`.trim();
}

function setHistoryStatus(text, kind = '') {
  historyStatusEl.textContent = text;
  historyStatusEl.className = `section-status ${kind}`.trim();
}

function setBusy(isBusy) {
  saveTokenEl.disabled = isBusy;
  diagnoseEl.disabled = isBusy;
}

async function loadState() {
  const state = await browser.runtime.sendMessage({ type: 'getPopupState' });
  historyLimitEl.value = state.historyLimit || 20;
  historyMaxAgeDaysEl.value = state.historyMaxAgeDays || 0;

  if (!state.hasToken) {
    setStatus('API tokenを保存してください');
  } else if (state.maskedCapability) {
    setStatus('接続OK。Masked Emailを作成できます。', 'ok');
  } else if (state.lastError) {
    setStatus(`エラー: ${state.lastError}`, 'error');
  } else {
    setStatus('接続テストを実行してください。');
  }
}

async function saveHistoryOptions() {
  setHistoryStatus('保存中...');
  const fallbackLimit = clampNumber(historyLimitEl.value, { min: 3, max: 20, fallback: 20 });
  const fallbackMaxAgeDays = clampNumber(historyMaxAgeDaysEl.value, { min: 0, max: 365, fallback: 0 });
  const result = await browser.runtime.sendMessage({
    type: 'saveHistoryOptions',
    options: {
      historyLimit: fallbackLimit,
      historyMaxAgeDays: fallbackMaxAgeDays
    }
  });

  if (!result?.ok) {
    throw new Error(result?.error || '履歴表示設定を保存できませんでした。拡張機能を再読み込みしてから再度お試しください。');
  }

  historyLimitEl.value = result.historyLimit ?? fallbackLimit;
  historyMaxAgeDaysEl.value = result.historyMaxAgeDays ?? fallbackMaxAgeDays;
  setHistoryStatus('保存しました。', 'ok');
}

function scheduleHistoryAutoSave() {
  clearTimeout(autoSaveTimer);
  setHistoryStatus('保存待ち...');
  autoSaveTimer = setTimeout(() => {
    saveHistoryOptions().catch((error) => setHistoryStatus(error.message || String(error), 'error'));
  }, 500);
}

async function saveToken() {
  setBusy(true);
  setStatus('保存中...');
  try {
    const result = await browser.runtime.sendMessage({ type: 'saveToken', token: tokenEl.value });
    if (!result.ok) {
      setStatus(`接続エラー: ${result.error}`, 'error');
    } else {
      setStatus('保存しました。', 'ok');
    }
    tokenEl.value = '';
    await loadState();
  } finally {
    setBusy(false);
  }
}

async function diagnose() {
  setBusy(true);
  setStatus('接続テスト中...');
  try {
    const result = await browser.runtime.sendMessage({ type: 'diagnose' });
    if (!result.ok) {
      setStatus(`接続エラー: ${result.error}`, 'error');
    } else {
      setStatus('接続OK。Masked Emailを作成できます。', 'ok');
    }
    await loadState();
  } finally {
    setBusy(false);
  }
}

saveTokenEl.addEventListener('click', () => saveToken().catch((error) => setStatus(error.message || String(error), 'error')));
diagnoseEl.addEventListener('click', () => diagnose().catch((error) => setStatus(error.message || String(error), 'error')));
historyLimitEl.addEventListener('change', scheduleHistoryAutoSave);
historyMaxAgeDaysEl.addEventListener('change', scheduleHistoryAutoSave);

loadState().catch((error) => setStatus(error.message || String(error), 'error'));

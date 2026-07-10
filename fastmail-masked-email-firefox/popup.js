'use strict';

const $ = (selector) => document.querySelector(selector);

const statusEl = $('#status');
const descriptionEl = $('#description');
const urlEl = $('#url');
const domainEl = $('#domain');
const historySummaryEl = $('#history-summary');
const historyEl = $('#history');
const createEl = $('#create');
const setupEl = $('#setup');
const creatorEl = $('#creator');
const resultEl = $('#result');
const createdEmailEl = $('#created-email');
const copyCreatedEl = $('#copy-created');
const historyPanelEl = $('#history-panel');
const setupTokenEl = $('#setup-token');
const saveSetupTokenEl = $('#save-setup-token');

let lastCreatedEmail = '';

function setStatus(text, kind = '') {
  statusEl.textContent = text;
  statusEl.className = kind;
}

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function domainFromUrl(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch (error) {
    return '';
  }
}

function normalizeDomain(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  return domainFromUrl(trimmed) || trimmed.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
}

function setBusy(isBusy) {
  createEl.disabled = isBusy;
}

function renderHistory(history) {
  historyEl.textContent = '';

  if (!history || history.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'history-meta';
    empty.textContent = 'まだ作成履歴はありません。';
    historyEl.appendChild(empty);
    return;
  }

  for (const item of history) {
    const row = document.createElement('div');
    row.className = 'history-item';

    const email = document.createElement('div');
    email.className = 'history-email';
    email.textContent = item.email;

    const meta = document.createElement('div');
    meta.className = 'history-meta';
    meta.textContent = [item.description, item.domain, formatDate(item.createdAt)].filter(Boolean).join(' / ');

    const copy = document.createElement('button');
    copy.type = 'button';
    copy.textContent = 'コピー';
    copy.addEventListener('click', async () => {
      await navigator.clipboard.writeText(item.email);
      setStatus('コピーしました');
    });

    row.append(email, meta, copy);
    historyEl.appendChild(row);
  }
}

function renderHistorySummary(state) {
  const limit = state.historyLimit || 20;
  const maxAgeDays = state.historyMaxAgeDays || 0;
  historySummaryEl.textContent = maxAgeDays > 0
    ? `直近${maxAgeDays}日以内 / 最大${limit}件`
    : `最大${limit}件`;
}

async function loadState() {
  const state = await browser.runtime.sendMessage({ type: 'getPopupState' });
  renderHistorySummary(state);
  renderHistory(state.history || []);

  const isReady = Boolean(state.hasToken && state.maskedCapability);
  setupEl.classList.toggle('hidden', isReady);
  creatorEl.classList.toggle('hidden', !isReady);
  historyPanelEl.classList.toggle('hidden', !isReady);
  if (!isReady) resultEl.classList.add('hidden');
  createEl.disabled = !isReady;

  if (!state.hasToken) {
    setStatus('API tokenを設定してください');
  } else if (isReady) {
    setStatus('作成できます');
  } else if (state.lastError) {
    setStatus(`エラー: ${state.lastError}`, 'error');
  } else {
    setStatus('API tokenを入力して接続を確認してください');
  }
}

async function prefillFromActiveTab() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.url) return;

  urlEl.value = tab.url;
  domainEl.value = normalizeDomain(tab.url);
  if (!descriptionEl.value && domainEl.value) {
    descriptionEl.value = `${domainEl.value} 用`;
  }
}

async function createMaskedEmail() {
  setBusy(true);
  setStatus('Masked Emailを作成中...');

  try {
    const result = await browser.runtime.sendMessage({
      type: 'createMaskedEmail',
      input: {
        description: descriptionEl.value.trim(),
        url: urlEl.value.trim(),
        domain: domainEl.value.trim()
      }
    });

    if (!result.ok) {
      setStatus(`作成エラー: ${result.error}`, 'error');
      await loadState();
      return;
    }

    const email = result.maskedEmail.email;
    await navigator.clipboard.writeText(email);
    lastCreatedEmail = email;
    createdEmailEl.textContent = email;
    resultEl.classList.remove('hidden');
    setStatus(`${email} を作成してコピーしました`);
    await loadState();
  } finally {
    setBusy(false);
  }
}

urlEl.addEventListener('input', () => {
  if (!domainEl.value) {
    domainEl.value = normalizeDomain(urlEl.value);
  }
});

domainEl.addEventListener('blur', () => {
  domainEl.value = normalizeDomain(domainEl.value);
});

$('#options').addEventListener('click', () => browser.runtime.sendMessage({ type: 'openOptions' }));
$('#open-options-setup').addEventListener('click', () => browser.runtime.sendMessage({ type: 'openOptions' }));
saveSetupTokenEl.addEventListener('click', async () => {
  const token = setupTokenEl.value.trim();
  if (!token) {
    setStatus('API tokenを入力してください');
    return;
  }

  saveSetupTokenEl.disabled = true;
  setStatus('保存して接続確認中...');
  try {
    const result = await browser.runtime.sendMessage({ type: 'saveToken', token });
    if (!result?.ok) {
      await loadState();
      return;
    }
    setupTokenEl.value = '';
    await loadState();
  } catch (error) {
    setStatus(`セットアップに失敗: ${error.message || error}`, 'error');
  } finally {
    saveSetupTokenEl.disabled = false;
  }
});
copyCreatedEl.addEventListener('click', async () => {
  if (!lastCreatedEmail) return;
  await navigator.clipboard.writeText(lastCreatedEmail);
  setStatus('再コピーしました');
});
createEl.addEventListener('click', () => createMaskedEmail().catch((error) => setStatus(error.message || String(error), 'error')));

prefillFromActiveTab()
  .then(loadState)
  .catch((error) => setStatus(error.message || String(error), 'error'));

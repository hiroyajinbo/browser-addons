'use strict';

const $ = (selector) => document.querySelector(selector);

const tokenEl = $('#token');
const statusEl = $('#status');
const diagnosticEl = $('#diagnostic');
const saveTokenEl = $('#save-token');
const diagnoseEl = $('#diagnose');

function setStatus(text, kind = '') {
  statusEl.textContent = text;
  statusEl.className = `status ${kind}`.trim();
}

function setBusy(isBusy) {
  saveTokenEl.disabled = isBusy;
  diagnoseEl.disabled = isBusy;
}

function renderDiagnostic(state) {
  diagnosticEl.textContent = JSON.stringify({
    hasToken: state.hasToken,
    maskedCapability: state.maskedCapability || '(not found)',
    lastError: state.lastError || '',
    session: state.lastSession || null
  }, null, 2);
}

async function loadState() {
  const state = await browser.runtime.sendMessage({ type: 'getPopupState' });
  renderDiagnostic(state);

  if (!state.hasToken) {
    setStatus('API tokenを保存してください');
  } else if (state.maskedCapability) {
    setStatus(`Masked Email capabilityを検出しました: ${state.maskedCapability}`, 'ok');
  } else if (state.lastError) {
    setStatus(`エラー: ${state.lastError}`, 'error');
  } else {
    setStatus('Masked Email capabilityは未検出です。再診断してください。');
  }
}

async function saveToken() {
  setBusy(true);
  setStatus('保存・診断中...');
  try {
    const result = await browser.runtime.sendMessage({ type: 'saveToken', token: tokenEl.value });
    if (!result.ok) {
      setStatus(`診断エラー: ${result.error}`, 'error');
    }
    tokenEl.value = '';
    await loadState();
  } finally {
    setBusy(false);
  }
}

async function diagnose() {
  setBusy(true);
  setStatus('診断中...');
  try {
    const result = await browser.runtime.sendMessage({ type: 'diagnose' });
    if (!result.ok) {
      setStatus(`診断エラー: ${result.error}`, 'error');
    }
    await loadState();
  } finally {
    setBusy(false);
  }
}

saveTokenEl.addEventListener('click', () => saveToken().catch((error) => setStatus(error.message || String(error), 'error')));
diagnoseEl.addEventListener('click', () => diagnose().catch((error) => setStatus(error.message || String(error), 'error')));

loadState().catch((error) => setStatus(error.message || String(error), 'error'));

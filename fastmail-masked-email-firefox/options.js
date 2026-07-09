'use strict';

const $ = (selector) => document.querySelector(selector);

const tokenEl = $('#token');
const statusEl = $('#status');
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

async function loadState() {
  const state = await browser.runtime.sendMessage({ type: 'getPopupState' });

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

loadState().catch((error) => setStatus(error.message || String(error), 'error'));

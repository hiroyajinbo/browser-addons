(function () {
  "use strict";

  const startButton = document.querySelector("#startButton");
  const exportButton = document.querySelector("#exportButton");
  const status = document.querySelector("#status");
  const delayInput = document.querySelector("input[name='delaySeconds']");
  const maxClicksInput = document.querySelector("input[name='maxClicks']");

  function getRuntime() {
    return typeof browser !== "undefined" ? browser : chrome;
  }

  function setBusy(isBusy) {
    startButton.disabled = isBusy;
    exportButton.disabled = isBusy;
  }

  function getOptions() {
    return {
      delayMs: Math.max(1000, Number(delayInput.value || 5) * 1000),
      maxClicks: Math.max(1, Number(maxClicksInput.value || 300))
    };
  }

  async function sendMessage(message) {
    const runtime = getRuntime();
    const tabs = await runtime.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];

    if (!tab || !tab.id) {
      throw new Error("対象タブを取得できませんでした");
    }

    return runtime.tabs.sendMessage(tab.id, message);
  }

  async function run(type) {
    setBusy(true);
    status.textContent = "ページへ指示を送信しています...";

    try {
      const response = await sendMessage({
        type,
        options: getOptions()
      });
      status.textContent = response && response.message ? response.message : "開始しました";
    } catch (error) {
      status.textContent = "楽天Koboセールページで実行してください";
    } finally {
      setBusy(false);
    }
  }

  startButton.addEventListener("click", () => run("RKSE_START_EXPAND_AND_EXPORT"));
  exportButton.addEventListener("click", () => run("RKSE_EXPORT_VISIBLE"));
})();

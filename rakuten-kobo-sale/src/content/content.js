(function () {
  "use strict";

  const MORE_BUTTON_SELECTORS = [
    "a.listtemp-js-nextread",
    ".EbkKobo_blnextlist a",
    "a[href='notanc']"
  ];
  const TITLE_SELECTOR = ".EbkKobo_bookttl a";
  const DEFAULT_OPTIONS = {
    delayMs: 5000,
    maxClicks: 300
  };

  let isRunning = false;
  let panel = null;

  function getRuntime() {
    return typeof browser !== "undefined" ? browser : chrome;
  }

  function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function isVisible(element) {
    if (!element || !element.isConnected) {
      return false;
    }

    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0" &&
      rect.width > 0 &&
      rect.height > 0;
  }

  function findMoreButton() {
    const candidates = MORE_BUTTON_SELECTORS.flatMap((selector) => {
      return Array.from(document.querySelectorAll(selector));
    });

    return candidates.find((button) => {
      const text = normalizeText(button.textContent);
      const ariaDisabled = button.getAttribute("aria-disabled") === "true";
      return isVisible(button) &&
        !button.disabled &&
        !ariaDisabled &&
        text.includes("もっと見る");
    }) || null;
  }

  function getItemKey(url, title, price) {
    try {
      const parsed = new URL(url, location.href);
      const match = parsed.pathname.match(/\/rk\/[^/]+/);
      return match ? match[0] : parsed.origin + parsed.pathname;
    } catch (error) {
      return `${title}|${price}|${url}`;
    }
  }

  function cleanProductUrl(url) {
    const parsed = new URL(url, location.href);
    return parsed.origin + parsed.pathname;
  }

  function extractPrice(root) {
    const salePrice = root.querySelector(".priceSale");
    const fallbackPrice = root.querySelector(".EbkKobo_bookbprc");
    return normalizeText((salePrice || fallbackPrice || {}).textContent || "");
  }

  function extractItems() {
    const rows = [];
    const seen = new Set();

    document.querySelectorAll(TITLE_SELECTOR).forEach((titleLink) => {
      const title = normalizeText(titleLink.textContent);
      if (!title) {
        return;
      }

      const card = titleLink.closest("li, .liCpy, .liOri, .upperBox") || titleLink.parentElement;
      const url = cleanProductUrl(titleLink.href);
      const price = extractPrice(card);
      const key = getItemKey(url, title, price);

      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      rows.push({ title, price, url });
    });

    return rows;
  }

  function escapeCsv(value) {
    const text = String(value || "");
    if (/[",\r\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }

  function buildCsv(rows) {
    const header = ["書籍タイトル", "価格", "商品URL"];
    const lines = [header, ...rows.map((row) => [row.title, row.price, row.url])];
    return "\uFEFF" + lines.map((line) => line.map(escapeCsv).join(",")).join("\r\n");
  }

  function getTimestamp() {
    const date = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate()),
      "-",
      pad(date.getHours()),
      pad(date.getMinutes()),
      pad(date.getSeconds())
    ].join("");
  }

  function downloadCsv(rows) {
    const csv = buildCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `rakuten-kobo-sale-${getTimestamp()}.csv`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function showPanel(message, progress) {
    if (!panel) {
      panel = document.createElement("div");
      panel.className = "rkse-panel";
      panel.innerHTML = "<strong>Kobo Sale Exporter</strong><p></p><progress></progress>";
      document.documentElement.append(panel);
    }

    panel.querySelector("p").textContent = message;
    const progressElement = panel.querySelector("progress");

    if (typeof progress === "number") {
      progressElement.removeAttribute("max");
      progressElement.value = progress;
    } else {
      progressElement.removeAttribute("value");
    }
  }

  function hidePanelSoon() {
    window.setTimeout(() => {
      if (panel) {
        panel.remove();
        panel = null;
      }
    }, 6000);
  }

  async function clickMoreUntilDone(options) {
    const settings = Object.assign({}, DEFAULT_OPTIONS, options || {});
    let clicks = 0;

    while (clicks < settings.maxClicks) {
      const button = findMoreButton();
      const itemCount = extractItems().length;

      if (!button) {
        return { clicks, itemCount, stoppedByLimit: false };
      }

      clicks += 1;
      showPanel(`もっと見るをクリック中: ${clicks} 回目 / 現在 ${itemCount} 件`, clicks);
      button.scrollIntoView({ block: "center", behavior: "smooth" });
      await sleep(300);
      button.click();
      await sleep(settings.delayMs);
    }

    return {
      clicks,
      itemCount: extractItems().length,
      stoppedByLimit: true
    };
  }

  async function startExpandAndExport(options) {
    if (isRunning) {
      return { message: "すでに実行中です" };
    }

    isRunning = true;

    try {
      showPanel("処理を開始しました。ページをそのまま開いておいてください。");
      const result = await clickMoreUntilDone(options);
      const rows = extractItems();

      if (!rows.length) {
        showPanel("書籍情報が見つかりませんでした。");
        hidePanelSoon();
        return { message: "書籍情報が見つかりませんでした" };
      }

      downloadCsv(rows);
      const suffix = result.stoppedByLimit ? " 最大クリック回数に達しました。" : "";
      showPanel(`CSVを保存しました: ${rows.length} 件 / クリック ${result.clicks} 回.${suffix}`);
      hidePanelSoon();
      return { message: `CSV保存を開始しました: ${rows.length} 件` };
    } finally {
      isRunning = false;
    }
  }

  function exportVisible() {
    const rows = extractItems();

    if (!rows.length) {
      showPanel("書籍情報が見つかりませんでした。");
      hidePanelSoon();
      return { message: "書籍情報が見つかりませんでした" };
    }

    downloadCsv(rows);
    showPanel(`現在表示分のCSVを保存しました: ${rows.length} 件`);
    hidePanelSoon();
    return { message: `CSV保存を開始しました: ${rows.length} 件` };
  }

  getRuntime().runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.type) {
      return false;
    }

    if (message.type === "RKSE_EXPORT_VISIBLE") {
      sendResponse(exportVisible());
      return false;
    }

    if (message.type === "RKSE_START_EXPAND_AND_EXPORT") {
      if (isRunning) {
        sendResponse({ message: "すでに実行中です" });
        return false;
      }

      startExpandAndExport(message.options).catch((error) => {
        console.error("[Kobo Sale Exporter]", error);
        isRunning = false;
        showPanel("処理中にエラーが発生しました。ページを再読み込みして再実行してください。");
        hidePanelSoon();
      });
      sendResponse({ message: "開始しました。ページ右下に進捗を表示します。" });
      return false;
    }

    return false;
  });
})();

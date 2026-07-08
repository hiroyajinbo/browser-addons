(function () {
  "use strict";

  const root = typeof globalThis !== "undefined" ? globalThis : window;

  root.RTC_DEFAULT_SETTINGS = Object.freeze({
    pointGridEnabled: true,
    shortcutBarEnabled: true,
    couponPanelEnabled: true,
    openShortcutsInNewTab: false
  });

  root.RTC_SHORTCUTS = Object.freeze([
    { label: "楽天ブックス", url: "https://books.rakuten.co.jp/" },
    { label: "楽天Kobo", url: "https://books.rakuten.co.jp/e-book/" },
    { label: "楽天24", url: "https://www.rakuten24.co.jp/" },
    { label: "楽天ビック", url: "https://biccamera.rakuten.co.jp/" },
    { label: "Rakuten Fashion", url: "https://brandavenue.rakuten.co.jp/" },
    { label: "スーパーDEAL", url: "https://event.rakuten.co.jp/superdeal/" },
    { label: "購入履歴", url: "https://order.my.rakuten.co.jp/" },
    { label: "お気に入り", url: "https://my.bookmark.rakuten.co.jp/" }
  ]);

  root.RTC_STORAGE_KEYS = Object.freeze(Object.keys(root.RTC_DEFAULT_SETTINGS));
})();

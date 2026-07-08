(function () {
  "use strict";

  if (window.top !== window || location.hostname !== "www.rakuten.co.jp" || location.pathname !== "/") {
    return;
  }

  const state = {
    settings: { ...RTC_DEFAULT_SETTINGS },
    observer: null,
    isApplying: false,
    applyTimer: 0
  };

  const SELECTORS = {
    headerAnchors: [
      "#wrapper",
      "div[data-global-banner]",
      ".globalBannerWrapper",
      "#header-group",
      "form[action*='search.rakuten.co.jp']",
      "input[name='sitem']",
      "input[type='search']",
      "[class*='search']"
    ],
    pointContainers: [
      ".r-slideshow-page",
      "[class*='slideshow']",
      "[class*='point'][class*='up']",
      "[aria-label*='ポイント']",
      "section:has(a[href*='campaign'])"
    ],
    couponContainers: [
      "#smart-coupon",
      "#smart-coupon .smart-coupon-slideshow-body",
      "#smart-coupon .smart-coupon-slideshow-item"
    ]
  };

  function scheduleApply() {
    if (state.applyTimer) {
      clearTimeout(state.applyTimer);
    }

    state.applyTimer = setTimeout(() => {
      applyFeatures();
    }, 250);
  }

  function applyFeatures() {
    if (state.isApplying || !document.body) {
      return;
    }

    state.isApplying = true;

    try {
      toggleShortcutBar();
      togglePointGrid();
      toggleCouponPanel();
    } finally {
      state.isApplying = false;
    }
  }

  function isElementVisible(element) {
    if (!element || element.closest(".rtc-shortcut-bar, .rtc-coupon-panel")) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width > 20 && rect.height > 20;
  }

  function findFirstVisible(selectors) {
    for (const selector of selectors) {
      try {
        const candidates = Array.from(document.querySelectorAll(selector));
        const match = candidates.find(isElementVisible);

        if (match) {
          return match;
        }
      } catch (error) {
        debug("selector skipped", selector, error);
      }
    }

    return null;
  }

  function findHeaderTarget() {
    const wrapper = document.querySelector("#wrapper");

    if (wrapper) {
      return {
        element: wrapper,
        position: "afterbegin"
      };
    }

    const anchor = findFirstVisible(SELECTORS.headerAnchors);

    if (!anchor) {
      return {
        element: document.body.firstElementChild || document.body,
        position: "afterend"
      };
    }

    return {
      element: anchor.closest("header, [class*='Header']") || anchor,
      position: "afterend"
    };
  }

  function toggleShortcutBar() {
    const existing = document.querySelector(".rtc-shortcut-bar");

    if (!state.settings.shortcutBarEnabled) {
      existing?.remove();
      return;
    }

    const bar = existing || buildShortcutBar();
    updateShortcutTargets(bar);

    if (!existing) {
      const target = findHeaderTarget();
      target.element.insertAdjacentElement(target.position, bar);
    }
  }

  function buildShortcutBar() {
    const bar = document.createElement("nav");
    bar.className = "rtc-shortcut-bar";
    bar.setAttribute("aria-label", "Rakuten Top Cleaner shortcuts");

    RTC_SHORTCUTS.forEach((shortcut) => {
      const link = document.createElement("a");
      link.className = "rtc-shortcut-link";
      link.href = shortcut.url;
      link.textContent = shortcut.label;
      link.dataset.rtcShortcut = "true";
      bar.append(link);
    });

    return bar;
  }

  function updateShortcutTargets(scope = document) {
    const target = state.settings.openShortcutsInNewTab ? "_blank" : "_self";
    const rel = state.settings.openShortcutsInNewTab ? "noopener noreferrer" : "";

    scope.querySelectorAll(".rtc-shortcut-link").forEach((link) => {
      link.target = target;
      link.rel = rel;
    });
  }

  function togglePointGrid() {
    const containers = getPointContainers();

    document.querySelectorAll(".rtc-campaign-grid").forEach((element) => {
      if (!containers.includes(element)) {
        element.classList.remove("rtc-campaign-grid");
      }
    });

    if (!state.settings.pointGridEnabled) {
      containers.forEach((container) => {
        container.classList.remove("rtc-campaign-grid");
        container.removeAttribute("data-rtc-point-grid");
      });
      return;
    }

    containers.forEach((container) => {
      container.classList.add("rtc-campaign-grid");
      container.dataset.rtcPointGrid = "true";
    });
  }

  function getPointContainers() {
    const containers = new Set();

    SELECTORS.pointContainers.forEach((selector) => {
      try {
        document.querySelectorAll(selector).forEach((candidate) => {
          const container = normalizePointContainer(candidate);

          if (container && isLikelyPointArea(container)) {
            containers.add(container);
          }
        });
      } catch (error) {
        debug("point selector skipped", selector, error);
      }
    });

    return Array.from(containers).slice(0, 4);
  }

  function normalizePointContainer(candidate) {
    if (candidate.classList?.contains("r-slideshow-page")) {
      return candidate;
    }

    return candidate.closest(".r-slideshow-page, section, [class*='slideshow'], [class*='carousel']") || candidate;
  }

  function isLikelyPointArea(element) {
    if (!isElementVisible(element)) {
      return false;
    }

    const text = element.textContent || "";
    const linkCount = element.querySelectorAll("a").length;
    const hasPointCue = /ポイント|倍|SPU|キャンペーン|エントリー/.test(text);

    return hasPointCue && linkCount >= 2;
  }

  function toggleCouponPanel() {
    const existing = document.querySelector(".rtc-coupon-panel");

    if (!state.settings.couponPanelEnabled) {
      existing?.remove();
      return;
    }

    const coupons = getCouponItems();

    if (coupons.length === 0) {
      existing?.remove();
      return;
    }

    const panel = existing || document.createElement("section");
    panel.className = "rtc-coupon-panel";
    panel.setAttribute("aria-label", "表示中のクーポン");
    panel.replaceChildren(buildPanelTitle("クーポン"), buildCouponGrid(coupons));

    if (!existing) {
      const shortcutBar = document.querySelector(".rtc-shortcut-bar");
      if (shortcutBar) {
        shortcutBar.insertAdjacentElement("afterend", panel);
      } else {
        const target = findHeaderTarget();
        target.element.insertAdjacentElement(target.position, panel);
      }
    }
  }

  function buildPanelTitle(text) {
    const title = document.createElement("h2");
    title.className = "rtc-panel-title";
    title.textContent = text;
    return title;
  }

  function buildCouponGrid(coupons) {
    const grid = document.createElement("div");
    grid.className = "rtc-coupon-grid";

    coupons.forEach((coupon) => {
      grid.append(buildCouponCard(coupon));
    });

    return grid;
  }

  function buildCouponCard(coupon) {
    const link = document.createElement("a");
    link.className = "rtc-coupon-card";
    link.href = coupon.href;

    if (coupon.imageUrl) {
      const image = document.createElement("img");
      image.className = "rtc-coupon-image";
      image.src = coupon.imageUrl;
      image.alt = "";
      image.loading = "lazy";
      link.append(image);
    }

    const body = document.createElement("span");
    body.className = "rtc-coupon-body";

    const title = document.createElement("span");
    title.className = "rtc-coupon-title";
    title.textContent = coupon.title;
    body.append(title);

    if (coupon.detail) {
      const detail = document.createElement("span");
      detail.className = "rtc-coupon-detail";
      detail.textContent = coupon.detail;
      body.append(detail);
    }

    const action = document.createElement("span");
    action.className = "rtc-coupon-action";
    action.textContent = "表示中のクーポンを見る";
    body.append(action);

    link.append(body);
    return link;
  }

  function getCouponItems() {
    const items = [];
    const seen = new Set();

    SELECTORS.couponContainers.forEach((selector) => {
      try {
        document.querySelectorAll(selector).forEach((candidate) => {
          extractCouponItems(candidate).forEach((coupon) => {
            if (!seen.has(coupon.href)) {
              seen.add(coupon.href);
              items.push(coupon);
            }
          });
        });
      } catch (error) {
        debug("coupon selector skipped", selector, error);
      }
    });

    return items.slice(0, 6);
  }

  function extractCouponItems(scope) {
    if (!scope || scope.closest(".rtc-coupon-panel")) {
      return [];
    }

    const links = scope.matches("a") ? [scope] : Array.from(scope.querySelectorAll("a[href]"));

    return links
      .map((link) => buildCouponItem(link))
      .filter(Boolean);
  }

  function buildCouponItem(link) {
    const href = link.href;

    if (!href || href === location.href || href.endsWith("#")) {
      return null;
    }

    const card = link.closest(".smart-coupon-slideshow-item, li, article, div") || link;
    const text = compactText(card.textContent || link.textContent || "");
    const hasCouponCue = /クーポン|coupon|OFF|割引|円引|%/i.test(text);
    const isSmartCoupon = Boolean(link.closest("#smart-coupon"));

    if (!isSmartCoupon || !hasCouponCue || !isElementVisible(card)) {
      return null;
    }

    const image = card.querySelector("img");
    const title =
      compactText(card.querySelector(".smart-coupon-item-name")?.textContent || link.getAttribute("aria-label") || text) ||
      "クーポン";
    const detail = compactText(
      [
        card.querySelector(".smart-coupon-item-price-line1")?.textContent,
        card.querySelector(".smart-coupon-item-price-line2")?.textContent
      ]
        .filter(Boolean)
        .join(" ")
    );

    return {
      href,
      imageUrl: image?.currentSrc || image?.src || "",
      title: truncateText(title, 48),
      detail: truncateText(detail, 36)
    };
  }

  function compactText(text) {
    return text.replace(/\s+/g, " ").trim();
  }

  function truncateText(text, maxLength) {
    if (text.length <= maxLength) {
      return text;
    }

    return `${text.slice(0, maxLength - 1)}…`;
  }

  function startObserver() {
    state.observer?.disconnect();

    state.observer = new MutationObserver((mutations) => {
      const shouldApply = mutations.some((mutation) => {
        return Array.from(mutation.addedNodes).some((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) {
            return false;
          }

          return !node.closest?.(".rtc-shortcut-bar, .rtc-coupon-panel");
        });
      });

      if (shouldApply) {
        scheduleApply();
      }
    });

    state.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function debug(...args) {
    if (localStorage.getItem("rtcDebug") === "1") {
      console.debug("[Rakuten Top Cleaner]", ...args);
    }
  }

  RTCStorage.readSettings().then((settings) => {
    state.settings = settings;
    applyFeatures();
    startObserver();
  });

  RTCStorage.onSettingsChanged((changedSettings) => {
    state.settings = { ...state.settings, ...changedSettings };
    applyFeatures();
  });
})();

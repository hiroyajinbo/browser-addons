(function () {
  "use strict";

  const root = typeof globalThis !== "undefined" ? globalThis : window;
  const extensionApi = typeof browser !== "undefined" ? browser : chrome;

  function readSettings() {
    return extensionApi.storage.local
      .get(root.RTC_DEFAULT_SETTINGS)
      .then((stored) => ({ ...root.RTC_DEFAULT_SETTINGS, ...stored }));
  }

  function writeSettings(nextSettings) {
    const allowed = {};

    root.RTC_STORAGE_KEYS.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(nextSettings, key)) {
        allowed[key] = Boolean(nextSettings[key]);
      }
    });

    return extensionApi.storage.local.set(allowed);
  }

  function onSettingsChanged(callback) {
    extensionApi.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") {
        return;
      }

      const changedSettings = {};

      root.RTC_STORAGE_KEYS.forEach((key) => {
        if (changes[key]) {
          changedSettings[key] = Boolean(changes[key].newValue);
        }
      });

      if (Object.keys(changedSettings).length > 0) {
        callback(changedSettings);
      }
    });
  }

  root.RTCStorage = Object.freeze({
    readSettings,
    writeSettings,
    onSettingsChanged
  });
})();

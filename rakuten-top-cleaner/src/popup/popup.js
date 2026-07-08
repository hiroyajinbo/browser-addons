(function () {
  "use strict";

  const formControls = Array.from(document.querySelectorAll("input[type='checkbox']"));
  const status = document.querySelector(".rtc-status");

  function showStatus(message) {
    status.textContent = message;

    window.clearTimeout(showStatus.timer);
    showStatus.timer = window.setTimeout(() => {
      status.textContent = "";
    }, 1800);
  }

  function collectSettings() {
    return formControls.reduce((settings, control) => {
      settings[control.name] = control.checked;
      return settings;
    }, {});
  }

  function renderSettings(settings) {
    formControls.forEach((control) => {
      control.checked = Boolean(settings[control.name]);
    });
  }

  RTCStorage.readSettings().then(renderSettings);

  formControls.forEach((control) => {
    control.addEventListener("change", () => {
      RTCStorage.writeSettings(collectSettings()).then(() => {
        showStatus("保存しました");
      });
    });
  });
})();

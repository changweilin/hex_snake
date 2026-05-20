const HexSnakeAbout = (() => {
  function yesNo(value) {
    return value ? "是" : "否";
  }

  function standaloneMode() {
    return Boolean(
      window.matchMedia?.("(display-mode: standalone)")?.matches
      || window.navigator.standalone
    );
  }

  function serviceWorkerState() {
    if (!("serviceWorker" in navigator)) return "不支援";
    if (navigator.serviceWorker.controller) return "已控制";
    return "未控制";
  }

  function addRow(label, value, id = "") {
    const row = document.createElement("div");
    row.className = "app-version-row";
    const labelEl = document.createElement("span");
    labelEl.textContent = label;
    const valueEl = document.createElement("strong");
    if (id) valueEl.id = id;
    valueEl.textContent = String(value ?? "");
    row.append(labelEl, valueEl);
    versionInfoList.append(row);
  }

  function renderVersionInfo() {
    const info = HexSnakePlatform.appInfo;
    versionInfoList.innerHTML = "";
    addRow("名稱", info.name, "versionAppName");
    addRow("版本", info.version, "versionAppVersion");
    addRow("Build", info.buildVersion, "versionBuildVersion");
    addRow("平台", info.platform, "versionPlatform");
    addRow("儲存", info.storageKind, "versionStorageKind");
    addRow("圖片", info.imageFormat.toUpperCase(), "versionImageFormat");
    addRow("音效", info.audioFormat.toUpperCase(), "versionAudioFormat");
    addRow("PWA", yesNo(standaloneMode()), "versionStandalone");
    addRow("Service Worker", serviceWorkerState(), "versionServiceWorker");
    addRow("網路", navigator.onLine ? "線上" : "離線", "versionNetwork");
  }

  function openModal() {
    renderVersionInfo();
    versionModal.hidden = false;
  }

  function closeModal() {
    versionModal.hidden = true;
  }

  return Object.freeze({
    openModal,
    closeModal,
    refresh: renderVersionInfo
  });
})();

window.HexSnakeAbout = HexSnakeAbout;

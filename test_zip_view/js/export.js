/* export.js */
function downloadCsv(content, filename) {
  const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
  const blob = new Blob([bom, content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
function backupAllData() {
  const data = { appState, version: '1.4.0', timestamp: new Date().toISOString() };
  downloadJson(data, '\uC218\uB9C8\uD2B8\uD559\uAE09_\uC804\uCCB4\uBC31\uC5C5_' + todayStr() + '.json');
  showToast('\uC804\uCCB4 \uB370\uC774\uD130 \uBC31\uC5C5 \uD30C\uC77C\uC774 \uC11D\uC131\uB418\uC5C8\uC2B5\uB2C8\uB2E4.');
}
function restoreFromJson(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.appState) {
        appState = data.appState;
        saveState();
        alert('\uB370\uC774\uD130 \uBC15\uAD6C\uAC00 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uD300\uC774\uC9C0\uB97C \uC0C8\uB85C\uACE0\uCE68\uD569\uB2C8\uB2E4.');
        location.reload();
      }
    } catch (err) { alert('\uBC15\uAD6C \uC911 \uC624\uB958 \uBC1C\uC0DD: ' + err.message); }
  };
  reader.readAsText(file);
}
window.backupAllData = backupAllData;
window.restoreFromJson = restoreFromJson;
window.downloadCsv = downloadCsv;
window.downloadJson = downloadJson;
window.renderStats = () => {};
window.openReportConfigModal = () => {};
window.openPhraseManageModal = () => {};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnBackupData')?.addEventListener('click', backupAllData);
  document.getElementById('btnBackup')?.addEventListener('click', backupAllData);
  document.getElementById('restoreInput')?.addEventListener('change', (e) => restoreFromJson(e.target));
});

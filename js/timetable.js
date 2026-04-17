/* timetable.js - 주간 시간표 완전 복원 */

const DAYS = ['\uC6D4', '\uD654', '\uC218', '\uBAA9', '\uAE08'];

function initTimetableTab() {
  loadTimetableUI();
}

function loadTimetableUI() {
  renderTermSettings();
  renderBaseTimtable();
  renderHolidayList();
}

function renderTermSettings() {
  const s = window.appState.termSettings || {};
  const stEl = document.getElementById('termStart');
  const enEl = document.getElementById('termEnd');
  const stEl2 = document.getElementById('schoolTypeSelect');
  const mnEl = document.getElementById('morningNotifyTime');
  const mnEnEl = document.getElementById('morningNotifyEnabled');
  if (stEl) stEl.value = s.startDate || '';
  if (enEl) enEl.value = s.endDate || '';
  if (stEl2) stEl2.value = s.schoolType || 'secondary';
  if (mnEl) mnEl.value = s.morningNotifyTime || '08:30';
  if (mnEnEl) mnEnEl.checked = s.morningNotifyEnabled !== false;
  renderTimeConfig();
  renderTargetHoursSection();
}

function renderTimeConfig() {
  const container = document.getElementById('timeConfigContainer');
  if (!container) return;
  const cfg = window.appState.timeConfig || [];
  container.innerHTML = '';
  cfg.forEach((t, i) => {
    const row = document.createElement('div');
    row.className = 'time-config-row';
    row.innerHTML = '<span>' + (i + 1) + '\uAD50\uC2DC</span>'
      + '<input type="time" value="' + t.start + '" onchange="updateTimeConfig(' + i + ',\'start\',this.value)">'
      + '<span>~</span>'
      + '<input type="time" value="' + t.end + '" onchange="updateTimeConfig(' + i + ',\'end\',this.value)">';
    container.appendChild(row);
  });
}

function updateTimeConfig(idx, field, val) {
  if (!window.appState.timeConfig[idx]) return;
  window.appState.timeConfig[idx][field] = val;
  saveState();
}

function renderTargetHoursSection() {
  const container = document.getElementById('targetHoursContainer');
  if (!container) return;
  const classes = window.appState.classes || [];
  if (classes.length === 0) {
    container.innerHTML = '<p class="help-text">\uBC18\uC744 \uBA3C\uC800 \uCD94\uAC00\uD558\uC138\uC694.</p>';
    return;
  }
  container.innerHTML = '';
  classes.forEach(cls => {
    const target = (window.appState.termSettings.targetHours || {})[cls.id] || 0;
    const row = document.createElement('div');
    row.className = 'target-hours-row';
    row.innerHTML = '<span>' + cls.name + '</span><input type="number" min="0" value="' + target + '" onchange="setTargetHours(\'' + cls.id + '\', this.value)"> \uC2DC\uAC04';
    container.appendChild(row);
  });
}

function setTargetHours(classId, val) {
  if (!window.appState.termSettings.targetHours) window.appState.termSettings.targetHours = {};
  window.appState.termSettings.targetHours[classId] = parseInt(val) || 0;
  saveState();
}

function saveTermSettings() {
  const s = window.appState.termSettings;
  const stEl = document.getElementById('termStart');
  const enEl = document.getElementById('termEnd');
  const stEl2 = document.getElementById('schoolTypeSelect');
  const mnEl = document.getElementById('morningNotifyTime');
  const mnEnEl = document.getElementById('morningNotifyEnabled');
  if (stEl) s.startDate = stEl.value;
  if (enEl) s.endDate = enEl.value;
  if (stEl2) s.schoolType = stEl2.value;
  if (mnEl) s.morningNotifyTime = mnEl.value;
  if (mnEnEl) s.morningNotifyEnabled = mnEnEl.checked;
  saveState();
  if (typeof showToast === 'function') showToast('\uC124\uC815\uC774 \uC800\uC7A5\uB418\uC5C8\uC2B5\uB2C8\uB2E4.');
}

function applyBulkTargetHours() {
  const gradeEl = document.getElementById('bulkGradeSelect');
  const hoursEl = document.getElementById('bulkHoursInput');
  if (!gradeEl || !hoursEl) return;
  const grade = gradeEl.value;
  const hours = parseInt(hoursEl.value) || 0;
  if (!window.appState.termSettings.targetHours) window.appState.termSettings.targetHours = {};
  window.appState.classes.filter(c => c.grade === grade || !grade).forEach(c => {
    window.appState.termSettings.targetHours[c.id] = hours;
  });
  saveState();
  renderTargetHoursSection();
  if (typeof showToast === 'function') showToast('\uC77C\uAD04 \uC801\uC6A9\uB418\uC5C8\uC2B5\uB2C8\uB2E4.');
}

function renderBaseTimtable() {
  const container = document.getElementById('baseTimetableGrid');
  if (!container) return;
  const schoolType = (window.appState.termSettings || {}).schoolType || 'secondary';
  const periods = schoolType === 'elementary' ? 6 : 8;
  const timetable = window.appState.timetable || {};
  let html = '<table class="timetable-table"><thead><tr><th>\uAD50\uC2DC</th>';
  DAYS.forEach(d => { html += '<th>' + d + '</th>'; });
  html += '</tr></thead><tbody>';
  for (let p = 1; p <= periods; p++) {
    html += '<tr><td class="period-label">' + p + '\uAD50\uC2DC</td>';
    DAYS.forEach((d, di) => {
      const key = di + '-' + p;
      const classId = timetable[key] || '';
      const cls = window.appState.classes.find(c => c.id === classId);
      html += '<td class="timetable-cell" onclick="openTimetableCell(\'' + key + '\')">'
        + (cls ? cls.name : '<span class="empty-cell">-</span>')
        + '</td>';
    });
    html += '</tr>';
  }
  html += '</tbody></table>';
  container.innerHTML = html;
}

function openTimetableCell(key) {
  const classes = window.appState.classes || [];
  const current = window.appState.timetable[key] || '';
  const opts = classes.map(c => '<option value="' + c.id + '"' + (c.id === current ? ' selected' : '') + '>' + c.name + '</option>').join('');
  const modal = document.getElementById('classSelectModal');
  if (modal) {
    document.getElementById('classSelectKey').value = key;
    const sel = document.getElementById('classSelectDropdown');
    if (sel) sel.innerHTML = '<option value="">\uC120\uD0DD \uC548\uD568</option>' + opts;
    modal.classList.remove('hidden');
  }
}

function confirmClassSelect() {
  const key = document.getElementById('classSelectKey')?.value;
  const classId = document.getElementById('classSelectDropdown')?.value || '';
  if (key !== undefined) {
    if (classId) window.appState.timetable[key] = classId;
    else delete window.appState.timetable[key];
    saveState();
    renderBaseTimtable();
    renderWeeklyTimetable();
  }
  document.getElementById('classSelectModal')?.classList.add('hidden');
}

function renderWeeklyTimetable() {
  const container = document.getElementById('weeklyTimetableContainer');
  if (!container) return;
  const today = new Date();
  const weekKey = getWeekKeyFull(today);
  const weekly = (window.appState.weeklyTimetable || {})[weekKey] || window.appState.timetable || {};
  const schoolType = (window.appState.termSettings || {}).schoolType || 'secondary';
  const periods = schoolType === 'elementary' ? 6 : 8;
  let html = '<table class="timetable-table weekly"><thead><tr><th>\uAD50\uC2DC</th>';
  DAYS.forEach(d => { html += '<th>' + d + '</th>'; });
  html += '</tr></thead><tbody>';
  for (let p = 1; p <= periods; p++) {
    html += '<tr><td class="period-label">' + p + '\uAD50\uC2DC</td>';
    DAYS.forEach((d, di) => {
      const key = di + '-' + p;
      const classId = weekly[key] || '';
      const cls = window.appState.classes.find(c => c.id === classId);
      html += '<td class="timetable-cell">' + (cls ? cls.name : '-') + '</td>';
    });
    html += '</tr>';
  }
  html += '</tbody></table>';
  container.innerHTML = html;
}

function goToCurrentClass() {
  const now = new Date();
  const dayIdx = now.getDay() - 1;
  if (dayIdx < 0 || dayIdx > 4) {
    if (typeof showToast === 'function') showToast('\uC624\uB298\uC740 \uC218\uC5C5\uC774 \uC5C6\uB294 \uB0A0\uC785\uB2C8\uB2E4.');
    return;
  }
  const cfg = window.appState.timeConfig || [];
  const nowStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
  let currentPeriod = -1;
  cfg.forEach((t, i) => {
    if (nowStr >= t.start && nowStr <= t.end) currentPeriod = i + 1;
  });
  if (currentPeriod === -1) {
    if (typeof showToast === 'function') showToast('\uC9C0\uAE08\uC740 \uC218\uC5C5 \uC2DC\uAC04\uC774 \uC544\uB2D9\uB2C8\uB2E4.');
    return;
  }
  const key = dayIdx + '-' + currentPeriod;
  const classId = (window.appState.timetable || {})[key];
  if (!classId) {
    if (typeof showToast === 'function') showToast('\uD604\uC7AC \uAD50\uC2DC\uC5D0 \uBC30\uC815\uB41C \uBC18\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.');
    return;
  }
  window.appState.currentClassId = classId;
  saveState();
  const sel = document.getElementById('classSelect');
  if (sel) sel.value = classId;
  if (typeof renderAll === 'function') renderAll();
  if (typeof showToast === 'function') showToast('\uD574\uB2F9 \uBC18\uC73C\uB85C \uC774\uB3D9\uD558\uC600\uC2B5\uB2C8\uB2E4.');
}

function renderHolidayList() {
  const container = document.getElementById('holidayList');
  if (!container) return;
  const holidays = window.appState.holidays || [];
  if (holidays.length === 0) {
    container.innerHTML = '<p class="help-text">\uB4F1\uB85D\uB41C \uD734\uC77C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
    return;
  }
  container.innerHTML = holidays.map((h, i) =>
    '<div class="holiday-item"><span>' + h.date + ' (' + h.name + ')</span><button onclick="removeHoliday(' + i + ')">\u2715</button></div>'
  ).join('');
}

function addHoliday() {
  const dateEl = document.getElementById('holidayDate');
  const nameEl = document.getElementById('holidayName');
  if (!dateEl || !nameEl) return;
  const date = dateEl.value;
  const name = nameEl.value.trim();
  if (!date || !name) {
    if (typeof showToast === 'function') showToast('\uB0A0\uC9DC\uC640 \uC774\uB984\uC744 \uC785\uB825\uD558\uC138\uC694.');
    return;
  }
  if (!window.appState.holidays) window.appState.holidays = [];
  window.appState.holidays.push({ date, name });
  window.appState.holidays.sort((a, b) => a.date.localeCompare(b.date));
  saveState();
  dateEl.value = '';
  nameEl.value = '';
  renderHolidayList();
}

function removeHoliday(idx) {
  window.appState.holidays.splice(idx, 1);
  saveState();
  renderHolidayList();
}

// window 전역 등록
window.initTimetableTab = initTimetableTab;
window.loadTimetableUI = loadTimetableUI;
window.saveTermSettings = saveTermSettings;
window.updateTimeConfig = updateTimeConfig;
window.setTargetHours = setTargetHours;
window.applyBulkTargetHours = applyBulkTargetHours;
window.renderBaseTimtable = renderBaseTimtable;
window.openTimetableCell = openTimetableCell;
window.confirmClassSelect = confirmClassSelect;
window.renderWeeklyTimetable = renderWeeklyTimetable;
window.goToCurrentClass = goToCurrentClass;
window.addHoliday = addHoliday;
window.removeHoliday = removeHoliday;
window.renderTargetHoursSection = renderTargetHoursSection;

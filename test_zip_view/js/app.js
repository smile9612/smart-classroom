/* ==========================================
   app.js - \uBA54\uC778 \uC124\uC815, \uACF5\uD1B5 \uC720\uD211\uB9AC\uD2F0, \uC0C1\uD0DC \uAD00\uB9AC
   ========================================== */

const BEHAVIOR_TYPES = {
  positive: [
    { label: "\uC218\uC5C5 \uD0DC\uB3C4", emoji: "\u2728", type: "positive" },
    { label: "\uBC1C\uD45C/\uD1A0\uB860", emoji: "\uD83C\uDFA4", type: "positive" },
    { label: "\uD611\uB825/\uBC30\uB824", emoji: "\uD83E\uDD1D", type: "positive" },
    { label: "\uAE30\uD0C0 \uC6B0\uC218", emoji: "\u2B50", type: "positive" }
  ],
  negative: [
    { label: "\uC9D1\uC911\uB825 \uBD80\uC811", emoji: "\uD83D\uDCA4", type: "negative" },
    { label: "\uAD50\uC6B0 \uAD00\uACC4 \uAC08\uB4F1", emoji: "\u26A0\uFE0F", type: "negative" },
    { label: "\uADDC\uCE59 \uBBF8\uC900\uC218", emoji: "\uD83D\uDEAB", type: "negative" }
  ],
  note: [
    { label: "\uC77C\uBC18 \uAE30\uB85D", emoji: "\uD83D\uDCDD", type: "note" }
  ]
};

const ATTENDANCE_STATUS = {
  present: { label: "\u110E\u116E\u11AF\u1109\u1162", color: "#10b981", icon: "\u2705" },
  absent: { label: "\u1100\u1162\u11AF\u1109\u1162", color: "#ef4444", icon: "\u274C" },
  late: { label: "\uC9C0\uAC01", color: "#f59e0b", icon: "\u23F0" },
  leave_early: { label: "\uC870\uD1F0", color: "#8b5cf6", icon: "\uD83D\uDEAA" },
  experience: { label: "\uCCB4\uD5D8\uD559\uC2B5", color: "#06b6d4", icon: "\uD83C\uDF12" },
  nurse: { label: "\uBC34\uAC74\uC2E4", color: "#ec4899", icon: "\uD83C\uDFE5" }
};

let appState = {
  classes: [],
  currentClassId: null,
  behaviors: [],
  attendance: [],
  timetable: {},
  weeklyTimetable: {},
  timeConfig: [
    { start: "09:00", end: "09:50" }, { start: "10:00", end: "10:50" },
    { start: "11:00", end: "11:50" }, { start: "12:00", end: "12:50" },
    { start: "13:50", end: "14:40" }, { start: "14:50", end: "15:40" },
    { start: "15:50", end: "16:40" }, { start: "16:50", end: "17:40" }
  ],
  termSettings: {
    startDate: "", endDate: "", schoolType: "secondary",
    targetHours: {}, morningNotifyTime: "08:30", morningNotifyEnabled: true,
    lastNotifiedDate: ""
  },
  holidays: [],
  theme: 'dark',
  formalPhrases: {}
};

let lastKnownDate = ""; 
let wakeLock = null; 

const generateId = () => Math.random().toString(36).substr(2, 9);
const todayStr = () => new Date().toISOString().split('T')[0];
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return y + '\uB144 ' + parseInt(m) + '\uC6D4 ' + parseInt(d) + '\uC77C';
};

function getWeekOfMonth(dateStr) {
  const date = new Date(dateStr);
  const day = date.getDate();
  const week = Math.ceil(day / 7);
  return (date.getMonth() + 1) + '\uC6D4 ' + week + '\uC9FC\uCC28';
}

function getWeekKeyFull(dateInput) {
  const d = new Date(dateInput);
  const day = d.getDay() || 7; 
  if (day !== 1) d.setHours(-24 * (day - 1));
  d.setHours(0,0,0,0);
  return d.toISOString().split('T')[0];
}

function saveState() {
  localStorage.setItem('smart_class_v2', JSON.stringify(appState));
}

function loadState() {
  const saved = localStorage.getItem('smart_class_v2');
  if (saved) {
    const parsed = JSON.parse(saved);
    appState = { ...appState, ...parsed };
    if (!appState.termSettings) appState.termSettings = { startDate: "", endDate: "", schoolType: "secondary", targetHours: {}, morningNotifyTime: "08:30", morningNotifyEnabled: true, lastNotifiedDate: "" };
    if (!appState.weeklyTimetable) appState.weeklyTimetable = {};
    if (!appState.formalPhrases || Object.keys(appState.formalPhrases).length === 0) {
       appState.formalPhrases = JSON.parse(JSON.stringify(window.DEFAULT_FORMAL_PHRASES || {}));
    }
  }
}

function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = 'toast show ' + type;
  setTimeout(() => { toast.className = 'toast hidden'; }, 3000);
}

function updateClassSelect() {
  const select = document.getElementById('classSelect');
  if (!select) return;
  select.innerHTML = '';
  appState.classes.sort((a,b) => a.name.localeCompare(b.name, 'ko')).forEach(cls => {
    const opt = document.createElement('option');
    opt.value = cls.id;
    opt.textContent = cls.name;
    if (cls.id === appState.currentClassId) opt.selected = true;
    select.appendChild(opt);
  });
}

function getCurrentClass() {
  return appState.classes.find(c => c.id === appState.currentClassId);
}

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      document.getElementById('btnWakeLock').style.color = 'var(--accent)';
      wakeLock.addEventListener('release', () => {
        document.getElementById('btnWakeLock').style.color = '';
      });
    }
  } catch (err) {}
}

function applyTheme() {
  document.documentElement.setAttribute('data-theme', appState.theme);
  const btn = document.getElementById('btnThemeToggle');
  if (btn) btn.innerHTML = appState.theme === 'dark' ? '\uD83C\uDF19' : '\u2600\uFE0F';
}

function toggleTheme() {
  appState.theme = appState.theme === 'dark' ? 'light' : 'dark';
  saveState();
  applyTheme();
}

function checkDateChange() {
  const currentStr = todayStr();
  if (lastKnownDate && lastKnownDate !== currentStr) {
    lastKnownDate = currentStr;
    location.reload();
  }
}

setInterval(checkDateChange, 60000); 

function initApp() {
  lastKnownDate = todayStr();
  loadState();

  const today = new Date();
  const dayLabels = ['\uC77C','\uC6D4','\uD654','\uC218','\uBAA9','\uAE08','\uD1A0'];
  const display = document.getElementById('todayDisplay');
  if (display) {
    display.textContent = today.getFullYear() + '\uB144 ' + (today.getMonth()+1) + '\uC6D4 ' + today.getDate() + '\uC77C (' + dayLabels[today.getDay()] + ')';
  }

  const attDate = document.getElementById('attendanceDate');
  if (attDate) attDate.value = todayStr();

  updateClassSelect();

  const classSel = document.getElementById('classSelect');
  if (classSel) {
    classSel.addEventListener('change', (e) => {
      appState.currentClassId = e.target.value;
      saveState();
      if (typeof renderSeating === 'function') renderSeating();
      if (typeof renderStudentSidebar === 'function') renderStudentSidebar();
    });
  }

  document.getElementById('btnAddClass')?.addEventListener('click', () => {
    document.getElementById('addClassModal').classList.remove('hidden');
    document.getElementById('inputClassName').focus();
  });

  document.getElementById('btnCloseAddClass')?.addEventListener('click', () => {
    document.getElementById('addClassModal').classList.add('hidden');
  });

  document.getElementById('btnConfirmAddClass')?.addEventListener('click', () => {
    const name = document.getElementById('inputClassName').value.trim();
    const r = parseInt(document.getElementById('inputClassRows').value) || 5;
    const c = parseInt(document.getElementById('inputClassCols').value) || 6;
    if (!name) return;

    const newCls = { id: generateId(), name, rows: r, cols: c, students: [], seats: {} };
    appState.classes.push(newCls);
    appState.currentClassId = newCls.id;
    saveState();
    updateClassSelect();
    if (typeof renderSeating === 'function') renderSeating();
    if (typeof renderStudentSidebar === 'function') renderStudentSidebar();
    document.getElementById('addClassModal').classList.add('hidden');
    document.getElementById('inputClassName').value = '';
    showToast(name + ' \uD559\uAE09\uC774 \u110E\u116E\u1100\u1161\u1103\u1161\u110B\u1165\u1109\u1173\u1107\u1161\u1102\u1165\u1103\u1161.', 'success');
  });

  document.getElementById('btnThemeToggle')?.addEventListener('click', toggleTheme);
  
  document.getElementById('btnWakeLock')?.addEventListener('click', () => {
    if (wakeLock === null) requestWakeLock();
    else { wakeLock.release().then(() => wakeLock = null); }
  });

  // \uD0ED \uB124\uBE44\uAC8C\uC774\uC158
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => activateTab(btn.dataset.tab));
  });

  applyTheme();
  if (typeof renderSeating === 'function') renderSeating();
  if (typeof renderStudentSidebar === 'function') renderStudentSidebar();
}

function activateTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-section').forEach(s => {
    s.classList.toggle('active', s.id === 'tab-' + tabId);
  });

  if (tabId === 'attendance' && typeof renderAttendance === 'function') renderAttendance();
  if (tabId === 'behavior' && typeof renderBehaviorTable === 'function') renderBehaviorTable();
  if (tabId === 'timetable' && typeof loadTimetableUI === 'function') loadTimetableUI();
  if (tabId === 'stats' && typeof renderStats === 'function') renderStats();
}

document.addEventListener('DOMContentLoaded', initApp);

window.BEHAVIOR_TYPES = BEHAVIOR_TYPES;
window.ATTENDANCE_STATUS = ATTENDANCE_STATUS;
window.appState = appState;
window.generateId = generateId;
window.todayStr = todayStr;
window.formatDate = formatDate;
window.saveState = saveState;
window.loadState = loadState;
window.showToast = showToast;
window.updateClassSelect = updateClassSelect;
window.getCurrentClass = getCurrentClass;

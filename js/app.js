/* ==========================================
   app.js - 앱 초기화 및 전역 상태 관리
   LocalStorage 기반 영구 데이터 저장
   ========================================== */

// ── 상수 정의 ──
const STORAGE_KEY = 'smartClassroom_v2';

// 미리 정의된 행동 유형
const BEHAVIOR_TYPES = {
  positive: [
    { id: 'p1', label: '수업태도 우수', emoji: '⭐' },
    { id: 'p2', label: '적극적 발표', emoji: '🙋' },
    { id: 'p3', label: '친구를 잘 도와줌', emoji: '🤝' },
    { id: 'p4', label: '과제 성실히 수행', emoji: '📚' },
    { id: 'p5', label: '창의적 아이디어', emoji: '💡' },
    { id: 'p6', label: '모둠 활동 협력', emoji: '👥' },
    { id: 'p7', label: '교우 관계 우수', emoji: '😊' },
    { id: 'p8', label: '자기주도 학습', emoji: '🎯' },
  ],
  negative: [
    { id: 'n1', label: '수업 중 엎드림', emoji: '😴' },
    { id: 'n2', label: '수업 중 떠들기', emoji: '🔊' },
    { id: 'n3', label: '스마트폰 사용', emoji: '📱' },
    { id: 'n4', label: '과제 미제출', emoji: '📋' },
    { id: 'n5', label: '친구와 다툼', emoji: '⚡' },
    { id: 'n6', label: '무단 이탈', emoji: '🚶' },
  ]
};

// 출결 상태 정의
const ATTENDANCE_STATUS = {
  present:       { label: '출석',    emoji: '✅', class: 'status-present' },
  absent:        { label: '결석',    emoji: '❌', class: 'status-absent' },
  late:          { label: '지각',    emoji: '⏰', class: 'status-late' },
  'leave-early': { label: '조퇴',    emoji: '🚪', class: 'status-leave-early' },
  experience:    { label: '체험학습', emoji: '🎒', class: 'status-experience' },
  nurse:         { label: '보건실',  emoji: '🏥', class: 'status-nurse' },
};

// ── 전역 앱 상태 ──
let appState = {
  classes: [],
  behaviors: [],
  attendance: [],
  currentClassId: null,
  isPresentationMode: false,
  isStudentView: false,
  isBulkMode: false,
  selectedStudentIds: [],
  timetable: {},
  timeConfig: [
    { start: "09:00", end: "09:40" }, { start: "09:50", end: "10:30" },
    { start: "10:40", end: "11:20" }, { start: "11:30", end: "12:10" },
    { start: "13:00", end: "13:40" }, { start: "13:50", end: "14:30" },
    { start: "14:40", end: "15:20" }, { start: "15:30", end: "16:10" }
  ],
  termSettings: {
    startDate: "",
    endDate: "",
    schoolType: "secondary",
    targetHours: {}
  },
  holidays: [],
  theme: 'dark'
};

let wakeLock = null;
let lastKnownDate = "";

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  } catch (e) {
    showToast('저장 공간이 부족합니다.', 'error');
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      appState = { ...appState, ...parsed };
    }
  } catch (e) {
    console.error('상태 불러오기 실패:', e);
  }
}

function getCurrentClass() {
  return appState.classes.find(c => c.id === appState.currentClassId) || null;
}

function getStudents(classId) {
  const cls = appState.classes.find(c => c.id === classId);
  return cls ? cls.students : [];
}

function showToast(message, type = 'default', duration = 2500) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => toast.classList.add('hidden'), duration);
}

function createClass(name, rows = 5, cols = 6) {
  const cls = {
    id: generateId(),
    name,
    gridRows: rows,
    gridCols: cols,
    students: [],
    seats: {},
  };
  appState.classes.push(cls);
  appState.classes.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  appState.currentClassId = cls.id;
  saveState();
  return cls;
}

function deleteClass(classId) {
  appState.classes = appState.classes.filter(c => c.id !== classId);
  appState.behaviors = appState.behaviors.filter(b => b.classId !== classId);
  appState.attendance = appState.attendance.filter(a => a.classId !== classId);
  if (appState.currentClassId === classId) {
    appState.currentClassId = appState.classes[0]?.id || null;
  }
  saveState();
}

function updateClassSelect() {
  const sel = document.getElementById('classSelect');
  sel.innerHTML = '';
  if (appState.classes.length === 0) {
    const opt = document.createElement('option');
    opt.textContent = '학급 없음';
    sel.appendChild(opt);
    return;
  }
  appState.classes.forEach(cls => {
    const opt = document.createElement('option');
    opt.value = cls.id;
    opt.textContent = cls.name;
    if (cls.id === appState.currentClassId) opt.selected = true;
    sel.appendChild(opt);
  });
}

function activateTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-section').forEach(sec => {
    sec.classList.toggle('active', sec.id === `tab-${tabName}`);
  });
  if (tabName === 'seating') renderSeating();
  if (tabName === 'attendance') renderAttendance();
  if (tabName === 'behavior') renderBehaviorTable();
  if (tabName === 'stats') renderStats();
}

function togglePresentationMode() {
  appState.isPresentationMode = !appState.isPresentationMode;
  document.body.classList.toggle('presentation-mode', appState.isPresentationMode);
  const controls = document.getElementById('presentationControls');
  if (appState.isPresentationMode) {
    controls.classList.remove('hidden');
    startClock();
    showToast('🖥️ 발표 모드 시작! (ESC 혹은 종료 버튼으로 해제)', 'info');
  } else {
    controls.classList.add('hidden');
    stopClock();
    showToast('발표 모드가 종료되었습니다.');
  }
  renderSeating();
}

function toggleStudentView() {
  appState.isStudentView = !appState.isStudentView;
  document.body.classList.toggle('student-view-active', appState.isStudentView);
  const btn = document.getElementById('btnStudentView');
  btn.classList.toggle('btn-accent', appState.isStudentView);
  const chalkboard = document.querySelector('.blackboard');
  if (chalkboard) {
    chalkboard.textContent = appState.isStudentView ? '📺 칠판 (학생 시점 - 위)' : '📺 칠판 (교사 시점 - 아래)';
  }
  renderSeating();
  showToast(appState.isStudentView ? '📽️ 학생 시점(반전)으로 전환되었습니다.' : '🎞️ 교사 시점으로 복귀했습니다.');
}

function startClock() {
  stopClock();
  const update = () => {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    const el = document.getElementById('pTime');
    if (el) el.textContent = timeStr;
  };
  update();
  window._clockInterval = setInterval(update, 1000);
}
function stopClock() {
  clearInterval(window._clockInterval);
}

function toggleTheme() {
  const isLight = document.body.classList.toggle('light-mode');
  appState.theme = isLight ? 'light' : 'dark';
  const btn = document.getElementById('btnThemeToggle');
  btn.textContent = isLight ? '☀️' : '🌙';
  saveState();
}

function applyTheme() {
  if (appState.theme === 'light') {
    document.body.classList.add('light-mode');
    document.getElementById('btnThemeToggle').textContent = '☀️';
  } else {
    document.body.classList.remove('light-mode');
    document.getElementById('btnThemeToggle').textContent = '🌙';
  }
}

function showHelpModal() {
  document.getElementById('helpModal').classList.remove('hidden');
}

function closeHelpModal() {
  document.getElementById('helpModal').classList.add('hidden');
}

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        console.log('Wake Lock이 해제되었습니다.');
      });
      document.getElementById('btnWakeLock').textContent = '🌞';
      document.getElementById('btnWakeLock').title = '안 꺼짐(절전해제) 끄기';
      showToast('화면 꺼짐 방지가 활성화되었습니다.', 'success');
    } else {
      showToast('이 브라우저는 화면 꺼짐 방지를 지원하지 않습니다.', 'error');
    }
  } catch (err) {
    showToast(`화면 꺼짐 방지 실패: ${err.message}`, 'error');
  }
}

function releaseWakeLock() {
  if (wakeLock !== null) {
    wakeLock.release().then(() => {
      wakeLock = null;
      document.getElementById('btnWakeLock').textContent = '💡';
      document.getElementById('btnWakeLock').title = '안 꺼짐(절전해제) 켜기';
      showToast('화면 꺼짐 방지가 해제되었습니다.');
    });
  }
}

function toggleWakeLock() {
  if (wakeLock === null) requestWakeLock();
  else releaseWakeLock();
}

document.addEventListener('visibilitychange', async () => {
  if (wakeLock !== null && document.visibilityState === 'visible') requestWakeLock();
});

function checkDateChange() {
  const currentStr = todayStr();
  if (lastKnownDate && lastKnownDate !== currentStr) {
    lastKnownDate = currentStr;
    const today = new Date();
    document.getElementById('todayDisplay').textContent =
      `${today.getFullYear()}년 ${today.getMonth()+1}월 ${today.getDate()}일 (${['일','월','화','수','목','금','토'][today.getDay()]})`;
    document.getElementById('attendanceDate').value = currentStr;
    document.getElementById('filterDateTo').value = currentStr;
    const activeTab = document.querySelector('.tab-section.active');
    if (activeTab) {
      if (activeTab.id === 'tab-attendance' && typeof renderAttendance === 'function') renderAttendance();
      if (activeTab.id === 'tab-behavior' && typeof renderBehaviorTable === 'function') renderBehaviorTable();
      if (activeTab.id === 'tab-stats' && typeof renderStats === 'function') renderStats();
    }
  }
}

setInterval(checkDateChange, 60000);

function initApp() {
  lastKnownDate = todayStr();
  loadState();

  if (appState.classes && appState.classes.length > 0) {
    appState.classes.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }

  if (appState.classes.length === 0) {
    createClass('1반', 5, 6);
  }
  if (!appState.currentClassId && appState.classes.length > 0) {
    appState.currentClassId = appState.classes[0].id;
  }

  const today = new Date();
  document.getElementById('todayDisplay').textContent =
    `${today.getFullYear()}년 ${today.getMonth()+1}월 ${today.getDate()}일 (${['일','월','화','수','목','금','토'][today.getDay()]})`;

  document.getElementById('attendanceDate').value = todayStr();
  document.getElementById('filterDateFrom').value = new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0];
  document.getElementById('filterDateTo').value = todayStr();

  updateClassSelect();

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => activateTab(btn.dataset.tab));
  });

  document.getElementById('classSelect').addEventListener('change', (e) => {
    appState.currentClassId = e.target.value;
    saveState();
    activateTab('seating');
    renderStudentSidebar();
  });

  document.getElementById('btnAddClass').addEventListener('click', () => {
    document.getElementById('addClassModal').classList.remove('hidden');
    document.getElementById('inputClassName').focus();
  });
  document.getElementById('btnCloseAddClass').addEventListener('click', () => {
    document.getElementById('addClassModal').classList.add('hidden');
  });
  document.getElementById('btnConfirmAddClass').addEventListener('click', () => {
    const name = document.getElementById('inputClassName').value.trim();
    const rows = parseInt(document.getElementById('inputClassRows').value) || 5;
    const cols = parseInt(document.getElementById('inputClassCols').value) || 6;
    if (!name) { showToast('학급 이름을 입력하세요.', 'error'); return; }
    createClass(name, rows, cols);
    updateClassSelect();
    document.getElementById('addClassModal').classList.add('hidden');
    document.getElementById('inputClassName').value = '';
    activateTab('seating');
    renderStudentSidebar();
    showToast(`${name} 학급이 생성되었습니다.`, 'success');
  });

  document.getElementById('btnDeleteClass').addEventListener('click', () => {
    const cls = getCurrentClass();
    if (!cls) return;
    if (appState.classes.length === 1) { showToast('마지막 학급은 삭제할 수 없습니다.', 'error'); return; }
    if (!confirm(`"${cls.name}" 학급을 삭제하면 모든 학생 데이터와 기록이 사라집니다. 계속하시겠습니까?`)) return;
    deleteClass(cls.id);
    updateClassSelect();
    activateTab('seating');
    renderStudentSidebar();
    showToast('학급이 삭제되었습니다.', 'warning');
  });

  document.getElementById('btnPresentation').addEventListener('click', togglePresentationMode);
  document.getElementById('btnExitPresentation').addEventListener('click', togglePresentationMode);
  document.getElementById('btnStudentView').addEventListener('click', toggleStudentView);

  const btnRandom = document.getElementById('btnRandom');
  if (btnRandom) {
    btnRandom.addEventListener('click', typeof openRandomModal === 'function' ? openRandomModal : () => {
      showToast('랜덤 뽑기 기능을 불러올 수 없습니다.', 'error');
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (appState.isPresentationMode) togglePresentationMode();
      if (appState.isBulkMode && typeof toggleBulkMode === 'function') toggleBulkMode();
    }
  });

  document.getElementById('btnApplyGrid').addEventListener('click', () => {
    const cls = getCurrentClass();
    if (!cls) return;
    const rows = parseInt(document.getElementById('gridRows').value) || 5;
    const cols = parseInt(document.getElementById('gridCols').value) || 6;
    if (rows * cols < cls.students.filter(s => Object.values(cls.seats).includes(s.id)).length) {
      showToast('배치된 학생 수보다 칸이 적을 수 없습니다.', 'error');
      return;
    }
    cls.gridRows = rows;
    cls.gridCols = cols;
    const validKeys = new Set();
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) validKeys.add(`${r}-${c}`);
    Object.keys(cls.seats).forEach(k => { if (!validKeys.has(k)) delete cls.seats[k]; });
    if (cls.seatGenders) {
      Object.keys(cls.seatGenders).forEach(k => { if (!validKeys.has(k)) delete cls.seatGenders[k]; });
    }
    saveState();
    renderSeating();
    showToast('격자가 적용되었습니다.', 'success');
  });

  document.getElementById('btnClearSeats').addEventListener('click', () => {
    const cls = getCurrentClass();
    if (!cls) return;
    if (!confirm('모든 학생 자리를 초기화하시겠습니까?')) return;
    cls.seats = {};
    saveState();
    renderSeating();
    renderStudentSidebar();
    showToast('자리가 초기화되었습니다.');
  });

  document.getElementById('behaviorModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('behaviorModal'))
      document.getElementById('behaviorModal').classList.add('hidden');
  });
  document.getElementById('randomModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('randomModal')) {
      document.getElementById('randomModal').classList.add('hidden');
      clearInterval(window._spinInterval);
    }
  });
  document.getElementById('addClassModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('addClassModal'))
      document.getElementById('addClassModal').classList.add('hidden');
  });

  document.getElementById('inputClassName').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btnConfirmAddClass').click();
  });

  const btnWakeLock = document.getElementById('btnWakeLock');
  if (btnWakeLock) btnWakeLock.addEventListener('click', toggleWakeLock);

  document.getElementById('btnThemeToggle').addEventListener('click', toggleTheme);
  document.getElementById('btnShowHelp').addEventListener('click', showHelpModal);
  document.getElementById('btnCloseHelp').addEventListener('click', closeHelpModal);
  document.getElementById('btnConfirmHelp').addEventListener('click', closeHelpModal);

  document.getElementById('helpModal').addEventListener('click', (e) => {
    if (e.target.id === 'helpModal') closeHelpModal();
  });

  applyTheme();
  renderSeating();
  renderStudentSidebar();
}

document.addEventListener('DOMContentLoaded', initApp);

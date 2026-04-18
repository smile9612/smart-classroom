/**
 * js/timetable.js
 * 시간표 관리, 시정표 설정, 공휴일 및 시수 집계 로직
 */

let currentTimetableMode = 'base'; // 'base' 또는 'weekly'
let selectedWeekStart = null; // Date object representing Monday of the selected week

document.addEventListener('DOMContentLoaded', () => {
  initTimetableTab();
});

function initTimetableTab() {
  // 이벤트 리스너
  document.getElementById('schoolType').addEventListener('change', (e) => {
    appState.termSettings.schoolType = e.target.value;
    renderWeeklyTimetable();
    renderTimeSettings();
  });

  document.getElementById('btnSaveTimetable').addEventListener('click', saveAllTimetableConfig);
  document.getElementById('btnAddHoliday').addEventListener('click', addHoliday);
  document.getElementById('btnGoToClass').addEventListener('click', goToCurrentClass);
  
  // 기초/주간 전환
  document.getElementById('btnViewBase').addEventListener('click', () => setTimetableMode('base'));
  document.getElementById('btnViewWeekly').addEventListener('click', () => setTimetableMode('weekly'));
  
  // 주차 이동
  document.getElementById('btnPrevWeek').addEventListener('click', () => navigateWeek(-1));
  document.getElementById('btnNextWeek').addEventListener('click', () => navigateWeek(1));
  document.getElementById('btnApplyBaseToWeek').addEventListener('click', applyBaseToCurrentWeek);
  
  // 상태 초기화
  if (!appState.weeklyTimetable) appState.weeklyTimetable = {};
  initSelectedWeek();

  // 초기 렌더링
  loadTimetableUI();

  // 주기적으로 현재 수업 감지 (1분마다)
  setInterval(checkCurrentLesson, 60000);
  checkCurrentLesson();

  // 아침 팔업: 오늘의 시간표 안내
  checkMorningSchedulePopup();
  setInterval(checkMorningSchedulePopup, 60000); // 1분마다 체크
}

function loadTimetableUI() {
  const ts = appState.termSettings;
  document.getElementById('termStartDate').value = ts.startDate || "";
  document.getElementById('termEndDate').value = ts.endDate || "";
  document.getElementById('schoolType').value = ts.schoolType || "secondary";

  renderTimeSettings();
  renderWeeklyTimetable();
  renderTargetHoursSettings(); // renderWeeklyTimetable 이후 실행하여 시수 업데이트 보장
  renderHolidayList();
}

// ── 주차 이동 및 상태 관련 ──
function initSelectedWeek() {
  const now = new Date();
  selectedWeekStart = getMonday(now);
  updateWeekDisplay();
}

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay() || 7; 
  if (day !== 1) date.setHours(-24 * (day - 1));
  date.setHours(0,0,0,0);
  return date;
}

function getWeekKey(d) {
  const mon = getMonday(d);
  return `${mon.getFullYear()}-${String(mon.getMonth()+1).padStart(2,'0')}-${String(mon.getDate()).padStart(2,'0')}`;
}

function updateWeekDisplay() {
  if (!selectedWeekStart) return;
  const year = selectedWeekStart.getFullYear();
  const month = selectedWeekStart.getMonth() + 1;
  const d = selectedWeekStart.getDate();
  const weekNum = Math.ceil(d / 7);
  document.getElementById('currentWeekDisplay').textContent = `${year}년 ${month}월 ${weekNum}주차`;
}

function setTimetableMode(mode) {
  currentTimetableMode = mode;
  const btnBase = document.getElementById('btnViewBase');
  const btnWeekly = document.getElementById('btnViewWeekly');
  
  if (mode === 'base') {
    btnBase.className = 'btn btn-primary';
    btnWeekly.className = 'btn btn-ghost';
    document.getElementById('weekNavigator').classList.add('hidden');
    document.getElementById('weekNavigator').style.display = 'none';
    document.getElementById('timetableAreaTitle').textContent = '📋 기초 시간표 입력';
    document.getElementById('timetableAreaHelp').textContent = '각 칸을 클릭하여 해당 교시의 수업 학급을 선택하세요. (기초 시간표는 매주의 기본값이 됩니다.)';
    
    // 기초 설정 카드들 보이기
    const configCards = document.querySelectorAll('.timetable-layout .config-card');
    configCards.forEach(card => {
      if (!card.classList.contains('timetable-main-card')) {
        card.style.display = 'block';
      }
    });
  } else {
    btnBase.className = 'btn btn-ghost';
    btnWeekly.className = 'btn btn-primary';
    document.getElementById('weekNavigator').classList.remove('hidden');
    document.getElementById('weekNavigator').style.display = 'flex';
    document.getElementById('timetableAreaTitle').textContent = '🗓️ 주간 시간표 입력';
    document.getElementById('timetableAreaHelp').textContent = '이 주에 한해 기초 시간표를 덮어씁니다. (비어있는 칸은 기초 시간표를 따릅니다)';

    // 기초 설정 카드들 숨기기
    const configCards = document.querySelectorAll('.timetable-layout .config-card');
    configCards.forEach(card => {
      if (!card.classList.contains('timetable-main-card')) {
        card.style.display = 'none';
      }
    });
  }
  renderWeeklyTimetable();
}

function navigateWeek(dir) {
  selectedWeekStart.setDate(selectedWeekStart.getDate() + (dir * 7));
  updateWeekDisplay();
  renderWeeklyTimetable();
}

function applyBaseToCurrentWeek() {
  if (currentTimetableMode !== 'weekly') return;
  if (!confirm('현재 주간의 시간표 변동내역을 모두 지우고 기초 시간표와 동일하게 만드시겠습니까?')) return;
  const weekKey = getWeekKey(selectedWeekStart);
  if (appState.weeklyTimetable[weekKey]) {
    delete appState.weeklyTimetable[weekKey];
    saveState();
    renderWeeklyTimetable();
    showToast('기초 시간표를 불러왔습니다.', 'success');
  }
}


/** 교시별 시정 설정 UI 렌더링 */
function renderTimeSettings() {
  const container = document.getElementById('periodTimeList');
  container.innerHTML = '';
  const count = appState.termSettings.schoolType === 'elementary' ? 6 : 8;

  for (let i = 0; i < count; i++) {
    const config = appState.timeConfig[i] || { start: "09:00", end: "09:40" };
    const div = document.createElement('div');
    div.className = 'time-item';
    div.innerHTML = `
      <span>${i+1}교시 :</span>
      <input type="time" class="form-input time-start" data-index="${i}" value="${config.start}">
      <span>~</span>
      <input type="time" class="form-input time-end" data-index="${i}" value="${config.end}">
    `;
    container.appendChild(div);
  }
}

/** 학급별 기준 시수 설정 UI 렌더링 */
function renderTargetHoursSettings() {
  const container = document.getElementById('classTargetHoursList');
  container.innerHTML = '';

  // 학년별 일괄 시수 입력 영역 생성
  const grades = {};
  appState.classes.forEach(c => {
    const match = c.name.match(/^(\d+)/);
    const grade = match ? match[1] + '학년' : '기타';
    if (!grades[grade]) grades[grade] = [];
    grades[grade].push(c.id);
  });

  const gradeKeys = Object.keys(grades).sort();
  if (gradeKeys.length > 0) {
    const bulkDiv = document.createElement('div');
    bulkDiv.className = 'bulk-hours-wrapper';
    bulkDiv.style.cssText = 'margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid var(--border);';
    
    let html = `<strong style="display:block; margin-bottom:8px; font-size:0.9rem;">학년별 일괄 시수 기입</strong>
                <div style="display:flex; flex-wrap:wrap; gap:10px;">`;
    gradeKeys.forEach(g => {
      html += `<div style="display:flex; align-items:center; gap:5px; background:var(--bg-lighter); padding:5px 8px; border-radius:6px;">
        <span style="font-size:0.85rem">${g}:</span>
        <input type="number" class="form-input bulk-grade-input" data-grade="${g}" style="width:60px;" placeholder="시수" min="0">
        <button class="btn btn-secondary btn-sm" onclick="applyBulkHours('${g}')">적용</button>
      </div>`;
    });
    html += `</div>`;
    bulkDiv.innerHTML = html;
    container.appendChild(bulkDiv);
  }

  // 글로벌 일괄 적용 함수
  window.applyBulkHours = function(grade) {
    const input = document.querySelector(`.bulk-grade-input[data-grade="${grade}"]`);
    if(!input || !input.value) return;
    const val = parseInt(input.value);
    
    appState.classes.forEach(c => {
      const match = c.name.match(/^(\d+)/);
      const cGrade = match ? match[1] + '학년' : '기타';
      if(cGrade === grade) {
        appState.termSettings.targetHours[c.id] = val;
      }
    });
    saveState();
    renderTargetHoursSettings();
    showToast(`${grade} 기준 시수가 ${val}시간으로 일괄 적용되었습니다.`, 'success');
  };
  
  appState.classes.forEach(cls => {
    const hours = appState.termSettings.targetHours[cls.id] || 0;
    const div = document.createElement('div');
    div.className = 'hour-item';
    div.draggable = true;
    div.dataset.classId = cls.id;
    
    // 이 학급의 현재까지 누적 시수 계산
    const actualHours = calculateActualHours(cls.id);
    
    // 드래그 시작 시 데이터 설정
    div.ondragstart = (e) => {
      e.dataTransfer.setData('text/plain', cls.id);
      div.style.opacity = '0.5';
    };
    div.ondragend = () => { div.style.opacity = '1'; };

    div.innerHTML = `
      <span class="class-name" title="끌어다가 시간표에 놓으세요">☰ ${cls.name} <strong style="color:var(--accent); margin-left:5px;">(${actualHours} / ${hours}시간)</strong></span>
      <input type="number" class="form-input target-hour-input" data-id="${cls.id}" value="${hours}" min="0" style="width: 60px;">
      <span>시간</span>
    `;
    container.appendChild(div);
  });
}

/** 주간 시간표 그리드 렌더링 */
function renderWeeklyTimetable() {
  const tbody = document.getElementById('timetableBody');
  tbody.innerHTML = '';
  const count = appState.termSettings.schoolType === 'elementary' ? 6 : 8;
  const days = ['월', '화', '수', '목', '금'];

  // 요일에 날짜 표시 (thead 수정)
  const theadRow = document.querySelector('#weeklyTimetable thead tr');
  if (theadRow) {
    let theadHTML = `<th>교시</th>`;
    for (let d = 0; d < 5; d++) {
      let dateStr = "";
      if (currentTimetableMode === 'weekly' && selectedWeekStart) {
        const targetDate = new Date(selectedWeekStart);
        targetDate.setDate(targetDate.getDate() + d);
        dateStr = `<br><span style="font-weight:normal; font-size:0.8rem; color:var(--text-muted);">${targetDate.getMonth()+1}/${targetDate.getDate()}</span>`;
      }
      theadHTML += `<th>${days[d]}${dateStr}</th>`;
    }
    theadRow.innerHTML = theadHTML;
  }

  for (let p = 0; p < count; p++) {
    const tr = document.createElement('tr');
    
    const tConf = appState.timeConfig[p];
    const timeStr = tConf ? `<br><span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;">${tConf.start}~${tConf.end}</span>` : '';
    tr.innerHTML = `<th>${p+1}교시${timeStr}</th>`;
    
    for (let d = 0; d < 5; d++) {
      const key = `${d}-${p}`;
      
      let classId = "";
      if (currentTimetableMode === 'base') {
        classId = appState.timetable[key] || "";
      } else {
        const weekKey = getWeekKey(selectedWeekStart);
        if (appState.weeklyTimetable[weekKey] && appState.weeklyTimetable[weekKey][key] !== undefined) {
          classId = appState.weeklyTimetable[weekKey][key];
        } else {
          // 주간에 내용이 없으면 기초를 가져옴
          classId = appState.timetable[key] || "";
        }
      }
      
      const td = document.createElement('td');
      td.dataset.key = key;

      // 1. 드롭다운 선택박스 생성
      const select = document.createElement('select');
      select.className = 'timetable-select';
      if (currentTimetableMode === 'weekly' && (!appState.weeklyTimetable[getWeekKey(selectedWeekStart)] || appState.weeklyTimetable[getWeekKey(selectedWeekStart)][key] === undefined)) {
        // 기초 시간표를 그대로 상속받는 상태 표시
        select.style.color = '#888'; 
      }
      
      const defaultOpt = document.createElement('option');
      defaultOpt.value = "";
      defaultOpt.textContent = "-";
      select.appendChild(defaultOpt);

      appState.classes.forEach(cls => {
        const opt = document.createElement('option');
        opt.value = cls.id;
        opt.textContent = cls.name;
        if (cls.id === classId) opt.selected = true;
        select.appendChild(opt);
      });

      select.onchange = (e) => {
        if (currentTimetableMode === 'base') {
          if (e.target.value) appState.timetable[key] = e.target.value;
          else delete appState.timetable[key];
        } else {
          const weekKey = getWeekKey(selectedWeekStart);
          if (!appState.weeklyTimetable[weekKey]) appState.weeklyTimetable[weekKey] = {};
          appState.weeklyTimetable[weekKey][key] = e.target.value; // "" 일 수도 있음 (결강 처리)
          select.style.color = 'inherit';
        }
        saveState();
        checkCurrentLesson();
        renderTargetHoursSettings(); // 수정 시 시수 즉각 반영
      };

      // 2. 드래그 앤 드롭 이벤트 연결
      td.ondragover = (e) => {
        e.preventDefault();
        td.classList.add('drag-over');
      };
      td.ondragleave = () => td.classList.remove('drag-over');
      td.ondrop = (e) => {
        e.preventDefault();
        td.classList.remove('drag-over');
        const droppedClassId = e.dataTransfer.getData('text/plain');
        if (droppedClassId) {
          if (currentTimetableMode === 'base') {
            appState.timetable[key] = droppedClassId;
          } else {
            const weekKey = getWeekKey(selectedWeekStart);
            if (!appState.weeklyTimetable[weekKey]) appState.weeklyTimetable[weekKey] = {};
            appState.weeklyTimetable[weekKey][key] = droppedClassId;
          }
          renderWeeklyTimetable();
          renderTargetHoursSettings();
          saveState();
          checkCurrentLesson();
        }
      };

      td.appendChild(select);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
}

/** 기존의 selectClassForTimetable 함수는 삭제되거나 호출되지 않음 */

/** 특정 교시 학급 선택 (팝업 대신 간단한 prompt 사용) */
function selectClassForTimetable(key, td) {
  const classNames = appState.classes.map(c => c.name).join(', ');
  const input = prompt(`해당 교시의 학급 이름을 입력하세요.\n(목록: ${classNames} / 비우려면 취소)`, td.textContent);
  
  if (input === null) return;
  
  const selectedClass = appState.classes.find(c => c.name === input.trim());
  if (selectedClass) {
    appState.timetable[key] = selectedClass.id;
  } else {
    delete appState.timetable[key];
  }
  renderWeeklyTimetable();
}

/** 공휴일 리스트 렌더링 */
function renderHolidayList() {
  const container = document.getElementById('holidayList');
  container.innerHTML = '';
  
  appState.holidays.sort((a,b) => a.date.localeCompare(b.date)).forEach((h, idx) => {
    const span = document.createElement('span');
    span.className = 'holiday-badge';
    span.innerHTML = `
      ${h.date} (${h.label})
      <button class="btn-del-holiday" onclick="removeHoliday(${idx})">✕</button>
    `;
    container.appendChild(span);
  });
}

/** 공휴일 추가 */
function addHoliday() {
  const date = document.getElementById('holidayDate').value;
  const label = document.getElementById('holidayLabel').value.trim();
  if (!date || !label) { showToast('날짜와 사유를 입력하세요.', 'error'); return; }
  
  appState.holidays.push({ date, label });
  document.getElementById('holidayDate').value = '';
  document.getElementById('holidayLabel').value = '';
  renderHolidayList();
}

function removeHoliday(idx) {
  appState.holidays.splice(idx, 1);
  renderHolidayList();
}

/** 모든 설정 저장 */
function saveAllTimetableConfig() {
  // 1. 학기 설정
  appState.termSettings.startDate = document.getElementById('termStartDate').value;
  appState.termSettings.endDate = document.getElementById('termEndDate').value;
  
  // 2. 시정 설정
  const startInputs = document.querySelectorAll('.time-start');
  const endInputs = document.querySelectorAll('.time-end');
  startInputs.forEach(input => {
    const idx = input.dataset.index;
    if (!appState.timeConfig[idx]) appState.timeConfig[idx] = {};
    appState.timeConfig[idx].start = input.value;
  });
  endInputs.forEach(input => {
    const idx = input.dataset.index;
    appState.timeConfig[idx].end = input.value;
  });

  // 3. 목표 시수 설정
  const hourInputs = document.querySelectorAll('.target-hour-input');
  hourInputs.forEach(input => {
    appState.termSettings.targetHours[input.dataset.id] = parseInt(input.value) || 0;
  });

  saveState();
  renderTargetHoursSettings(); // 저장 시 시수 UI 재계산
  showToast('시간표 및 설정이 저장되었습니다.', 'success');
  checkCurrentLesson();
}

/** 현재 수업 감지 로직 */
function checkCurrentLesson() {
  const now = new Date();
  const day = now.getDay(); // 0(일)~6(토)
  if (day === 0 || day === 6) {
    hideSmartNotice();
    return;
  }

  const timeStr = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
  const currentPeriodIdx = appState.timeConfig.findIndex(conf => timeStr >= conf.start && timeStr <= conf.end);

  if (currentPeriodIdx > -1) {
    const key = `${day-1}-${currentPeriodIdx}`;
    // 주간 시간표가 적용되어 있다면 우선적으로 가져옴 (추후 구조 변경을 대비)
    let classId = appState.timetable[key];
    
    // 이후 주간 시간표(weeklyTimetable) 구현 시 여기에서 이번 주 데이터를 먼저 참조하도록 수정 예정
    const weekKey = getWeekKey(now); 
    if (appState.weeklyTimetable && appState.weeklyTimetable[weekKey] && appState.weeklyTimetable[weekKey][key] !== undefined) {
      classId = appState.weeklyTimetable[weekKey][key];
    }
    
    const cls = appState.classes.find(c => c.id === classId);
    
    if (cls) {
      // 이미 해당 학급 화면에 있는 경우, 반복해서 팝업을 띄우지 않음
      if (appState.currentClassId === classId) {
        hideSmartNotice();
        return;
      }
      showSmartNotice(currentPeriodIdx + 1, cls);
      return;
    }
  }
  hideSmartNotice();
}

function showSmartNotice(period, cls) {
  const notice = document.getElementById('smartClassNotice');
  const msg = document.getElementById('noticeMsg');
  notice.classList.remove('hidden');
  msg.innerHTML = `현재 <strong style="color:#ffd700">${period}교시</strong> 수업 시간입니다. <strong>[${cls.name}]</strong> 화면으로 이동할까요?`;
  window._currentDetectedClassId = cls.id;
}

function hideSmartNotice() {
  document.getElementById('smartClassNotice').classList.add('hidden');
}

function goToCurrentClass() {
  if (window._currentDetectedClassId) {
    appState.currentClassId = window._currentDetectedClassId;
    saveState();
    // 강제 갱신
    document.getElementById('classSelect').value = appState.currentClassId;
    activateTab('seating');
    renderSeating();
    renderStudentSidebar();
    hideSmartNotice();
  }
}

function calculateActualHours(classId) {
  const ts = appState.termSettings;
  if (!ts.startDate) return 0;

  const start = new Date(ts.startDate);
  // 종료기준: 현재 타임테이블 모드가 weekly이고 주간을 보고 있다면 오늘이 아니라 그 주간의 금요일까지? 
  // 아니면 "현재까지(오늘)"가 기준이 되어야 함. 명세에 따라 "오늘까지 실제로 수업한 횟수".
  const today = new Date();
  today.setHours(23, 59, 59); // 오늘 끝까지 포함

  let count = 0;
  let current = new Date(start);

  while (current <= today) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) { // 주말 제외
      const dateStr = current.toISOString().split('T')[0];
      const isHoliday = appState.holidays.some(h => h.date === dateStr);
      
      if (!isHoliday) {
        // 기초 시간표인지 주간 덮어쓰기인지 확인
        const dayIdx = day - 1;
        const weekKey = getWeekKey(current);
        
        for (let p = 0; p < (ts.schoolType === 'elementary' ? 6 : 8); p++) {
          const tKey = `${dayIdx}-${p}`;
          let actualClassId = appState.timetable[tKey] || "";
          
          if (appState.weeklyTimetable && appState.weeklyTimetable[weekKey] && appState.weeklyTimetable[weekKey][tKey] !== undefined) {
             actualClassId = appState.weeklyTimetable[weekKey][tKey];
          }
          
          if (actualClassId === classId) {
            count++;
          }
        }
      }
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

/** 아침 팔업: 오늘의 수업 시간표 안내 */
let _morningPopupShownToday = '';

function checkMorningSchedulePopup() {
  const now = new Date();
  const day = now.getDay();
  // 주말이면 무시
  if (day === 0 || day === 6) return;
  
  const todayKey = todayStr();
  // 오늘 이미 표시했으면 무시
  if (_morningPopupShownToday === todayKey) return;
  
  // 사용자가 설정한 시간 확인
  const notifyTimeEl = document.getElementById('morningNotifyTime');
  const notifyEnabledEl = document.getElementById('morningNotifyEnabled');
  if (!notifyEnabledEl || !notifyEnabledEl.checked) return;
  
  const notifyTime = notifyTimeEl ? notifyTimeEl.value : '08:30';
  const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
  
  // 설정 시간이 지났고, 아직 15분 이내인 경우만 표시 (너무 늦게 열면 안 뜨게)
  if (currentTime < notifyTime) return;
  
  // 설정 시간으로부터 30분 이내여야 표시
  const [nh, nm] = notifyTime.split(':').map(Number);
  const notifyMinutes = nh * 60 + nm;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  if (currentMinutes - notifyMinutes > 30) return;
  
  // 오늘 수업 목록 수집
  const dayIdx = day - 1; // 0(월)~4(금)
  const weekKey = getWeekKey(now);
  const count = appState.termSettings.schoolType === 'elementary' ? 6 : 8;
  
  let scheduleItems = [];
  for (let p = 0; p < count; p++) {
    const tKey = `${dayIdx}-${p}`;
    let classId = appState.timetable[tKey] || '';
    
    // 주간 시간표 반영
    if (appState.weeklyTimetable && appState.weeklyTimetable[weekKey] && appState.weeklyTimetable[weekKey][tKey] !== undefined) {
      classId = appState.weeklyTimetable[weekKey][tKey];
    }
    
    if (classId) {
      const cls = appState.classes.find(c => c.id === classId);
      const timeConf = appState.timeConfig[p];
      const timeLabel = timeConf ? `${timeConf.start}~${timeConf.end}` : '';
      scheduleItems.push({
        period: p + 1,
        className: cls ? cls.name : '(알 수 없는 학급)',
        time: timeLabel
      });
    }
  }
  
  if (scheduleItems.length === 0) return; // 오늘 수업 없음
  
  _morningPopupShownToday = todayKey;
  
  // 팔업 내용 생성
  const days = ['월', '화', '수', '목', '금'];
  const scheduleHtml = scheduleItems.map(it => 
    `<tr><td style="padding:4px 10px; font-weight:600;">${it.period}교시</td><td style="padding:4px 10px; color:var(--accent); font-weight:700;">${it.className}</td><td style="padding:4px 10px; font-size:0.85rem; color:var(--text-muted);">${it.time}</td></tr>`
  ).join('');
  
  const popupOverlay = document.createElement('div');
  popupOverlay.className = 'modal-overlay';
  popupOverlay.id = 'morningSchedulePopup';
  popupOverlay.style.cssText = 'z-index:9999;';
  popupOverlay.innerHTML = `
    <div class="modal-box" style="max-width:420px; text-align:center;">
      <h2 style="margin-bottom:10px;">🌅 오늘의 수업 안내</h2>
      <p style="font-size:1.1rem; margin-bottom:15px; font-weight:600; color:var(--accent);">
        ${now.getMonth()+1}월 ${now.getDate()}일 (${days[dayIdx]})요일
      </p>
      <table style="width:100%; border-collapse:collapse; margin:0 auto 15px;">
        <thead><tr style="border-bottom:2px solid var(--border);"><th style="padding:5px;">교시</th><th style="padding:5px;">학급</th><th style="padding:5px;">시간</th></tr></thead>
        <tbody>${scheduleHtml}</tbody>
      </table>
      <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:12px;">(시간표 탭 → 기초 시간표 → 아침 수업 안내 알림에서 시간/사용 여부 변경 가능)</p>
      <button class="btn btn-primary btn-lg" style="width:100%;" onclick="document.getElementById('morningSchedulePopup').remove()">확인했습니다 👍</button>
    </div>
  `;
  popupOverlay.addEventListener('click', (e) => {
    if (e.target === popupOverlay) popupOverlay.remove();
  });
  document.body.appendChild(popupOverlay);
}

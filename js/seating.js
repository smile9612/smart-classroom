/* ==========================================
   seating.js - 자리 배치도 (전면 개편)
   ========================================== */

let genderModeActive = false;
let swapModeActive = false;
let swapFirstKey = null;

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function isShowNumbers() {
  return document.getElementById('toggleShowNumbers')?.checked !== false;
}

function getStudentAttendanceToday(studentId) {
  const today = todayStr();
  const cls = getCurrentClass();
  if (!cls) return null;
  return appState.attendance.find(
    a => a.studentId === studentId && a.classId === cls.id && a.date === today
  ) || null;
}

function getStudentBehaviorsToday(studentId) {
  const today = todayStr();
  const cls = getCurrentClass();
  if (!cls) return [];
  return appState.behaviors.filter(
    b => b.studentId === studentId && b.classId === cls.id && b.date === today
  );
}

function getAttendanceBadgeHtml(status) {
  if (!status || status === 'present') return '';
  const info = ATTENDANCE_STATUS[status];
  if (!info) return '';
  return `<span class="status-badge badge-${status}">${info.emoji}</span>`;
}

function getBehaviorDotsHtml(behaviors) {
  if (!behaviors || behaviors.length === 0) return '';
  const hasPositive = behaviors.some(b => b.type === 'positive');
  const hasNegative = behaviors.some(b => b.type === 'negative');
  let dots = '<div class="behavior-dots">';
  if (hasPositive) dots += '<div class="behavior-dot dot-positive"></div>';
  if (hasNegative) dots += '<div class="behavior-dot dot-negative"></div>';
  dots += '</div>';
  return dots;
}

function getSeatGenderInfo(cls, key) {
  const seatGenders = cls.seatGenders || {};
  return seatGenders[key] || 'any';
}

function renderSeating() {
  const cls = getCurrentClass();
  const grid = document.getElementById('seatGrid');
  if (!grid) return;

  if (!cls) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-icon">🏫</div>학급을 생성해 주세요.</div>';
    return;
  }

  if (!cls.seatGenders) cls.seatGenders = {};

  document.getElementById('gridRows').value = cls.gridRows;
  document.getElementById('gridCols').value = cls.gridCols;
  grid.style.gridTemplateColumns = `repeat(${cls.gridCols}, 1fr)`;
  grid.innerHTML = '';

  const showNums = isShowNumbers();
  const isViewInverted = appState.isStudentView;

  const rowRange = [];
  if (isViewInverted) {
    for (let r = cls.gridRows - 1; r >= 0; r--) rowRange.push(r);
  } else {
    for (let r = 0; r < cls.gridRows; r++) rowRange.push(r);
  }

  const colRange = [];
  if (isViewInverted) {
    for (let c = cls.gridCols - 1; c >= 0; c--) colRange.push(c);
  } else {
    for (let c = 0; c < cls.gridCols; c++) colRange.push(c);
  }

  for (const row of rowRange) {
    for (const col of colRange) {
      const key = `${row}-${col}`;
      const studentId = cls.seats[key];
      const student = studentId ? cls.students.find(s => s.id === studentId) : null;
      const seatGender = getSeatGenderInfo(cls, key);

      const cell = document.createElement('div');
      cell.className = 'seat-cell';
      cell.dataset.key = key;

      if (seatGender === 'male') cell.classList.add('seat-gender-male');
      else if (seatGender === 'female') cell.classList.add('seat-gender-female');

      if (swapModeActive && swapFirstKey === key) cell.classList.add('swap-selected');

      if (student) {
        const attendance = getStudentAttendanceToday(student.id);
        const behaviors = getStudentBehaviorsToday(student.id);
        const attStatus = attendance ? attendance.status : 'present';
        const genderClass = student.gender === 'male' ? 'card-male' : student.gender === 'female' ? 'card-female' : '';
        const isAbsent = attStatus === 'absent';
        const isSelected = appState.selectedStudentIds.includes(student.id);

        if (isAbsent) cell.classList.add('is-absent-seat');
        cell.classList.add('occupied');
        cell.innerHTML = `
          <div class="student-card ${genderClass} ${isSelected ? 'is-selected-bulk' : ''}"
               draggable="${!swapModeActive && !isAbsent && !appState.isBulkMode}"
               data-student-id="${student.id}"
               data-seat-key="${key}">
            ${showNums ? `<span class="student-number">${student.number}번</span>` : ''}
            <span class="student-gender-icon">${student.gender === 'male' ? '♂' : student.gender === 'female' ? '♀' : ''}</span>
            <span class="student-name">${student.name}</span>
            ${getAttendanceBadgeHtml(attStatus)}
            ${getBehaviorDotsHtml(behaviors)}
          </div>
          ${(seatGender !== 'any' && (genderModeActive || !student)) ? `<span class="seat-gender-label">${seatGender === 'male' ? '♂' : '♀'}</span>` : ''}
        `;

        const card = cell.querySelector('.student-card');

        if (!swapModeActive && !isAbsent && !appState.isBulkMode) {
          card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('studentId', student.id);
            e.dataTransfer.setData('source', 'seat');
            e.dataTransfer.setData('sourceKey', key);
            card.classList.add('dragging');
            e.stopPropagation();
          });
          card.addEventListener('dragend', () => card.classList.remove('dragging'));
        }

        if (!isAbsent) {
          cell.addEventListener('click', (e) => {
            if (window._isDragging) return;
            if (appState.isBulkMode) { handleBulkClick(student.id); return; }
            if (swapModeActive) { handleSwapClick(key); return; }
            if (genderModeActive) { cycleSeatlGender(cls, key); return; }
            openBehaviorModal(student.id);
          });
        }
      } else {
        cell.innerHTML = `
          <div class="empty-seat-label">
            ${seatGender === 'male' ? '<span class="seat-gender-icon-lg male">♂</span>' : seatGender === 'female' ? '<span class="seat-gender-icon-lg female">♀</span>' : ''}
          </div>
        `;
        cell.addEventListener('click', () => {
          if (genderModeActive) cycleSeatlGender(cls, key);
        });
      }

      cell.addEventListener('dragover', (e) => { e.preventDefault(); cell.classList.add('drag-over'); });
      cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
      cell.addEventListener('drop', (e) => { e.preventDefault(); cell.classList.remove('drag-over'); handleDrop(e, key); });

      grid.appendChild(cell);
    }
  }
  renderStudentSidebar();
}

function cycleSeatlGender(cls, key) {
  if (!cls.seatGenders) cls.seatGenders = {};
  const current = cls.seatGenders[key] || 'any';
  const next = current === 'any' ? 'male' : current === 'male' ? 'female' : 'any';
  if (next === 'any') delete cls.seatGenders[key];
  else cls.seatGenders[key] = next;
  saveState();
  renderSeating();
  const label = next === 'any' ? '일반(제한 없음)' : next === 'male' ? '남학생 전용' : '여학생 전용';
  showToast(`자리 성별: ${label}`);
}

function handleSwapClick(clickedKey) {
  const cls = getCurrentClass();
  if (!cls) return;
  if (!swapFirstKey) {
    if (!cls.seats[clickedKey]) { showToast('학생이 있는 자리를 선택하세요.', 'warning'); return; }
    swapFirstKey = clickedKey;
    renderSeating();
    const sName = cls.students.find(s => s.id === cls.seats[clickedKey])?.name || '';
    showToast(`"${sName}" 선택됨. 두 번째 자리를 클릭하세요.`, 'default');
  } else {
    if (clickedKey === swapFirstKey) { swapFirstKey = null; renderSeating(); showToast('선택이 취소되었습니다.'); return; }
    const temp = cls.seats[swapFirstKey];
    if (cls.seats[clickedKey]) cls.seats[swapFirstKey] = cls.seats[clickedKey];
    else delete cls.seats[swapFirstKey];
    if (temp) cls.seats[clickedKey] = temp;
    else delete cls.seats[clickedKey];
    saveState();
    swapFirstKey = null;
    renderSeating();
    showToast('자리가 교체되었습니다! 🔄', 'success');
  }
}

function handleDrop(e, targetKey) {
  const studentId = e.dataTransfer.getData('studentId');
  const source = e.dataTransfer.getData('source');
  const sourceKey = e.dataTransfer.getData('sourceKey');
  const cls = getCurrentClass();
  if (!cls || !studentId) return;
  const targetStudentId = cls.seats[targetKey];
  if (source === 'seat' && sourceKey) {
    if (targetStudentId) { cls.seats[sourceKey] = targetStudentId; cls.seats[targetKey] = studentId; showToast('자리가 교환되었습니다.'); }
    else { delete cls.seats[sourceKey]; cls.seats[targetKey] = studentId; showToast('자리가 이동되었습니다.'); }
  } else if (source === 'unassigned') {
    Object.keys(cls.seats).forEach(k => { if (cls.seats[k] === studentId) delete cls.seats[k]; });
    cls.seats[targetKey] = studentId;
    const sName = cls.students.find(s => s.id === studentId)?.name || '';
    showToast(`${sName}이(가) 배치되었습니다.`, 'success');
  }
  saveState();
  renderSeating();
}

function smartAutoArrange() {
  const cls = getCurrentClass();
  if (!cls) return;
  if (cls.students.length === 0) { showToast('학생을 먼저 추가하세요.', 'error'); return; }
  if (!confirm(`${cls.students.length}명을 성별에 맞게 자동 배치하시겠습니까?`)) return;

  let males = shuffleArray(cls.students.filter(s => s.gender === 'male').map(s => s.id));
  let females = shuffleArray(cls.students.filter(s => s.gender === 'female').map(s => s.id));
  let neutral = shuffleArray(cls.students.filter(s => !s.gender || (s.gender !== 'male' && s.gender !== 'female')).map(s => s.id));

  const maleSeats = [], femaleSeats = [], anySeats = [];
  for (let r = 0; r < cls.gridRows; r++) {
    for (let c = 0; c < cls.gridCols; c++) {
      const key = `${r}-${c}`;
      const g = (cls.seatGenders || {})[key] || 'any';
      if (g === 'male') maleSeats.push(key);
      else if (g === 'female') femaleSeats.push(key);
      else anySeats.push(key);
    }
  }

  const newSeats = {};
  function assign(key, pool) {
    if (pool.length > 0) { newSeats[key] = pool.shift(); return true; }
    return false;
  }

  maleSeats.forEach(key => assign(key, males));
  femaleSeats.forEach(key => assign(key, females));

  let toggle = true;
  anySeats.forEach(key => {
    let success = false;
    if (toggle) success = assign(key, males) || assign(key, females) || assign(key, neutral);
    else success = assign(key, females) || assign(key, males) || assign(key, neutral);
    if (success) toggle = !toggle;
  });

  const allRemaining = [...males, ...females, ...neutral];
  anySeats.forEach(key => {
    if (!newSeats[key] && allRemaining.length > 0) newSeats[key] = allRemaining.shift();
  });

  cls.seats = newSeats;
  saveState();
  renderSeating();
  showToast('✨ 성별을 고려한 스마트 배치가 완료되었습니다!', 'success');
}

function openRandomModal() {
  const cls = getCurrentClass();
  if (!cls || cls.students.length === 0) { showToast('학생을 먼저 추가해 주세요.', 'error'); return; }
  document.getElementById('randomModal').classList.remove('hidden');
  document.getElementById('randomSpinner').textContent = '?';
  document.getElementById('randomResult').classList.add('hidden');
  document.getElementById('btnStartRandom').classList.remove('hidden');
  document.getElementById('btnPickAgain').classList.add('hidden');
  clearInterval(window._spinInterval);
}

function startRandom() {
  const cls = getCurrentClass();
  if (!cls) return;
  const students = cls.students;
  if (students.length === 0) return;
  document.getElementById('btnStartRandom').classList.add('hidden');
  const spinner = document.getElementById('randomSpinner');
  spinner.classList.add('spinning');
  let count = 0;
  const maxCount = 28;
  clearInterval(window._spinInterval);
  window._spinInterval = setInterval(() => {
    const rand = students[Math.floor(Math.random() * students.length)];
    spinner.textContent = rand.name;
    count++;
    if (count >= maxCount) {
      clearInterval(window._spinInterval);
      spinner.classList.remove('spinning');
      const picked = students[Math.floor(Math.random() * students.length)];
      spinner.textContent = picked.name;
      const result = document.getElementById('randomResult');
      result.textContent = `🎉 ${picked.name} 학생!`;
      result.classList.remove('hidden');
      document.getElementById('btnPickAgain').classList.remove('hidden');
    }
  }, 80);
}

function updateModeStatus() {
  const badge = document.getElementById('modeStatus');
  if (!badge) return;
  if (genderModeActive) { badge.textContent = '⚥ 성별 자리 설정 모드 활성'; badge.className = 'mode-status-badge mode-gender'; }
  else if (swapModeActive) { badge.textContent = swapFirstKey ? '🔄 두 번째 자리 선택 중...' : '🔄 교체 모드 – 첫 번째 학생 선택'; badge.className = 'mode-status-badge mode-swap'; }
  else { badge.textContent = ''; badge.className = 'mode-status-badge'; }
}

document.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('dragstart', () => window._isDragging = true);
  document.addEventListener('dragend', () => setTimeout(() => window._isDragging = false, 100));

  document.getElementById('toggleShowNumbers').addEventListener('change', () => renderSeating());

  document.getElementById('btnGenderMode').addEventListener('click', () => {
    genderModeActive = !genderModeActive;
    swapModeActive = false; swapFirstKey = null;
    document.getElementById('btnGenderMode').classList.toggle('mode-btn-active', genderModeActive);
    document.getElementById('btnSwapMode').classList.remove('mode-btn-active');
    updateModeStatus(); renderSeating();
    if (genderModeActive) showToast('⚥ 성별 자리 설정 모드: 빈 자리를 클릭하면 성별 제한이 순환됩니다.', 'default', 4000);
  });

  document.getElementById('btnSwapMode').addEventListener('click', () => {
    swapModeActive = !swapModeActive;
    genderModeActive = false; swapFirstKey = null;
    document.getElementById('btnSwapMode').classList.toggle('mode-btn-active', swapModeActive);
    document.getElementById('btnGenderMode').classList.remove('mode-btn-active');
    updateModeStatus(); renderSeating();
    if (swapModeActive) showToast('🔄 교체 모드: 학생 두 명을 순서대로 클릭하면 자리가 바뀝니다.', 'default', 4000);
  });

  document.getElementById('btnSmartArrange').addEventListener('click', smartAutoArrange);

  document.getElementById('btnShuffleSeats').addEventListener('click', () => {
    const cls = getCurrentClass();
    if (!cls) return;
    if (!confirm('학생들의 자리를 무작위로 배치하시겠습니까?')) return;
    const students = shuffleArray([...cls.students]);
    cls.seats = {};
    students.slice(0, cls.gridRows * cls.gridCols).forEach((s, i) => {
      cls.seats[`${Math.floor(i / cls.gridCols)}-${i % cls.gridCols}`] = s.id;
    });
    saveState(); renderSeating();
    showToast('자리가 무작위로 배치되었습니다! 🎲', 'success');
  });

  document.getElementById('btnRandom').addEventListener('click', openRandomModal);
  document.getElementById('btnCloseRandom').addEventListener('click', () => {
    document.getElementById('randomModal').classList.add('hidden');
    clearInterval(window._spinInterval);
  });
  document.getElementById('btnStartRandom').addEventListener('click', startRandom);
  document.getElementById('btnPickAgain').addEventListener('click', () => {
    document.getElementById('randomResult').classList.add('hidden');
    document.getElementById('randomSpinner').textContent = '?';
    document.getElementById('btnStartRandom').classList.remove('hidden');
    document.getElementById('btnPickAgain').classList.add('hidden');
    startRandom();
  });
});

function updateSeatAttendanceBadge(studentId, status) {
  const card = document.querySelector(`.student-card[data-student-id="${studentId}"]`);
  if (!card) return;
  const existingBadge = card.querySelector('.status-badge');
  if (existingBadge) existingBadge.remove();
  const badgeHtml = getAttendanceBadgeHtml(status);
  if (badgeHtml) card.insertAdjacentHTML('beforeend', badgeHtml);
}

function updateBehaviorDots(studentId) {
  const card = document.querySelector(`.student-card[data-student-id="${studentId}"]`);
  if (!card) return;
  const existingDots = card.querySelector('.behavior-dots');
  if (existingDots) existingDots.remove();
  const behaviors = getStudentBehaviorsToday(studentId);
  const dotsHtml = getBehaviorDotsHtml(behaviors);
  if (dotsHtml) card.insertAdjacentHTML('beforeend', dotsHtml);
}

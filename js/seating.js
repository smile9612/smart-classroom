/* ==========================================
   seating.js - 자리 배치도 (전면 개편)
   - 드래그 앤 드롭 + 교체 모드
   - 성별 자리 설정 모드
   - 스마트 자동 배치 (성별 지정)
   - 번호 표시/숨김 토글
   ========================================== */

// ── 모드 상태 변수 ──
let genderModeActive = false;   // 성별 자리 설정 모드
let swapModeActive = false;     // 교체 모드
let swapFirstKey = null;        // 교체 모드: 첫 번째 선택된 자리 key
let seatsHistory = [];           // 자리 배치 되돌리기 이력

// ── 유틸 ──
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 번호 표시 여부 */
function isShowNumbers() {
  return document.getElementById('toggleShowNumbers')?.checked !== false;
}

/** 특정 학생의 오늘 출결 상태 가져오기 */
function getStudentAttendanceToday(studentId) {
  const today = todayStr();
  const cls = getCurrentClass();
  if (!cls) return null;
  return appState.attendance.find(
    a => a.studentId === studentId && a.classId === cls.id && a.date === today
  ) || null;
}

/** 특정 학생의 오늘 행동 기록 가져오기 */
function getStudentBehaviorsToday(studentId) {
  const today = todayStr();
  const cls = getCurrentClass();
  if (!cls) return [];
  return appState.behaviors.filter(
    b => b.studentId === studentId && b.classId === cls.id && b.date === today
  );
}

/** 출결 상태 배지 HTML */
function getAttendanceBadgeHtml(status) {
  if (!status || status === 'present') return '';
  const info = ATTENDANCE_STATUS[status];
  if (!info) return '';
  return `<span class="status-badge badge-${status}">${info.emoji}</span>`;
}

/** 행동 기록 점 HTML */
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

/** 자리 셀의 성별 제한 아이콘/클래스 반환 */
function getSeatGenderInfo(cls, key) {
  const seatGenders = cls.seatGenders || {};
  return seatGenders[key] || 'any';
}

// ── 핵심: 자리 배치도 렌더링 ──
function renderSeating() {
  const cls = getCurrentClass();
  const grid = document.getElementById('seatGrid');
  if (!grid) return;

  if (!cls) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-icon">🏫</div>학급을 생성해 주세요.</div>';
    return;
  }

  // seatGenders 초기화 보장
  if (!cls.seatGenders) cls.seatGenders = {};

  document.getElementById('gridRows').value = cls.gridRows;
  document.getElementById('gridCols').value = cls.gridCols;
  grid.style.gridTemplateColumns = `repeat(${cls.gridCols}, 1fr)`;
  grid.innerHTML = '';

  const showNums = isShowNumbers();
  const isViewInverted = appState.isStudentView;

  // 행/열 루프 순서 결정
  const rowRange = [];
  if (isViewInverted) {
    for (let r = cls.gridRows - 1; r >= 0; r--) rowRange.push(r);
  } else {
    for (let r = 0; r < cls.gridRows; r++) rowRange.push(r);
  }

  const colRange = [];
  if (isViewInverted) {
    // 학생 시점에서는 상하(행)와 좌우(열) 모두 반전
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

      // 자리 성별 제한 색상 클래스
      if (seatGender === 'male') cell.classList.add('seat-gender-male');
      else if (seatGender === 'female') cell.classList.add('seat-gender-female');

      // 교체 모드에서 첫 번째 선택된 자리 강조
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

        // 드래그 이벤트 (교체 모드가 아니고 결석이 아니며 일괄 기록 모드가 아닐 때만)
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

        // 클릭 이벤트 (결석이 아닐 때만)
        if (!isAbsent) {
          cell.addEventListener('click', (e) => {
            if (window._isDragging) return;

            // 일괄 선택 모드 최우선
            if (appState.isBulkMode) {
              handleBulkClick(student.id);
              return;
            }

            if (swapModeActive) {
              handleSwapClick(key);
              return;
            }
            if (genderModeActive) {
              cycleSeatlGender(cls, key);
              return;
            }

            // 일반 클릭 → 행동 기록 모달
            openBehaviorModal(student.id);
          });
        }

      } else {
        // 빈 자리
        cell.innerHTML = `
          <div class="empty-seat-label">
            ${seatGender === 'male' ? '<span class="seat-gender-icon-lg male">♂</span>' : seatGender === 'female' ? '<span class="seat-gender-icon-lg female">♀</span>' : ''}
          </div>
        `;
        // 빈 자리 클릭 → 성별 설정 모드일 때 성별 제한 순환
        cell.addEventListener('click', () => {
          if (genderModeActive) {
            cycleSeatlGender(cls, key);
          }
        });
      }

      // 드롭 영역 이벤트
      cell.addEventListener('dragover', (e) => {
        e.preventDefault();
        cell.classList.add('drag-over');
      });
      cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
      cell.addEventListener('drop', (e) => {
        e.preventDefault();
        cell.classList.remove('drag-over');
        handleDrop(e, key);
      });

      grid.appendChild(cell);
    }
  }

  renderStudentSidebar();
}

/** 자리 성별 제한 순환 (any → male → female → any) */
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

/** 교체 모드 클릭 처리 */
function handleSwapClick(clickedKey) {
  const cls = getCurrentClass();
  if (!cls) return;

  if (!swapFirstKey) {
    // 빈 자리 클릭이면 무시
    if (!cls.seats[clickedKey]) {
      showToast('학생이 있는 자리를 선택하세요.', 'warning');
      return;
    }
    swapFirstKey = clickedKey;
    renderSeating();
    const sName = cls.students.find(s => s.id === cls.seats[clickedKey])?.name || '';
    showToast(`"${sName}" 선택됨. 두 번째 자리를 클릭하세요.`, 'default');
  } else {
    if (clickedKey === swapFirstKey) {
      // 같은 자리 재클릭 → 취소
      swapFirstKey = null;
      renderSeating();
      showToast('선택이 취소되었습니다.');
      return;
    }
    // 두 자리 교환
    const temp = cls.seats[swapFirstKey];
    if (cls.seats[clickedKey]) {
      cls.seats[swapFirstKey] = cls.seats[clickedKey];
    } else {
      delete cls.seats[swapFirstKey];
    }
    if (temp) {
      cls.seats[clickedKey] = temp;
    } else {
      delete cls.seats[clickedKey];
    }
    saveState();
    const key1 = swapFirstKey;
    swapFirstKey = null;
    renderSeating();
    showToast('자리가 교체되었습니다! 🔄', 'success');
  }
}

/** 드롭 처리 */
function handleDrop(e, targetKey) {
  const studentId = e.dataTransfer.getData('studentId');
  const source = e.dataTransfer.getData('source');
  const sourceKey = e.dataTransfer.getData('sourceKey');
  const cls = getCurrentClass();
  if (!cls || !studentId) return;

  const targetStudentId = cls.seats[targetKey];

  if (source === 'seat' && sourceKey) {
    if (targetStudentId) {
      cls.seats[sourceKey] = targetStudentId;
      cls.seats[targetKey] = studentId;
      showToast('자리가 교환되었습니다.');
    } else {
      delete cls.seats[sourceKey];
      cls.seats[targetKey] = studentId;
      showToast('자리가 이동되었습니다.');
    }
  } else if (source === 'unassigned') {
    Object.keys(cls.seats).forEach(k => {
      if (cls.seats[k] === studentId) delete cls.seats[k];
    });
    cls.seats[targetKey] = studentId;
    const sName = cls.students.find(s => s.id === studentId)?.name || '';
    showToast(`${sName}이(가) 배치되었습니다.`, 'success');
  }

  saveState();
  renderSeating();
}

/** 자리 배치 이력 백업 (되돌리기용) */
function backupSeats() {
  const cls = getCurrentClass();
  if (!cls) return;
  seatsHistory.push(JSON.parse(JSON.stringify(cls.seats)));
  // 이력은 최대 10개만 보관
  if (seatsHistory.length > 10) seatsHistory.shift();
}

/** 자리 배치 되돌리기 */
function undoSeats() {
  const cls = getCurrentClass();
  if (!cls) return;
  if (seatsHistory.length === 0) {
    showToast('되돌릴 배치 이력이 없습니다.', 'warning');
    return;
  }
  cls.seats = seatsHistory.pop();
  saveState();
  renderSeating();
  showToast('↩ 이전 자리 배치로 되돌렸습니다!', 'success');
}

/** ★ 스마트 자동 배치 (행별 남여/여남 교차 패턴) */
function smartAutoArrange() {
  const cls = getCurrentClass();
  if (!cls) return;
  if (cls.students.length === 0) { showToast('학생을 먼저 추가하세요.', 'error'); return; }

  if (!confirm(`${cls.students.length}명을 성별에 맞게 자동 배치하시겠습니까?\n(1행: 남여남여, 2행: 여남여남, 3행: 남여남여... 패턴)`)) return;

  // 배치 전 현재 상태 백업 (되돌리기용)
  backupSeats();

  // 1. 준비: 성별별 학생 풀 (랜덤화)
  let males = shuffleArray(cls.students.filter(s => s.gender === 'male').map(s => s.id));
  let females = shuffleArray(cls.students.filter(s => s.gender === 'female').map(s => s.id));
  let neutral = shuffleArray(cls.students.filter(s => !s.gender || (s.gender !== 'male' && s.gender !== 'female')).map(s => s.id));

  // 2. 자리 분류 (성별 지정석)
  const maleSeats = [], femaleSeats = [];
  for (let r = 0; r < cls.gridRows; r++) {
    for (let c = 0; c < cls.gridCols; c++) {
      const key = `${r}-${c}`;
      const g = (cls.seatGenders || {})[key] || 'any';
      if (g === 'male') maleSeats.push(key);
      else if (g === 'female') femaleSeats.push(key);
    }
  }

  const newSeats = {};

  function assign(key, pool) {
    if (pool.length > 0) {
      const id = pool.shift();
      newSeats[key] = id;
      return true;
    }
    return false;
  }

  // 3. 지정석 먼저 배치
  maleSeats.forEach(key => assign(key, males));
  femaleSeats.forEach(key => assign(key, females));

  // 4. 칠판쪽(큰 행 번호)부터, 행별 남여/여남 교차 패턴
  //    교사 시점 기준 칠판이 아래(큰 row)이므로 역순으로 진행
  for (let r = cls.gridRows - 1; r >= 0; r--) {
    // 짝수 행(칠판에서 1번째, 3번째...)은 남→여, 홀수 행은 여→남
    const rowIndex = cls.gridRows - 1 - r; // 칠판에서 몇 번째 행인지
    const startMale = (rowIndex % 2 === 0); // 0번째(칠판 바로 앞)는 남→여
    
    for (let c = 0; c < cls.gridCols; c++) {
      const key = `${r}-${c}`;
      if (newSeats[key]) continue; // 이미 지정석으로 배치된 자리
      const sg = (cls.seatGenders || {})[key] || 'any';
      if (sg !== 'any') continue; // 성별 제한 자리는 위에서 처리 완료

      const colToggle = (c % 2 === 0); // 열 내 교차
      const wantMale = startMale ? colToggle : !colToggle;

      if (wantMale) {
        assign(key, males) || assign(key, females) || assign(key, neutral);
      } else {
        assign(key, females) || assign(key, males) || assign(key, neutral);
      }
    }
  }

  // 5. 혹시 남은 학생이 있으면 빈자리에 순차 배치
  const allRemaining = [...males, ...females, ...neutral];
  for (let r = cls.gridRows - 1; r >= 0; r--) {
    for (let c = 0; c < cls.gridCols; c++) {
      const key = `${r}-${c}`;
      if (!newSeats[key] && allRemaining.length > 0) {
        newSeats[key] = allRemaining.shift();
      }
    }
  }

  cls.seats = newSeats;
  saveState();
  renderSeating();
  showToast('✨ 성별 교차 배치가 완료되었습니다! (1행:남여, 2행:여남...)', 'success');
}

// ── 랜덤 뽑기 ──
function openRandomModal() {
  const cls = getCurrentClass();
  if (!cls || cls.students.length === 0) {
    showToast('학생을 먼저 추가해 주세요.', 'error');
    return;
  }
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

// ── 모드 상태 표시 업데이트 ──
function updateModeStatus() {
  const badge = document.getElementById('modeStatus');
  if (!badge) return;
  if (genderModeActive) {
    badge.textContent = '⚥ 성별 자리 설정 모드 활성';
    badge.className = 'mode-status-badge mode-gender';
  } else if (swapModeActive) {
    badge.textContent = swapFirstKey ? '🔄 두 번째 자리 선택 중...' : '🔄 교체 모드 – 첫 번째 학생 선택';
    badge.className = 'mode-status-badge mode-swap';
  } else {
    badge.textContent = '';
    badge.className = 'mode-status-badge';
  }
}

// ── 자리 배치도 UI 이벤트 ──
document.addEventListener('DOMContentLoaded', () => {
  // 드래그 상태 추적
  document.addEventListener('dragstart', () => window._isDragging = true);
  document.addEventListener('dragend', () => setTimeout(() => window._isDragging = false, 100));

  // 번호 표시 토글
  const toggleShowNumbers = document.getElementById('toggleShowNumbers');
  if (toggleShowNumbers) {
    toggleShowNumbers.addEventListener('change', () => {
      renderSeating();
    });
  }

  // 성별 자리 설정 모드 토글
  const btnGenderMode = document.getElementById('btnGenderMode');
  if (btnGenderMode) {
    btnGenderMode.addEventListener('click', () => {
      genderModeActive = !genderModeActive;
      swapModeActive = false;
      swapFirstKey = null;
      const btn = document.getElementById('btnGenderMode');
      const swapBtn = document.getElementById('btnSwapMode');
      if (btn) btn.classList.toggle('mode-btn-active', genderModeActive);
      if (swapBtn) swapBtn.classList.remove('mode-btn-active');
      updateModeStatus();
      renderSeating();
      if (genderModeActive) {
        showToast('⚥ 성별 자리 설정 모드: 빈 자리를 클릭하면 성별 제한이 순환됩니다.', 'default', 4000);
      }
    });
  }

  // 교체 모드 토글
  const btnSwapMode = document.getElementById('btnSwapMode');
  if (btnSwapMode) {
    btnSwapMode.addEventListener('click', () => {
      swapModeActive = !swapModeActive;
      genderModeActive = false;
      swapFirstKey = null;
      const btn = document.getElementById('btnSwapMode');
      const genderBtn = document.getElementById('btnGenderMode');
      if (btn) btn.classList.toggle('mode-btn-active', swapModeActive);
      if (genderBtn) genderBtn.classList.remove('mode-btn-active');
      updateModeStatus();
      renderSeating();
      if (swapModeActive) {
        showToast('🔄 교체 모드: 학생 두 명을 순서대로 클릭하면 자리가 바뀝니다.', 'default', 4000);
      }
    });
  }

  // 스마트 배치 버튼
  const btnSmartArrange = document.getElementById('btnSmartArrange');
  if (btnSmartArrange) btnSmartArrange.addEventListener('click', smartAutoArrange);

  // 랜덤 배치 버튼
  const btnShuffleSeats = document.getElementById('btnShuffleSeats');
  if (btnShuffleSeats) {
    btnShuffleSeats.addEventListener('click', () => {
      const cls = getCurrentClass();
      if (!cls) return;
      if (cls.students.length === 0) { showToast('학생을 먼저 추가하세요.', 'error'); return; }
      if (!confirm('학생들의 자리를 무작위로 배치하시겠습니까?')) return;
      
      // 배치 전 현재 상태 백업 (되돌리기용)
      backupSeats();
      
      const students = shuffleArray([...cls.students]);
      cls.seats = {};
      
      // 칠판쪽(큰 행 번호)부터 채우기 위해 역순으로 키 수집
      let availableKeys = [];
      for (let r = cls.gridRows - 1; r >= 0; r--) {
        for (let c = 0; c < cls.gridCols; c++) {
          availableKeys.push(`${r}-${c}`);
        }
      }
      
      // 학생 수만큼만 잘라냄
      availableKeys = availableKeys.slice(0, students.length);
      
      students.forEach((s, i) => {
        if (i < availableKeys.length) {
          cls.seats[availableKeys[i]] = s.id;
        }
      });

      saveState();
      renderSeating();
      showToast('자리가 칠판쪽부터 무작위로 배치되었습니다! 🎲', 'success');
    });
  }

  // 되돌리기 버튼
  const btnUndoSeating = document.getElementById('btnUndoSeating');
  if (btnUndoSeating) btnUndoSeating.addEventListener('click', undoSeats);

  // 랜덤 뽑기 버튼
  const btnRandom = document.getElementById('btnRandom');
  if (btnRandom) {
    btnRandom.addEventListener('click', openRandomModal);
  }

  const btnCloseRandom = document.getElementById('btnCloseRandom');
  if (btnCloseRandom) {
    btnCloseRandom.addEventListener('click', () => {
      const modal = document.getElementById('randomModal');
      if (modal) modal.classList.add('hidden');
      clearInterval(window._spinInterval);
    });
  }

  const btnStartRandom = document.getElementById('btnStartRandom');
  if (btnStartRandom) btnStartRandom.addEventListener('click', startRandom);

  const btnPickAgain = document.getElementById('btnPickAgain');
  if (btnPickAgain) {
    btnPickAgain.addEventListener('click', () => {
      const result = document.getElementById('randomResult');
      const spinner = document.getElementById('randomSpinner');
      const startBtn = document.getElementById('btnStartRandom');
      if (result) result.classList.add('hidden');
      if (spinner) spinner.textContent = '?';
      if (startBtn) startBtn.classList.remove('hidden');
      if (btnPickAgain) btnPickAgain.classList.add('hidden');
      startRandom();
    });
  }
});

// ── 자리 배치도 뱃지 단일 갱신 함수 (attendance.js, behavior.js 에서 호출) ──
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

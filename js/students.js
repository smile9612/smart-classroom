/* ==========================================
   students.js - 학생 명단 CRUD (성별 포함)
   버그 수정: 번호 1,3,5... → 1,2,3 정상화
   ========================================== */

/** 학생 추가 (단일) */
function addStudent(name, number, gender) {
  const cls = getCurrentClass();
  if (!cls) return null;
  if (!name.trim()) return null;

  // 중복 이름 체크
  if (cls.students.some(s => s.name === name.trim())) {
    showToast(`"${name.trim()}"은(는) 이미 있는 학생입니다.`, 'error');
    return null;
  }

  const student = {
    id: generateId(),
    name: name.trim(),
    number: number || (cls.students.length + 1),
    gender: gender || 'male', // 기본값 '남'
  };
  cls.students.push(student);
  cls.students.sort((a, b) => a.number - b.number);
  saveState();
  return student;
}

/** 학생 삭제 */
function deleteStudent(studentId) {
  const cls = getCurrentClass();
  if (!cls) return;
  cls.students = cls.students.filter(s => s.id !== studentId);
  Object.keys(cls.seats).forEach(key => {
    if (cls.seats[key] === studentId) delete cls.seats[key];
  });
  saveState();
  renderSeating();
  renderStudentSidebar();
  showToast('학생이 삭제되었습니다.', 'warning');
}

/** 학생 성별 직접 설정 */
function setStudentGender(studentId, gender) {
  const cls = getCurrentClass();
  if (!cls) return;
  const student = cls.students.find(s => s.id === studentId);
  if (!student) return;
  student.gender = gender;
  saveState();
  renderStudentSidebar();
  renderSeating();
}

/** 학생 명단 사이드바 렌더링 */
function renderStudentSidebar() {
  const cls = getCurrentClass();
  const allList = document.getElementById('allStudentList');
  const unassignedList = document.getElementById('unassignedList');
  const countBadge = document.getElementById('studentCount');

  if (!cls) {
    allList.innerHTML = '<div class="empty-state">학급을 선택하세요.</div>';
    unassignedList.innerHTML = '';
    countBadge.textContent = '0명';
    return;
  }

  const showNums = document.getElementById('toggleShowNumbers')?.checked !== false;
  countBadge.textContent = `${cls.students.length}명`;

  // 미배정 학생 목록
  const assignedIds = new Set(Object.values(cls.seats));
  const unassigned = cls.students.filter(s => !assignedIds.has(s.id));

  unassignedList.innerHTML = '';
  if (unassigned.length === 0) {
    unassignedList.innerHTML = '<span style="color:var(--text-muted);font-size:0.82rem;">모든 학생이 배치되었습니다.</span>';
  } else {
    unassigned.forEach(student => {
      const chip = document.createElement('div');
      const gClass = student.gender === 'male' ? 'chip-male' : student.gender === 'female' ? 'chip-female' : '';
      chip.className = `unassigned-chip ${gClass}`;
      const gIcon = student.gender === 'male' ? '♂' : student.gender === 'female' ? '♀' : '';
      chip.innerHTML = `${gIcon ? `<span class="chip-gender-icon">${gIcon}</span>` : ''}${student.name}`;
      chip.draggable = true;
      chip.dataset.studentId = student.id;

      chip.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('studentId', student.id);
        e.dataTransfer.setData('source', 'unassigned');
        chip.classList.add('dragging');
      });
      chip.addEventListener('dragend', () => chip.classList.remove('dragging'));
      unassignedList.appendChild(chip);
    });
  }

  // 전체 명단
  allList.innerHTML = '';
  if (cls.students.length === 0) {
    allList.innerHTML = '<div class="empty-state"><div class="empty-icon">👤</div>학생을 추가해 주세요.</div>';
    return;
  }
  cls.students.forEach(student => {
    const item = document.createElement('div');
    item.className = 'student-list-item';
    
    item.innerHTML = `
      ${showNums ? `<span class="student-num-tag">${student.number}</span>` : ''}
      <span class="student-name-tag">${student.name}</span>
      <div class="gender-btn-group">
        <button class="btn-gender-select ${student.gender === 'male' ? 'active male' : ''}" 
                onclick="setStudentGender('${student.id}', 'male')">남</button>
        <button class="btn-gender-select ${student.gender === 'female' ? 'active female' : ''}" 
                onclick="setStudentGender('${student.id}', 'female')">여</button>
      </div>
      <button class="btn-delete-student" onclick="confirmDeleteStudent('${student.id}', '${student.name}')">✕</button>
    `;
    allList.appendChild(item);
  });
}

/** 학생 삭제 확인 */
function confirmDeleteStudent(studentId, name) {
  if (!confirm(`"${name}" 학생을 삭제하시겠습니까?\n(행동 및 출결 기록은 유지됩니다.)`)) return;
  deleteStudent(studentId);
}

/** CSV/텍스트 일괄 추가 - 번호 버그 수정 버전 */
function bulkAddStudents(text) {
  const cls = getCurrentClass();
  if (!cls) return 0;

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let added = 0;
  let skipped = 0;
  // ★ 버그 수정: 루프 시작 전에 기존 학생 수를 저장
  const initialCount = cls.students.length;

  lines.forEach(line => {
    // "번호,이름,성별" 또는 "번호,이름" 또는 "이름" 형식 지원
    const parts = line.split(',').map(p => p.trim());
    let name, number, gender = '';

    if (parts.length >= 2 && !isNaN(parts[0])) {
      number = parseInt(parts[0]);
      name = parts[1];
      // 성별 파싱 (남/여/M/F/male/female)
      const gRaw = (parts[2] || '').toLowerCase();
      if (gRaw === '남' || gRaw === 'm' || gRaw === 'male') gender = 'male';
      else if (gRaw === '여' || gRaw === 'f' || gRaw === 'female') gender = 'female';
      else gender = 'male'; // 기본값 남학생
    } else {
      name = parts[0];
      // ★ 버그 수정: initialCount + added + 1 로 계산 (cls.students.length 사용 금지)
      number = initialCount + added + 1;
      gender = 'male'; // 번호/이름 형식이 아닐 때도 기본값 남학생
    }

    if (name && !cls.students.some(s => s.name === name)) {
      const student = { id: generateId(), name, number, gender };
      cls.students.push(student);
      added++;
    } else {
      skipped++;
    }
  });

  cls.students.sort((a, b) => a.number - b.number);
  saveState();
  renderSeating();
  renderStudentSidebar();

  let msg = `${added}명이 추가되었습니다.`;
  if (skipped > 0) msg += ` (${skipped}명 중복 건너뜀)`;
  showToast(msg, added > 0 ? 'success' : 'warning');
  return added;
}

// ── 학생 추가 UI 이벤트 ──
document.addEventListener('DOMContentLoaded', () => {

  // 학생 단일 추가
  document.getElementById('btnAddStudent').addEventListener('click', () => {
    const nameInput = document.getElementById('inputStudentName');
    const numInput = document.getElementById('inputStudentNum');
    const genderSel = document.getElementById('inputStudentGender');
    const name = nameInput.value.trim();
    const num = parseInt(numInput.value) || null;
    const gender = genderSel ? genderSel.value : '';

    if (!name) { showToast('이름을 입력하세요.', 'error'); nameInput.focus(); return; }

    const student = addStudent(name, num, gender);
    if (student) {
      nameInput.value = '';
      numInput.value = '';
      if (genderSel) genderSel.value = '';
      nameInput.focus();
      renderSeating();
      renderStudentSidebar();
      showToast(`${student.name} 학생이 추가되었습니다.`, 'success');
    }
  });

  // Enter키로 추가
  document.getElementById('inputStudentName').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btnAddStudent').click();
  });

  // 일괄 입력 토글
  document.getElementById('btnToggleBulk').addEventListener('click', () => {
    document.getElementById('bulkInputArea').classList.toggle('hidden');
  });

  // 일괄 추가 실행
  document.getElementById('btnBulkAdd').addEventListener('click', () => {
    const text = document.getElementById('bulkTextarea').value;
    if (!text.trim()) { showToast('내용을 입력하세요.', 'error'); return; }
    const added = bulkAddStudents(text);
    if (added > 0) {
      document.getElementById('bulkTextarea').value = '';
      document.getElementById('bulkInputArea').classList.add('hidden');
    }
  });
});

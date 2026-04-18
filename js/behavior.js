/* ==========================================
   behavior.js - 원클릭 행동 기록 모듈
   ========================================== */

// 현재 열린 모달의 학생 ID
let currentModalStudentId = null;

/** 행동 기록 모달 열기 */
function openBehaviorModal(studentId) {
  const cls = getCurrentClass();
  if (!cls) return;
  const student = cls.students.find(s => s.id === studentId);
  if (!student) return;

  currentModalStudentId = studentId;

  // 제목 및 날짜 설정
  document.getElementById('modalStudentName').textContent = `${student.number}번 ${student.name}`;
  document.getElementById('modalDate').textContent = `📅 ${formatDate(todayStr())}`;

  // 오늘 출결 상태 버튼 활성화
  const today = todayStr();
  const attRecord = appState.attendance.find(
    a => a.studentId === studentId && a.classId === cls.id && a.date === today
  );
  const currentStatus = attRecord ? attRecord.status : 'present';
  document.querySelectorAll('.att-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.status === currentStatus);
  });

  // 긍정 행동 버튼 생성
  const posContainer = document.getElementById('positiveBtns');
  posContainer.innerHTML = '';
  BEHAVIOR_TYPES.positive.forEach(bType => {
    const btn = document.createElement('button');
    btn.className = 'beh-btn positive';
    btn.innerHTML = `${bType.emoji} ${bType.label}`;
    btn.addEventListener('click', () => {
      saveBehavior(studentId, 'positive', bType.label, bType.emoji);
      btn.classList.add('clicked');
      setTimeout(() => btn.classList.remove('clicked'), 300);
      showToast(`✅ ${bType.label} 기록됨`, 'success');
      renderRecentRecords(studentId);
      // 자리 배치도 점 업데이트
      updateBehaviorDots(studentId);
    });
    posContainer.appendChild(btn);
  });

  // 부정/개선 행동 버튼 생성
  const negContainer = document.getElementById('negativeBtns');
  negContainer.innerHTML = '';
  BEHAVIOR_TYPES.negative.forEach(bType => {
    const btn = document.createElement('button');
    btn.className = 'beh-btn negative';
    btn.innerHTML = `${bType.emoji} ${bType.label}`;
    btn.addEventListener('click', () => {
      saveBehavior(studentId, 'negative', bType.label, bType.emoji);
      btn.classList.add('clicked');
      setTimeout(() => btn.classList.remove('clicked'), 300);
      showToast(`⚠️ ${bType.label} 기록됨`, 'warning');
      renderRecentRecords(studentId);
      updateBehaviorDots(studentId);
    });
    negContainer.appendChild(btn);
  });

  // 메모 초기화
  document.getElementById('behaviorNote').value = '';

  // 최근 기록 표시
  renderRecentRecords(studentId);

  // 모달 열기
  document.getElementById('behaviorModal').classList.remove('hidden');
}

/** 행동 기록 저장 */
function saveBehavior(studentId, type, label, emoji = '') {
  const cls = getCurrentClass();
  if (!cls) return;

  const record = {
    id: generateId(),
    studentId,
    classId: cls.id,
    date: todayStr(),
    time: new Date().toTimeString().slice(0, 5),
    type,   // 'positive' | 'negative' | 'note'
    label,
    emoji,
    note: '',
  };
  appState.behaviors.push(record);
  saveState();
}

/** 최근 기록 렌더링 */
function renderRecentRecords(studentId) {
  const cls = getCurrentClass();
  if (!cls) return;
  const container = document.getElementById('recentRecords');

  // 최근 30일 기록을 최신순으로
  const records = appState.behaviors
    .filter(b => b.studentId === studentId && b.classId === cls.id)
    .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))
    .slice(0, 10);

  if (records.length === 0) {
    container.innerHTML = '<div class="empty-state">기록이 없습니다.</div>';
    return;
  }

  container.innerHTML = records.map(r => `
    <div class="record-item">
      <span class="record-date">${formatDate(r.date)} ${r.time || ''}</span>
      <span class="type-badge ${r.type === 'positive' ? 'type-positive' : r.type === 'negative' ? 'type-negative' : 'type-note'}">
        ${r.emoji || ''} ${r.label}
      </span>
      ${r.note ? `<span class="record-note">${r.note}</span>` : ''}
      <button class="btn-delete-record" onclick="deleteBehaviorRecord('${r.id}', '${studentId}')">✕</button>
    </div>
  `).join('');
}

/** 행동 기록 삭제 */
function deleteBehaviorRecord(recordId, studentId) {
  appState.behaviors = appState.behaviors.filter(b => b.id !== recordId);
  saveState();
  renderRecentRecords(studentId);
  updateBehaviorDots(studentId);
  showToast('기록이 삭제되었습니다.');
}

/** 자리 배치도의 행동 기록 점 업데이트 */
function updateBehaviorDots(studentId) {
  const card = document.querySelector(`.student-card[data-student-id="${studentId}"]`);
  if (!card) return;
  const existingDots = card.querySelector('.behavior-dots');
  if (existingDots) existingDots.remove();
  const behaviors = getStudentBehaviorsToday(studentId);
  const dotsHtml = getBehaviorDotsHtml(behaviors);
  if (dotsHtml) card.insertAdjacentHTML('beforeend', dotsHtml);
}

/** 행동 기록 테이블 렌더링 (탭3) */
function renderBehaviorTable() {
  const cls = getCurrentClass();
  const container = document.getElementById('behaviorTable');
  const filterStudent = document.getElementById('filterStudent');
  const filterBehavior = document.getElementById('filterBehavior');

  // 필터 드롭다운 학생 목록 갱신
  const currentStudentFilter = filterStudent.value;
  filterStudent.innerHTML = '<option value="">전체 학생</option>';
  if (cls) {
    cls.students.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `${s.number}번 ${s.name}`;
      if (s.id === currentStudentFilter) opt.selected = true;
      filterStudent.appendChild(opt);
    });
  }

  // 행동 유형 필터 갱신
  const currentBehFilter = filterBehavior.value;
  filterBehavior.innerHTML = '<option value="">전체 행동</option>';
  const allTypes = [...BEHAVIOR_TYPES.positive, ...BEHAVIOR_TYPES.negative];
  allTypes.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.label;
    opt.textContent = `${t.emoji} ${t.label}`;
    if (t.label === currentBehFilter) opt.selected = true;
    filterBehavior.appendChild(opt);
  });

  if (!cls) {
    container.innerHTML = '<div class="empty-state">학급을 선택하세요.</div>';
    return;
  }

  // 필터 적용
  const sFilter = filterStudent.value;
  const bFilter = filterBehavior.value;
  const dateFrom = document.getElementById('filterDateFrom').value;
  const dateTo = document.getElementById('filterDateTo').value;

  let records = appState.behaviors.filter(b => b.classId === cls.id);
  if (sFilter) records = records.filter(b => b.studentId === sFilter);
  if (bFilter) records = records.filter(b => b.label === bFilter);
  if (dateFrom) records = records.filter(b => b.date >= dateFrom);
  if (dateTo) records = records.filter(b => b.date <= dateTo);

  // 최신순 정렬
  records.sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));

  if (records.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📝</div>기록이 없습니다.</div>';
    return;
  }

  const studentMap = {};
  cls.students.forEach(s => studentMap[s.id] = s);

  container.innerHTML = `
    <table class="behavior-table">
      <thead>
        <tr>
          <th>날짜</th>
          <th>시간</th>
          <th>번호</th>
          <th>이름</th>
          <th>유형</th>
          <th>행동</th>
          <th>메모</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${records.map(r => {
          const student = studentMap[r.studentId];
          const sName = student ? student.name : '(삭제된 학생)';
          const sNum = student ? student.number : '-';
          return `
            <tr>
              <td>${formatDate(r.date)}</td>
              <td>${r.time || '-'}</td>
              <td>${sNum}</td>
              <td>${sName}</td>
              <td>
                <span class="type-badge ${r.type === 'positive' ? 'type-positive' : r.type === 'negative' ? 'type-negative' : 'type-note'}">
                  ${r.type === 'positive' ? '긍정' : r.type === 'negative' ? '개선' : '메모'}
                </span>
              </td>
              <td>${r.emoji || ''} ${r.label}</td>
              <td>${r.note || '-'}</td>
              <td>
                <button class="btn-delete-record" onclick="deleteBehaviorFromTable('${r.id}')">✕</button>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

/** 테이블에서 행동 기록 삭제 */
function deleteBehaviorFromTable(recordId) {
  appState.behaviors = appState.behaviors.filter(b => b.id !== recordId);
  saveState();
  renderBehaviorTable();
  showToast('기록이 삭제되었습니다.');
}

// ── 행동 기록 UI 이벤트 ──
document.addEventListener('DOMContentLoaded', () => {
  // 모달 닫기
  document.getElementById('btnCloseModal').addEventListener('click', () => {
    document.getElementById('behaviorModal').classList.add('hidden');
    currentModalStudentId = null;
  });

  // 출결 버튼 (모달 내)
  document.querySelectorAll('.att-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!currentModalStudentId) return;
      const cls = getCurrentClass();
      if (!cls) return;
      const status = btn.dataset.status;
      setAttendance(currentModalStudentId, cls.id, todayStr(), status);
      document.querySelectorAll('.att-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateSeatAttendanceBadge(currentModalStudentId, status);
      showToast(`출결 상태: ${ATTENDANCE_STATUS[status].label}`, 'success');
    });
  });

  // 메모 저장
  document.getElementById('btnSaveNote').addEventListener('click', () => {
    if (!currentModalStudentId) return;
    const note = document.getElementById('behaviorNote').value.trim();
    if (!note) { showToast('메모 내용을 입력하세요.', 'error'); return; }

    const cls = getCurrentClass();
    if (!cls) return;
    const record = {
      id: generateId(),
      studentId: currentModalStudentId,
      classId: cls.id,
      date: todayStr(),
      time: new Date().toTimeString().slice(0, 5),
      type: 'note',
      label: '메모',
      emoji: '📝',
      note,
    };
    appState.behaviors.push(record);
    saveState();
    document.getElementById('behaviorNote').value = '';
    renderRecentRecords(currentModalStudentId);
    showToast('메모가 저장되었습니다.', 'success');
  });

  // 행동 기록 조회 버튼
  document.getElementById('btnFilterBehavior').addEventListener('click', renderBehaviorTable);

  // 나이스용 복사
  document.getElementById('btnCopyNeis').addEventListener('click', copyNeisText);

  // CSV 내보내기
  document.getElementById('btnExportBehavior').addEventListener('click', () => {
    const cls = getCurrentClass();
    if (!cls) return;
    exportBehaviorCsv(cls);
  });

  // 일괄 기록 버튼
  document.getElementById('btnBulkMode').addEventListener('click', toggleBulkMode);
  document.getElementById('btnCloseBulkBar').addEventListener('click', toggleBulkMode);
  document.getElementById('btnSelectAll').addEventListener('click', bulkSelectAll);
  document.getElementById('btnClearSelection').addEventListener('click', bulkClearSelection);
  
  // 일괄 메모 저장 버튼
  const btnBulkMemo = document.getElementById('btnBulkSaveMemo');
  if (btnBulkMemo) {
    btnBulkMemo.addEventListener('click', saveBulkMemo);
  }
});

/** 일괄 기록 모드 토글 */
function toggleBulkMode() {
  appState.isBulkMode = !appState.isBulkMode;
  document.body.classList.toggle('bulk-mode-active', appState.isBulkMode);
  
  const bar = document.getElementById('bulkActionBar');
  const btn = document.getElementById('btnBulkMode');
  
  if (appState.isBulkMode) {
    bar.classList.remove('hidden');
    btn.classList.add('mode-btn-active');
    renderBulkActionButtons();
    showToast('✅ 일괄 기록 모드: 학생들을 클릭하여 선택한 후 하단 버튼을 누르세요.', 'info');
  } else {
    bar.classList.add('hidden');
    btn.classList.remove('mode-btn-active');
    bulkClearSelection();
    showToast('일괄 기록 모드가 종료되었습니다.');
  }
  renderSeating();
}

/** 일괄 선택 클릭 처리 */
function handleBulkClick(studentId) {
  const idx = appState.selectedStudentIds.indexOf(studentId);
  if (idx > -1) {
    appState.selectedStudentIds.splice(idx, 1);
  } else {
    appState.selectedStudentIds.push(studentId);
  }
  updateBulkCount();
  renderSeating();
}

/** 선택 인원 표시 업데이트 */
function updateBulkCount() {
  document.getElementById('selectedCount').textContent = appState.selectedStudentIds.length;
}

/** 전체 선택 */
function bulkSelectAll() {
  const cls = getCurrentClass();
  if (!cls) return;
  appState.selectedStudentIds = cls.students.map(s => s.id);
  updateBulkCount();
  renderSeating();
}

/** 선택 해제 */
function bulkClearSelection() {
  appState.selectedStudentIds = [];
  updateBulkCount();
  renderSeating();
}

/** 일괄 기록 버튼 생성 */
function renderBulkActionButtons() {
  const posCont = document.getElementById('bulkPositiveBtns');
  const negCont = document.getElementById('bulkNegativeBtns');
  posCont.innerHTML = '';
  negCont.innerHTML = '';

  BEHAVIOR_TYPES.positive.forEach(b => {
    const btn = document.createElement('button');
    btn.className = 'bulk-beh-btn';
    btn.textContent = `${b.emoji} ${b.label}`;
    btn.onclick = () => saveBulkBehavior('positive', b.label, b.emoji);
    posCont.appendChild(btn);
  });

  BEHAVIOR_TYPES.negative.forEach(b => {
    const btn = document.createElement('button');
    btn.className = 'bulk-beh-btn';
    btn.textContent = `${b.emoji} ${b.label}`;
    btn.onclick = () => saveBulkBehavior('negative', b.label, b.emoji);
    negCont.appendChild(btn);
  });
}

/** 일괄 저장 실행 */
function saveBulkBehavior(type, label, emoji) {
  if (appState.selectedStudentIds.length === 0) {
    showToast('선택된 학생이 없습니다.', 'error');
    return;
  }

  if (!confirm(`${appState.selectedStudentIds.length}명에게 일괄 기록하시겠습니까?\n(${label})`)) return;

  appState.selectedStudentIds.forEach(sid => {
    saveBehavior(sid, type, label, emoji);
    updateBehaviorDots(sid);
  });

  showToast(`✅ ${appState.selectedStudentIds.length}명에게 일괄 기록 완료!`, 'success');
  bulkClearSelection();
}

/** 일괄 메모 저장 */
function saveBulkMemo() {
  if (appState.selectedStudentIds.length === 0) {
    showToast('선택된 학생이 없습니다.', 'error');
    return;
  }
  const memoInput = document.getElementById('bulkMemoInput');
  const memo = memoInput ? memoInput.value.trim() : '';
  if (!memo) {
    showToast('메모 내용을 입력하세요.', 'error');
    return;
  }
  
  if (!confirm(`${appState.selectedStudentIds.length}명에게 메모를 일괄 저장하시겠습니까?\n"📝 ${memo}"`)) return;
  
  const cls = getCurrentClass();
  if (!cls) return;
  
  appState.selectedStudentIds.forEach(sid => {
    const record = {
      id: generateId(),
      studentId: sid,
      classId: cls.id,
      date: todayStr(),
      time: new Date().toTimeString().slice(0, 5),
      type: 'note',
      label: '메모',
      emoji: '📝',
      note: memo,
    };
    appState.behaviors.push(record);
    updateBehaviorDots(sid);
  });
  
  saveState();
  memoInput.value = '';
  showToast(`📝 ${appState.selectedStudentIds.length}명에게 메모 일괄 저장 완료!`, 'success');
  bulkClearSelection();
}

/** 나이스 입력용 텍스트 복사 */
function copyNeisText() {
  const cls = getCurrentClass();
  if (!cls) return;
  const filterStudentId = document.getElementById('filterStudent').value;

  let records = appState.behaviors.filter(b => b.classId === cls.id && b.type !== 'note');
  if (filterStudentId) records = records.filter(b => b.studentId === filterStudentId);

  if (records.length === 0) {
    showToast('복사할 기록이 없습니다.', 'error');
    return;
  }

  const studentMap = {};
  cls.students.forEach(s => studentMap[s.id] = s);

  // 학생별 그룹화
  const grouped = {};
  records.forEach(r => {
    if (!grouped[r.studentId]) grouped[r.studentId] = { positive: [], negative: [] };
    grouped[r.studentId][r.type].push(r.label);
  });

  let text = '';
  Object.entries(grouped).forEach(([sid, data]) => {
    const s = studentMap[sid];
    if (!s) return;
    text += `[${s.number}번 ${s.name}]\n`;
    if (data.positive.length > 0) {
      text += `- 우수: ${[...new Set(data.positive)].join(', ')}\n`;
    }
    if (data.negative.length > 0) {
      text += `- 개선: ${[...new Set(data.negative)].join(', ')}\n`;
    }
    text += '\n';
  });

  navigator.clipboard.writeText(text).then(() => {
    showToast('나이스 입력용 텍스트가 복사되었습니다.', 'success');
  });
}

/** 행동 기록 CSV 내보내기 */
function exportBehaviorCsv(cls) {
  let records = appState.behaviors.filter(b => b.classId === cls.id);
  const sFilter = document.getElementById('filterStudent').value;
  const bFilter = document.getElementById('filterBehavior').value;
  if (sFilter) records = records.filter(b => b.studentId === sFilter);
  if (bFilter) records = records.filter(b => b.label === bFilter);

  const studentMap = {};
  cls.students.forEach(s => studentMap[s.id] = s);

  let csv = '날짜,번호,이름,유형,행동,메모\n';
  records.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  records.forEach(r => {
    const s = studentMap[r.studentId];
    const sNum = s ? s.number : '-';
    const sName = s ? s.name : '삭제된학생';
    const type = r.type === 'positive' ? '긍정' : r.type === 'negative' ? '개선' : '메모';
    csv += `${r.date},${sNum},"${sName}","${type}","${r.label}","${r.note || ''}"\n`;
  });
  downloadCsv(csv, `행동기록_${cls.name}.csv`);
  showToast('행동 기록 CSV가 다운로드되었습니다.', 'success');
}

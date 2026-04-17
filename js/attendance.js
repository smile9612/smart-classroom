/* ==========================================
   attendance.js - 출결 관리 모듈
   ========================================== */

/** 특정 날짜 학생 출결 데이터 가져오기 */
function getAttendanceForDate(classId, date) {
  return appState.attendance.filter(a => a.classId === classId && a.date === date);
}

/** 출결 상태 저장/업데이트 */
function setAttendance(studentId, classId, date, status, reason = '') {
  const existing = appState.attendance.findIndex(
    a => a.studentId === studentId && a.classId === classId && a.date === date
  );

  if (status === 'present') {
    // 출석이면 기록 삭제 (기본 상태 = 출석)
    if (existing >= 0) appState.attendance.splice(existing, 1);
  } else {
    const record = {
      id: generateId(),
      studentId,
      classId,
      date,
      status,
      reason,
    };
    if (existing >= 0) {
      appState.attendance[existing] = record;
    } else {
      appState.attendance.push(record);
    }
  }
  saveState();
}

/** 출결 탭 렌더링 */
function renderAttendance() {
  const cls = getCurrentClass();
  const grid = document.getElementById('attendanceGrid');

  if (!cls || cls.students.length === 0) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div>학생 명단을 먼저 추가해 주세요.</div>';
    return;
  }

  const date = document.getElementById('attendanceDate').value || todayStr();
  const existing = getAttendanceForDate(cls.id, date);

  grid.innerHTML = '';
  cls.students.forEach(student => {
    const attRecord = existing.find(a => a.studentId === student.id);
    const status = attRecord ? attRecord.status : 'present';
    const reason = attRecord ? attRecord.reason : '';

    const card = document.createElement('div');
    card.className = `attendance-card status-${status}`;
    card.dataset.studentId = student.id;
    card.innerHTML = `
      <span class="att-student-num">${student.number}번</span>
      <span class="att-student-name">${student.name}</span>
      <select class="att-status-select" id="att-sel-${student.id}">
        <option value="present"  ${status==='present'?'selected':''}>✅ 출석</option>
        <option value="absent"   ${status==='absent'?'selected':''}>❌ 결석</option>
        <option value="late"     ${status==='late'?'selected':''}>⏰ 지각</option>
        <option value="leave-early" ${status==='leave-early'?'selected':''}>🚪 조퇴</option>
        <option value="experience"  ${status==='experience'?'selected':''}>🎒 체험학습</option>
        <option value="nurse"    ${status==='nurse'?'selected':''}>🏥 보건실</option>
      </select>
      <input type="text" class="att-reason-input ${status!=='present'?'visible':''}" 
             id="att-reason-${student.id}"
             placeholder="사유 입력..." value="${reason}" />
    `;

    const sel = card.querySelector('.att-status-select');
    const reasonInput = card.querySelector('.att-reason-input');

    sel.addEventListener('change', () => {
      const newStatus = sel.value;
      const newReason = reasonInput.value;

      // 카드 클래스 업데이트
      Object.keys(ATTENDANCE_STATUS).forEach(s => card.classList.remove(`status-${s}`));
      card.classList.add(`status-${newStatus}`);

      // 사유 입력창 표시/숨김
      if (newStatus === 'present') {
        reasonInput.classList.remove('visible');
      } else {
        reasonInput.classList.add('visible');
      }

      setAttendance(student.id, cls.id, date, newStatus, newReason);
      // 자리 배치도의 뱃지도 갱신
      updateSeatAttendanceBadge(student.id, newStatus);
      showToast(`${student.name}: ${ATTENDANCE_STATUS[newStatus].label}`, 'success');
    });

    reasonInput.addEventListener('change', () => {
      setAttendance(student.id, cls.id, date, sel.value, reasonInput.value);
    });

    grid.appendChild(card);
  });
}

/** 자리 배치도에서 해당 학생 배지만 갱신 */
function updateSeatAttendanceBadge(studentId, status) {
  const card = document.querySelector(`[data-student-id="${studentId}"]`);
  if (!card) return;
  const existingBadge = card.querySelector('.status-badge');
  if (existingBadge) existingBadge.remove();
  const badgeHtml = getAttendanceBadgeHtml(status);
  if (badgeHtml) card.insertAdjacentHTML('beforeend', badgeHtml);
}

// ── 출결 UI 이벤트 ──
document.addEventListener('DOMContentLoaded', () => {
  // 날짜 변경 시 재렌더
  document.getElementById('attendanceDate').addEventListener('change', renderAttendance);

  // 출결 나이스용 복사
  document.getElementById('btnCopyAttendance').addEventListener('click', () => {
    const cls = getCurrentClass();
    if (!cls) return;
    const date = document.getElementById('attendanceDate').value || todayStr();
    const records = getAttendanceForDate(cls.id, date);
    const nonPresent = cls.students.filter(s =>
      records.some(r => r.studentId === s.id && r.status !== 'present')
    );

    if (nonPresent.length === 0) {
      navigator.clipboard.writeText(`${date} ${cls.name} 전원 출석`);
      showToast('클립보드에 복사되었습니다.', 'success');
      return;
    }

    let text = `[${date} ${cls.name} 출결 현황]\n`;
    nonPresent.forEach(s => {
      const rec = records.find(r => r.studentId === s.id);
      const info = ATTENDANCE_STATUS[rec.status];
      text += `${s.number}번 ${s.name}: ${info.label}`;
      if (rec.reason) text += ` (${rec.reason})`;
      text += '\n';
    });

    navigator.clipboard.writeText(text).then(() => {
      showToast('나이스 입력용 출결 현황이 복사되었습니다.', 'success');
    });
  });

  // 출결 CSV 다운로드
  document.getElementById('btnExportAttendance').addEventListener('click', () => {
    const cls = getCurrentClass();
    if (!cls) return;
    const date = document.getElementById('attendanceDate').value || todayStr();
    exportAttendanceCsv(cls, date);
  });
});

/** 출결 CSV 내보내기 */
function exportAttendanceCsv(cls, date) {
  const records = getAttendanceForDate(cls.id, date);
  let csv = '번호,이름,날짜,출결상태,사유\n';
  cls.students.forEach(s => {
    const rec = records.find(r => r.studentId === s.id);
    const status = rec ? ATTENDANCE_STATUS[rec.status].label : '출석';
    const reason = rec ? (rec.reason || '') : '';
    csv += `${s.number},"${s.name}",${date},"${status}","${reason}"\n`;
  });
  downloadCsv(csv, `출결_${cls.name}_${date}.csv`);
  showToast('출결 CSV가 다운로드되었습니다.', 'success');
}

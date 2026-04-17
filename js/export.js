/* ==========================================
   export.js - 데이터 내보내기 / 통계 모듈
   ========================================== */

/** CSV 파일 다운로드 공통 함수 */
function downloadCsv(csvContent, filename) {
  // BOM 추가 (엑셀 한글 깨짐 방지)
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** JSON 파일 다운로드 */
function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** 통계 화면 렌더링 */
function renderStats() {
  const cls = getCurrentClass();
  const today = todayStr();

  const students = cls ? cls.students : [];
  const behaviors = cls ? appState.behaviors.filter(b => b.classId === cls.id) : [];
  const attendance = cls ? appState.attendance.filter(a => a.classId === cls.id && a.date === today) : [];

  // 요약 카드 값 업데이트
  document.getElementById('statValStudents').textContent = students.length;
  document.getElementById('statValAbsent').textContent =
    attendance.filter(a => a.status === 'absent').length;
  document.getElementById('statValBehavior').textContent = behaviors.length;
  document.getElementById('statValPositive').textContent =
    behaviors.filter(b => b.type === 'positive').length;

  // 행동 유형별 통계 차트
  renderBehaviorStatsChart(behaviors);

  // 학급별 시수 현황 차트
  renderLessonStatsChart();

  // 학생별 행동 요약
  renderStudentBehaviorSummary(cls, behaviors);
}

/** 학급별 시수 현황 (목표 대비 실제) */
function renderLessonStatsChart() {
  const container = document.getElementById('lessonStatsChart');
  container.innerHTML = '';

  if (appState.classes.length === 0) {
    container.innerHTML = '<div class="empty-state">학급 정보가 없습니다.</div>';
    return;
  }

  appState.classes.forEach(cls => {
    const target = appState.termSettings.targetHours[cls.id] || 0;
    const actual = typeof calculateActualHours === 'function' ? calculateActualHours(cls.id) : 0;
    const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0;

    const row = document.createElement('div');
    row.className = 'behavior-stat-row';
    row.innerHTML = `
      <span style="min-width:130px;font-size:0.85rem;font-weight:600;">${cls.name}</span>
      <div class="stat-bar-wrap">
        <div class="stat-bar positive" style="width:${pct}%"></div> 
      </div>
      <span class="stat-count">${actual} / ${target}h (${pct}%)</span>
    `;
    container.appendChild(row);
  });

  if (!appState.termSettings.startDate) {
    const help = document.createElement('div');
    help.className = 'config-help';
    help.style.marginTop = '10px';
    help.textContent = '💡 시간표 탭에서 학기 시작일을 설정하면 실제 시수가 자동 집계됩니다.';
    container.appendChild(help);
  }
}

/** 행동 유형별 통계 막대 차트 */
function renderBehaviorStatsChart(behaviors) {
  const container = document.getElementById('behaviorStatsChart');
  container.innerHTML = '';

  // 행동별 집계
  const counts = {};
  const types = {};
  behaviors.forEach(b => {
    if (!counts[b.label]) { counts[b.label] = 0; types[b.label] = b.type; }
    counts[b.label]++;
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const maxCount = sorted[0]?.[1] || 1;

  if (sorted.length === 0) {
    container.innerHTML = '<div class="empty-state">기록이 없습니다.</div>';
    return;
  }

  sorted.forEach(([label, count]) => {
    const type = types[label];
    const pct = Math.round((count / maxCount) * 100);
    const row = document.createElement('div');
    row.className = 'behavior-stat-row';
    row.innerHTML = `
      <span style="min-width:130px;font-size:0.8rem;">${label}</span>
      <div class="stat-bar-wrap">
        <div class="stat-bar ${type}" style="width:${pct}%"></div>
      </div>
      <span class="stat-count">${count}</span>
    `;
    container.appendChild(row);
  });
}

/** 학생별 행동 요약 */
function renderStudentBehaviorSummary(cls, behaviors) {
  const container = document.getElementById('studentBehaviorSummary');
  container.innerHTML = '';

  if (!cls || cls.students.length === 0) {
    container.innerHTML = '<div class="empty-state">학생이 없습니다.</div>';
    return;
  }

  // 학생별 집계
  const summary = {};
  cls.students.forEach(s => { summary[s.id] = { positive: 0, negative: 0, student: s }; });
  behaviors.forEach(b => {
    if (summary[b.studentId]) {
      if (b.type === 'positive') summary[b.studentId].positive++;
      if (b.type === 'negative') summary[b.studentId].negative++;
    }
  });

  const sorted = Object.values(summary).sort((a, b) => (b.positive + b.negative) - (a.positive + a.negative));

  sorted.forEach(({ student, positive, negative }) => {
    if (positive + negative === 0) return; // 기록 없는 학생은 생략
    const row = document.createElement('div');
    row.className = 'student-summary-row';
    row.innerHTML = `
      <span class="summary-name">${student.number}번 ${student.name}</span>
      <span class="summary-positive" title="긍정 행동">⭐${positive}</span>
      <span class="summary-negative" title="개선 필요">⚠️${negative}</span>
    `;
    container.appendChild(row);
  });

  if (container.innerHTML === '') {
    container.innerHTML = '<div class="empty-state">행동 기록이 없습니다.</div>';
  }
}

/** 나이스 입력용 CSV 내보내기 (학생별 행동 요약) */
function exportNeisCsv() {
  const cls = getCurrentClass();
  if (!cls) return;

  const behaviors = appState.behaviors.filter(b => b.classId === cls.id);
  const studentMap = {};
  cls.students.forEach(s => studentMap[s.id] = s);

  // 학생별, 날짜별 그룹화
  const grouped = {};
  behaviors.forEach(b => {
    const key = b.studentId;
    if (!grouped[key]) grouped[key] = { positive: [], negative: [], notes: [] };
    if (b.type === 'positive') grouped[key].positive.push(b.label);
    if (b.type === 'negative') grouped[key].negative.push(b.label);
    if (b.type === 'note' && b.note) grouped[key].notes.push(b.note);
  });

  let csv = '번호,이름,긍정행동,개선필요,메모\n';
  cls.students.forEach(s => {
    const data = grouped[s.id] || { positive: [], negative: [], notes: [] };
    const posText = [...new Set(data.positive)].join(' / ');
    const negText = [...new Set(data.negative)].join(' / ');
    const noteText = data.notes.join(' / ');
    csv += `${s.number},"${s.name}","${posText}","${negText}","${noteText}"\n`;
  });

  downloadCsv(csv, `나이스입력용_${cls.name}.csv`);
  showToast('나이스 입력용 파일이 다운로드되었습니다.', 'success');
}

/** 전체 출결 CSV */
function exportAllAttendanceCsv() {
  const cls = getCurrentClass();
  if (!cls) return;

  let csv = '날짜,번호,이름,출결상태,사유\n';
  const studentMap = {};
  cls.students.forEach(s => studentMap[s.id] = s);

  const records = [...appState.attendance.filter(a => a.classId === cls.id)];
  records.sort((a, b) => a.date.localeCompare(b.date));

  records.forEach(r => {
    const s = studentMap[r.studentId];
    if (!s) return;
    const statusLabel = ATTENDANCE_STATUS[r.status]?.label || r.status;
    csv += `${r.date},${s.number},"${s.name}","${statusLabel}","${r.reason || ''}"\n`;
  });

  downloadCsv(csv, `출결기록전체_${cls.name}.csv`);
  showToast('출결 전체 기록이 다운로드되었습니다.', 'success');
}

/** 전체 데이터 JSON 백업 */
function backupAllData() {
  const data = {
    exportDate: new Date().toISOString(),
    version: '2.0',
    ...appState,
  };
  downloadJson(data, `스마트교실백업_${todayStr()}.json`);
  showToast('전체 데이터가 백업되었습니다.', 'success');
}

/** JSON 데이터 복원 */
function restoreFromJson(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.classes || !Array.isArray(data.classes)) {
        showToast('올바른 백업 파일이 아닙니다.', 'error');
        return;
      }
      if (!confirm(`백업 파일(${data.exportDate?.slice(0, 10) || '알 수 없음'} 생성)을 복원하면 현재 데이터가 모두 교체됩니다. 계속하시겠습니까?`)) return;

      appState.classes = data.classes || [];
      appState.behaviors = data.behaviors || [];
      appState.attendance = data.attendance || [];
      appState.currentClassId = data.currentClassId || data.classes[0]?.id || null;
      
      // ★ 추가 유실 방지: 시간표 및 설정 데이터 모두 복원
      appState.timetable = data.timetable || {};
      appState.weeklyTimetable = data.weeklyTimetable || {};
      appState.timeConfig = data.timeConfig || appState.timeConfig;
      appState.termSettings = data.termSettings || appState.termSettings;
      appState.holidays = data.holidays || [];
      appState.theme = data.theme || 'dark';
      saveState();

      updateClassSelect();
      renderSeating();
      renderStudentSidebar();
      showToast('데이터가 성공적으로 복원되었습니다.', 'success');
    } catch (err) {
      showToast('파일을 읽는 중 오류가 발생했습니다.', 'error');
    }
  };
  reader.readAsText(file);
}

// ── 통계/내보내기 UI 이벤트 ──
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnExportAllBehavior').addEventListener('click', () => {
    const cls = getCurrentClass();
    if (cls) exportBehaviorCsv(cls);
    else showToast('학급을 선택하세요.', 'error');
  });

  document.getElementById('btnExportAllAttendance').addEventListener('click', exportAllAttendanceCsv);
  document.getElementById('btnExportNeis').addEventListener('click', exportNeisCsv);
  document.getElementById('btnBackupData').addEventListener('click', backupAllData);

  document.getElementById('btnRestoreData').addEventListener('click', () => {
    document.getElementById('restoreInput').click();
  });

  document.getElementById('restoreInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      restoreFromJson(file);
      e.target.value = ''; // 같은 파일 재선택 허용
    }
  });
});

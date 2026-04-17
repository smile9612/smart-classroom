/* behavior.js - 행동 기록 완전 복원 */

let bulkMode = false;
let bulkSelected = new Set();

function openBehaviorModal(studentId) {
  const cls = getCurrentClass();
  if (!cls) return;
  const student = cls.students.find(s => s.id === studentId);
  if (!student) return;

  const nameEl = document.getElementById('modalStudentName');
  if (nameEl) nameEl.textContent = student.name;

  // 출결 상태 표시
  const attEl = document.getElementById('modalAttStatus');
  if (attEl) {
    const date = todayStr();
    const att = window.appState.attendance.find(a => a.studentId === studentId && a.date === date);
    const status = att ? att.status : 'present';
    const info = ATTENDANCE_STATUS[status] || {};
    attEl.textContent = (info.icon || '') + ' ' + (info.label || '\uCD9C\uC11D');
  }

  // 오늘 행동기록 표시
  renderModalBehaviorList(studentId);

  const modal = document.getElementById('behaviorModal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.dataset.studentId = studentId;
  }
}

function renderModalBehaviorList(studentId) {
  const container = document.getElementById('modalRecentRecords');
  if (!container) return;
  const today = todayStr();
  const records = window.appState.behaviors.filter(b => b.studentId === studentId && b.date === today);
  if (records.length === 0) {
    container.innerHTML = '<p class="help-text">\uC624\uB298 \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
    return;
  }
  container.innerHTML = records.map((b, i) => {
    const typeInfo = getAllBehaviorTypes().find(t => t.label === b.label) || {};
    return '<div class="record-item">'
      + '<span>' + (typeInfo.emoji || '') + ' ' + b.label + '</span>'
      + '<button onclick="deleteBehaviorRecord(' + i + ',\'' + studentId + '\')">\u2715</button>'
      + '</div>';
  }).join('');
}

function getAllBehaviorTypes() {
  const types = [];
  Object.values(BEHAVIOR_TYPES).forEach(arr => arr.forEach(t => types.push(t)));
  return types;
}

function recordBehavior(label, emoji, type) {
  const modal = document.getElementById('behaviorModal');
  if (!modal) return;
  const studentId = modal.dataset.studentId;
  if (!studentId) return;

  window.appState.behaviors.push({
    id: generateId(),
    studentId,
    date: todayStr(),
    label,
    emoji,
    type,
    classId: window.appState.currentClassId,
    timestamp: Date.now()
  });
  saveState();
  renderModalBehaviorList(studentId);
  renderBehaviorTable();
  if (typeof showToast === 'function') showToast(emoji + ' ' + label + ' \uAE30\uB85D \uC644\uB8CC');
}

function deleteBehaviorRecord(idx, studentId) {
  const today = todayStr();
  const todayRecords = window.appState.behaviors
    .map((b, i) => ({ ...b, _idx: i }))
    .filter(b => b.studentId === studentId && b.date === today);
  if (todayRecords[idx]) {
    window.appState.behaviors.splice(todayRecords[idx]._idx, 1);
    saveState();
    renderModalBehaviorList(studentId);
    renderBehaviorTable();
  }
}

function closeBehaviorModal() {
  document.getElementById('behaviorModal')?.classList.add('hidden');
}

function saveBehaviorMemo() {
  const modal = document.getElementById('behaviorModal');
  if (!modal) return;
  const studentId = modal.dataset.studentId;
  const memoEl = document.getElementById('behaviorMemo');
  if (!studentId || !memoEl) return;
  const cls = getCurrentClass();
  if (!cls) return;
  const student = cls.students.find(s => s.id === studentId);
  if (student) {
    student.memo = memoEl.value;
    saveState();
    if (typeof showToast === 'function') showToast('\uBA54\uBAA8\uAC00 \uC800\uC7A5\uB418\uC5C8\uC2B5\uB2C8\uB2E4.');
  }
}

function toggleBulkMode() {
  bulkMode = !bulkMode;
  bulkSelected.clear();
  const btn = document.getElementById('btnBulkMode');
  if (btn) btn.textContent = bulkMode ? '\u2717 \uC77C\uAD04\uBAA8\uB4DC \uD574\uC81C' : '\u2611 \uC77C\uAD04 \uAE30\uB85D';
  if (typeof renderSeating === 'function') renderSeating();
}

function renderBehaviorTable() {
  const container = document.getElementById('behaviorTableContainer');
  if (!container) return;
  const cls = getCurrentClass();
  if (!cls) {
    container.innerHTML = '<p class="help-text">\uBC18\uC744 \uC120\uD0DD\uD558\uC138\uC694.</p>';
    return;
  }
  const today = todayStr();
  const date = document.getElementById('behaviorDateFilter')?.value || today;

  const rows = cls.students.map(s => {
    const records = window.appState.behaviors.filter(b => b.studentId === s.id && b.date === date);
    const pos = records.filter(b => b.type === 'positive').length;
    const neg = records.filter(b => b.type === 'negative').length;
    const labels = records.map(b => (b.emoji || '') + b.label).join(', ');
    return '<tr>'
      + '<td>' + (s.number || '') + '</td>'
      + '<td>' + s.name + '</td>'
      + '<td style="color:var(--positive)">' + pos + '</td>'
      + '<td style="color:var(--danger)">' + neg + '</td>'
      + '<td class="behavior-labels">' + labels + '</td>'
      + '</tr>';
  });

  container.innerHTML = '<table class="behavior-table">'
    + '<thead><tr><th>\uBC88\uD638</th><th>\uC774\uB984</th><th>\uCE6D\uCC2C</th><th>\uAC1C\uC120</th><th>\uB0B4\uC6A9</th></tr></thead>'
    + '<tbody>' + rows.join('') + '</tbody>'
    + '</table>';
}

function exportBehaviorCsv() {
  const cls = getCurrentClass();
  if (!cls) return;
  const today = todayStr();
  const date = document.getElementById('behaviorDateFilter')?.value || today;
  const rows = ['\uBC88\uD638,\uC774\uB984,\uC720\uD615,\uB0B4\uC6A9,\uB0A0\uC9DC'];
  window.appState.behaviors
    .filter(b => b.classId === cls.id && b.date === date)
    .forEach(b => {
      const s = cls.students.find(st => st.id === b.studentId);
      rows.push([(s?.number || ''), (s?.name || ''), b.type, b.label, b.date].join(','));
    });
  if (typeof downloadCsv === 'function') {
    downloadCsv(rows.join('\n'), '\uD589\uB3D9\uAE30\uB85D_' + date + '.csv');
  }
}

// window 전역 등록
window.openBehaviorModal = openBehaviorModal;
window.recordBehavior = recordBehavior;
window.deleteBehaviorRecord = deleteBehaviorRecord;
window.closeBehaviorModal = closeBehaviorModal;
window.saveBehaviorMemo = saveBehaviorMemo;
window.toggleBulkMode = toggleBulkMode;
window.renderBehaviorTable = renderBehaviorTable;
window.exportBehaviorCsv = exportBehaviorCsv;

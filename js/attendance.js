/* attendance.js */
function renderAttendance() {
  const cls = getCurrentClass();
  const container = document.getElementById('attendanceGrid');
  if (!cls || !container) return;
  const date = document.getElementById('attendanceDate')?.value || todayStr();
  container.innerHTML = '';
  cls.students.forEach(s => {
    const record = appState.attendance.find(a => a.studentId === s.id && a.date === date) || { status: 'present' };
    const div = document.createElement('div');
    div.className = 'att-item';
    div.innerHTML = '<span>' + s.name + '</span><select onchange="setAttendance(\'' + s.id + '\', this.value)">' + 
      Object.keys(ATTENDANCE_STATUS).map(k => '<option value="' + k + '"' + (record.status === k ? ' selected' : '') + '>' + ATTENDANCE_STATUS[k].label + '</option>').join('') + '</select>';
    container.appendChild(div);
  });
}
function setAttendance(studentId, status) {
  const date = document.getElementById('attendanceDate')?.value || todayStr();
  const idx = appState.attendance.findIndex(a => a.studentId === studentId && a.date === date);
  if (idx > -1) appState.attendance[idx].status = status;
  else appState.attendance.push({ studentId, date, status, classId: appState.currentClassId });
  saveState();
  if (typeof renderSeating === 'function') renderSeating();
}
window.renderAttendance = renderAttendance;
window.setAttendance = setAttendance;

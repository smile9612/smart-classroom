/* seating.js */
function renderSeating() {
  const cls = getCurrentClass();
  const grid = document.getElementById('seatGrid');
  if (!cls || !grid) return;
  grid.style.gridTemplateColumns = 'repeat(' + cls.cols + ', 1fr)';
  grid.innerHTML = '';
  const showNums = document.getElementById('toggleShowNumbers')?.checked !== false;
  for (let r = 0; r < cls.rows; r++) {
    for (let c = 0; c < cls.cols; c++) {
      const seatId = r + '-' + c;
      const studentId = cls.seats[seatId];
      const student = studentId ? cls.students.find(s => s.id === studentId) : null;
      const seat = document.createElement('div');
      seat.className = 'seat' + (student ? ' occupied' : '');
      if (student) {
        seat.innerHTML = '<div class=\"seat-info\">' + (showNums ? '<span class=\"seat-num\">' + student.number + '</span>' : '') + '<span class=\"seat-name\">' + student.name + '</span></div><button class=\"btn-unseat\" onclick=\"unseatStudent(\'' + seatId + '\')\">\u2715</button>';
        seat.onclick = (e) => {
          if (e.target.classList.contains('btn-unseat')) return;
          if (typeof openBehaviorModal === 'function') openBehaviorModal(student.id);
        };
      } else {
        seat.innerHTML = '+';
      }
      grid.appendChild(seat);
    }
  }
}
function unseatStudent(seatId) {
  const cls = getCurrentClass();
  if (cls) { delete cls.seats[seatId]; saveState(); renderSeating(); renderStudentSidebar(); }
}
window.renderSeating = renderSeating;
window.unseatStudent = unseatStudent;
window.smartAutoArrange = () => { showToast('\uC218\uB9C8\uD2B8 \uBC30\uCE58 \uAE30\uB219 \uBD81\uAD6C \uC911...'); };
window.undoSeating = () => { showToast('\uB418\uB3CC\uB9AC\uAE30 \uAE30\uB219 \uBD81\uAD6C \uC911...'); };
window.openRandomModal = () => { document.getElementById('randomModal').classList.remove('hidden'); };
window.startRandom = () => { showToast('\uBF5D\uAE30 \uAE30\uB219 \uBD81\uAD6C \uC911...'); };

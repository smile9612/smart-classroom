/* students.js - \uD559\uC0DD \uBA31\uB2E8 \uAD00\uB9AC */
function addStudent(name, number, gender) {
  const cls = getCurrentClass();
  if (!cls || !name.trim()) return null;
  if (cls.students.some(s => s.name === name.trim())) {
    showToast('"' + name.trim() + '"\uB2D8\uC740 \uC774\uBBF8 \uC788\uB244 \uD559\uC0DD\uC785\uB2C8\uB2E4.', 'error');
    return null;
  }
  const student = { id: generateId(), name: name.trim(), number: number || (cls.students.length + 1), gender: gender || 'male' };
  cls.students.push(student);
  cls.students.sort((a, b) => a.number - b.number);
  saveState();
  return student;
}
function deleteStudent(studentId) {
  const cls = getCurrentClass();
  if (!cls) return;
  cls.students = cls.students.filter(s => s.id !== studentId);
  saveState();
  if (typeof renderSeating === 'function') renderSeating();
  renderStudentSidebar();
  showToast('\uD559\uC0DD\uC774 \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4.', 'warning');
}
function renderStudentSidebar() {
  const cls = getCurrentClass();
  const allList = document.getElementById('allStudentList');
  const countBadge = document.getElementById('studentCount');
  if (!cls || !allList) return;
  countBadge.textContent = cls.students.length + '\uBA85';
  allList.innerHTML = '';
  cls.students.forEach(student => {
    const item = document.createElement('div');
    item.className = 'student-list-item';
    item.innerHTML = '<span>' + student.name + '</span><button onclick=\"confirmDeleteStudent(\'' + student.id + '\', \'' + student.name + '\')\">\u2715</button>';
    allList.appendChild(item);
  });
}
window.addStudent = addStudent;
window.deleteStudent = deleteStudent;
window.renderStudentSidebar = renderStudentSidebar;
window.confirmDeleteStudent = (sid, name) => {
  if (confirm('"' + name + '" \uD559\uC0DD\uC744 \uC0AD\uC81C\uD558\uC2DC\uAC80\uC2B5\uB2C8\uAE4C?')) deleteStudent(sid);
};

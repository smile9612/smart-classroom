/* timetable.js */
window.loadTimetableUI = () => {
  const container = document.getElementById('weeklyTimetableContainer');
  if (container) container.innerHTML = '\uC2DC\uAC04\uD45C \uC124\uC815 \uBD81\uAD6C \uC911...';
};
window.initTimetableTab = window.loadTimetableUI;
window.goToCurrentClass = () => { showToast('\uC218\uC5C5 \uC774\uB3D9 \uAE30\uB219 \uBD81\uAD6C \uC911...'); };

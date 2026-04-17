/* behavior.js */
window.openBehaviorModal = (sid) => { 
  const cls = getCurrentClass();
  if(!cls) return;
  const s = cls.students.find(x => x.id === sid);
  if(s) {
    const modalName = document.getElementById('modalStudentName');
    if (modalName) modalName.textContent = s.name;
    document.getElementById('behaviorModal').classList.remove('hidden');
  }
};
window.renderBehaviorTable = () => {};
window.toggleBulkMode = () => { showToast('\uC77C\uAD04 \uAE30\uB219 \uBAA8\uB41C \uBD81\uAD6C \uC911...'); };
window.exportBehaviorCsv = () => {};

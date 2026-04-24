/* ==========================================
   history.js - 버전 기록 (자동 및 수동 백업)
   ========================================== */

console.log('history.js loaded');

const AUTO_BACKUP_LIMIT = 5; // 7일에 1회 백업 시 5개 유지 (약 한 달치)
const MANUAL_BACKUP_LIMIT = 10; // 수동 백업 최대 유지 개수

let _versions = [];

// 버전 목록 조회 및 UI 렌더링
async function loadHistory() {
  if (!currentUser) return;
  const listEl = document.getElementById('historyList');
  if (!listEl) return;
  
  try {
    listEl.innerHTML = '<div class="empty-state" style="padding:10px;">버전 기록을 불러오는 중...</div>';
    
    const db = firebase.firestore();
    const uid = currentUser.uid;
    const snapshot = await db.collection('users').doc(uid).collection('versions')
                             .orderBy('timestamp', 'desc')
                             .get();
                             
    _versions = [];
    snapshot.forEach(doc => {
      _versions.push({ id: doc.id, ...doc.data() });
    });
    
    renderHistoryUI();
  } catch (err) {
    console.error('버전 기록 불러오기 실패:', err);
    listEl.innerHTML = '<div class="empty-state" style="color:var(--danger); padding:10px;">버전 기록을 불러오는데 실패했습니다.</div>';
  }
}

// UI 렌더링
function renderHistoryUI() {
  const listEl = document.getElementById('historyList');
  if (!listEl) return;
  
  if (_versions.length === 0) {
    listEl.innerHTML = '<div class="empty-state" style="padding:10px;">저장된 버전 기록이 없습니다.</div>';
    return;
  }
  
  let html = '';
  _versions.forEach(v => {
    const isAuto = v.type === 'auto';
    const badgeHtml = isAuto 
      ? '<span style="background:var(--accent-light); color:var(--accent); font-size:0.7rem; padding:2px 6px; border-radius:4px; font-weight:bold;">자동</span>'
      : '<span style="background:var(--positive-light); color:var(--positive); font-size:0.7rem; padding:2px 6px; border-radius:4px; font-weight:bold;">수동</span>';
      
    const dateStr = new Date(v.timestamp).toLocaleString('ko-KR', { 
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });
    
    html += `
      <div style="background:var(--bg-secondary); border:1px solid var(--border-light); padding:10px; border-radius:var(--radius-sm); display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
            ${badgeHtml}
            <span style="font-weight:600; font-size:0.9rem;">${v.name || '이름 없음'}</span>
          </div>
          <div style="font-size:0.75rem; color:var(--text-muted);">${dateStr}</div>
        </div>
        <div style="display:flex; gap:6px;">
          <button class="btn btn-primary btn-sm" onclick="restoreVersion('${v.id}')" style="padding:4px 8px; font-size:0.75rem;">복원</button>
          ${!isAuto ? `<button class="btn btn-ghost btn-sm" onclick="deleteVersion('${v.id}')" style="padding:4px 8px; font-size:0.75rem; color:var(--danger);">삭제</button>` : ''}
        </div>
      </div>
    `;
  });
  
  listEl.innerHTML = html;
}

// 자동 백업 실행 (7일에 1회)
async function checkAndRunAutoBackup() {
  if (!currentUser) return;
  
  // _versions가 아직 안 불러와졌으면 먼저 로드
  if (_versions.length === 0) {
    await loadHistory();
  }
  
  const db = firebase.firestore();
  const uid = currentUser.uid;
  
  const autoVersions = _versions.filter(v => v.type === 'auto');
  autoVersions.sort((a, b) => b.timestamp - a.timestamp); // 최신순 정렬
  const lastAuto = autoVersions[0];
  
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  
  try {
    // 가장 최근 자동 백업이 없거나, 마지막 백업으로부터 7일이 지났다면 생성
    if (!lastAuto || (Date.now() - lastAuto.timestamp >= SEVEN_DAYS_MS)) {
      console.log('7일 경과 확인: 새로운 자동 백업 생성 중...');
      
      const today = todayStr(); 
      const autoDocId = `auto_${Date.now()}`;
      const snapshotData = JSON.parse(JSON.stringify(appState));
      
      await db.collection('users').doc(uid).collection('versions').doc(autoDocId).set({
        type: 'auto',
        name: `${today} 주간 자동 백업`,
        timestamp: Date.now(),
        data: snapshotData
      });
      
      // 오래된 자동 백업 삭제
      await loadHistory(); // 방금 추가된 항목 반영
      await cleanupOldAutoBackups();
      await loadHistory(); // 삭제 후 최종 반영
    }
  } catch (err) {
    console.error('자동 백업 확인 실패:', err);
  }
}

// 오래된 자동 백업 정리 (7일 초과)
async function cleanupOldAutoBackups() {
  try {
    const db = firebase.firestore();
    const uid = currentUser.uid;
    const autoVersions = _versions.filter(v => v.type === 'auto');
    
    if (autoVersions.length > AUTO_BACKUP_LIMIT) {
      // 오래된 순으로 정렬
      autoVersions.sort((a, b) => a.timestamp - b.timestamp);
      
      // 초과분 삭제
      const excess = autoVersions.length - AUTO_BACKUP_LIMIT;
      for (let i = 0; i < excess; i++) {
        await db.collection('users').doc(uid).collection('versions').doc(autoVersions[i].id).delete();
      }
    }
  } catch (err) {
    console.error('오래된 자동 백업 정리 실패:', err);
  }
}

// 수동 백업 생성
async function createManualBackup() {
  if (!currentUser) return;
  
  const name = prompt('현재 상태를 백업합니다. 백업 이름을 입력하세요.', '임의 수동 백업');
  if (!name || name.trim() === '') return;
  
  try {
    showToast('수동 백업을 생성하는 중입니다...');
    const db = firebase.firestore();
    const uid = currentUser.uid;
    
    const snapshotData = JSON.parse(JSON.stringify(appState));
    const newDocId = `manual_${Date.now()}`;
    
    await db.collection('users').doc(uid).collection('versions').doc(newDocId).set({
      type: 'manual',
      name: name.trim(),
      timestamp: Date.now(),
      data: snapshotData
    });
    
    showToast('수동 백업이 완료되었습니다.', 'success');
    
    // 수동 백업 한도 초과 시 오래된 것 삭제
    await loadHistory();
    const manualVersions = _versions.filter(v => v.type === 'manual');
    if (manualVersions.length > MANUAL_BACKUP_LIMIT) {
      manualVersions.sort((a, b) => a.timestamp - b.timestamp);
      const excess = manualVersions.length - MANUAL_BACKUP_LIMIT;
      for (let i = 0; i < excess; i++) {
        await db.collection('users').doc(uid).collection('versions').doc(manualVersions[i].id).delete();
      }
      await loadHistory();
    }
    
  } catch (err) {
    console.error('수동 백업 실패:', err);
    showToast('수동 백업에 실패했습니다.', 'error');
  }
}

// 버전 복원
async function restoreVersion(versionId) {
  const version = _versions.find(v => v.id === versionId);
  if (!version) return;
  
  const confirmMsg = `'${version.name}' 버전으로 돌아가시겠습니까?\n이후의 변경 사항은 덮어쓰여집니다. 복원하시기 전에 현재 상태를 수동 백업해 두는 것을 권장합니다.`;
  if (!confirm(confirmMsg)) return;
  
  try {
    showToast('데이터를 복원하는 중입니다... 잠시만 기다려주세요.');
    
    // 1. 버전 데이터로 appState 덮어쓰기
    // 단, Firestore 연동 구조상 완전히 덮어씌운 뒤 saveState()를 호출하여 재저장함
    const restoredData = version.data;
    
    // 전역 상태 덮어쓰기 (참조 유지)
    Object.keys(restoredData).forEach(key => {
      appState[key] = restoredData[key];
    });
    
    // 2. 현재 상태 강제 저장 (firebase-db.js)
    await saveState(true);
    
    showToast('버전 복원이 완료되었습니다! 페이지를 새로고침합니다.', 'success');
    
    // 3. UI 갱신을 위해 1초 후 새로고침
    setTimeout(() => {
      location.reload();
    }, 1000);
    
  } catch (err) {
    console.error('복원 실패:', err);
    showToast('버전 복원에 실패했습니다.', 'error');
  }
}

// 버전 삭제 (수동 백업만)
async function deleteVersion(versionId) {
  if (!confirm('이 백업 버전을 삭제하시겠습니까?')) return;
  
  try {
    const db = firebase.firestore();
    const uid = currentUser.uid;
    await db.collection('users').doc(uid).collection('versions').doc(versionId).delete();
    
    showToast('버전이 삭제되었습니다.');
    loadHistory();
  } catch (err) {
    console.error('삭제 실패:', err);
    showToast('버전 삭제에 실패했습니다.', 'error');
  }
}

// ── 이벤트 리스너 ──
document.addEventListener('DOMContentLoaded', () => {
  const btnCreateManualBackup = document.getElementById('btnCreateManualBackup');
  if (btnCreateManualBackup) {
    btnCreateManualBackup.addEventListener('click', createManualBackup);
  }
});

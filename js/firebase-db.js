/* ==========================================
   firebase-db.js - Firestore 데이터 저장/불러오기
   LocalStorage 대신 Firestore를 사용하여 
   사용자별 데이터를 클라우드에 저장합니다.
   ========================================== */

// 저장 디바운스 타이머 (빈번한 저장 방지)
let _saveDebounceTimer = null;
const SAVE_DEBOUNCE_MS = 1500; // 1.5초 간격으로 저장

// 저장 상태 표시 엘리먼트
let _saveIndicator = null;

/** 저장 상태 표시 업데이트 */
function updateSaveIndicator(status) {
  if (!_saveIndicator) {
    _saveIndicator = document.getElementById('saveIndicator');
  }
  if (!_saveIndicator) return;

  switch (status) {
    case 'saving':
      _saveIndicator.textContent = '☁️ 저장 중...';
      _saveIndicator.className = 'save-indicator saving';
      break;
    case 'saved':
      _saveIndicator.textContent = '✅ 저장 완료';
      _saveIndicator.className = 'save-indicator saved';
      // 3초 후 표시 숨김
      setTimeout(() => {
        if (_saveIndicator.className.includes('saved')) {
          _saveIndicator.className = 'save-indicator';
        }
      }, 3000);
      break;
    case 'error':
      _saveIndicator.textContent = '⚠️ 저장 실패';
      _saveIndicator.className = 'save-indicator error';
      break;
    default:
      _saveIndicator.className = 'save-indicator';
  }
}

/** 
 * Firestore에 전체 앱 상태 저장
 * @param {boolean} isImmediate true일 경우 디바운스 없이 즉시 저장 (복원 등 중요 작업 시)
 */
function saveState(isImmediate = false) {
  // 로그인되지 않은 경우 무시
  if (!currentUser) {
    console.warn('로그인되지 않아 저장을 건너뜁니다.');
    return;
  }

  if (isImmediate) {
    clearTimeout(_saveDebounceTimer);
    _performSave();
    return;
  }

  // 디바운스: 마지막 호출 후 SAVE_DEBOUNCE_MS 이내에 다시 호출되면 타이머 리셋
  clearTimeout(_saveDebounceTimer);
  _saveDebounceTimer = setTimeout(() => {
    _performSave();
  }, SAVE_DEBOUNCE_MS);
}

/** 실제 Firestore 저장 수행 */
async function _performSave() {
  if (!currentUser) return;

  updateSaveIndicator('saving');

  try {
    const uid = currentUser.uid;
    const userDocRef = db.collection('users').doc(uid);

    // appState를 Firestore 문서로 저장
    // Firestore 문서 크기 제한(1MB)에 대비하여 하위 컬렉션으로 분리
    const stateToSave = {
      classes: appState.classes || [],
      currentClassId: appState.currentClassId || null,
      behaviorTypes: appState.behaviorTypes || null,
      timetable: appState.timetable || {},
      weeklyTimetable: appState.weeklyTimetable || {},
      holidays: appState.holidays || [],
      timeConfig: appState.timeConfig || [],
      termSettings: appState.termSettings || {},
      theme: appState.theme || 'dark',
      sidebarCollapsed: appState.sidebarCollapsed || false,
      tabsCollapsed: appState.tabsCollapsed || false,
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    };

    // 메인 설정 문서 저장
    await userDocRef.set(stateToSave, { merge: true });

    // 행동 기록 (별도 문서로 저장 - 데이터 크기 분리)
    await userDocRef.collection('data').doc('behaviors').set({
      records: appState.behaviors || [],
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    });

    // 출결 기록 (별도 문서로 저장)
    await userDocRef.collection('data').doc('attendance').set({
      records: appState.attendance || [],
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    });

    // 상담 기록 (별도 문서로 저장)
    await userDocRef.collection('data').doc('counseling').set({
      records: appState.counselingRecords || [],
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    });

    updateSaveIndicator('saved');
    console.log('☁️ Firestore 저장 완료');

  } catch (error) {
    console.error('Firestore 저장 실패:', error);
    updateSaveIndicator('error');
    
    // 실패 시 로컬스토리지에 백업 저장
    try {
      localStorage.setItem('smartClassroom_backup', JSON.stringify(appState));
      console.log('📦 로컬 백업 저장 완료');
    } catch (e) {
      console.error('로컬 백업도 실패:', e);
    }
  }
}

/**
 * Firestore에서 앱 상태 불러오기
 * 기존 loadState()를 대체합니다.
 */
async function loadStateFromFirestore() {
  if (!currentUser) return;

  const loadingEl = document.getElementById('loadingOverlay');
  if (loadingEl) loadingEl.classList.remove('hidden');

  try {
    const uid = currentUser.uid;
    const userDocRef = db.collection('users').doc(uid);

    // 메인 설정 문서 불러오기
    const mainDoc = await userDocRef.get();

    if (mainDoc.exists) {
      const data = mainDoc.data();
      
      // appState에 병합 (기본값 유지하면서 덮어쓰기)
      if (data.classes) appState.classes = data.classes;
      if (data.currentClassId) appState.currentClassId = data.currentClassId;
      if (data.behaviorTypes) appState.behaviorTypes = data.behaviorTypes;
      if (data.timetable) appState.timetable = data.timetable;
      if (data.weeklyTimetable) appState.weeklyTimetable = data.weeklyTimetable;
      if (data.holidays) appState.holidays = data.holidays;
      if (data.timeConfig) appState.timeConfig = data.timeConfig;
      if (data.termSettings) appState.termSettings = { ...appState.termSettings, ...data.termSettings };
      if (data.theme) appState.theme = data.theme;
      if (typeof data.sidebarCollapsed !== 'undefined') appState.sidebarCollapsed = data.sidebarCollapsed;
      if (typeof data.tabsCollapsed !== 'undefined') appState.tabsCollapsed = data.tabsCollapsed;

      console.log('📥 메인 설정 불러오기 완료');
    } else {
      console.log('📋 새 사용자 - 초기 데이터를 생성합니다.');
    }

    // 행동 기록 불러오기
    const behaviorDoc = await userDocRef.collection('data').doc('behaviors').get();
    if (behaviorDoc.exists && behaviorDoc.data().records) {
      appState.behaviors = behaviorDoc.data().records;
      console.log(`📥 행동 기록 ${appState.behaviors.length}건 불러오기 완료`);
    }

    // 출결 기록 불러오기
    const attendanceDoc = await userDocRef.collection('data').doc('attendance').get();
    if (attendanceDoc.exists && attendanceDoc.data().records) {
      appState.attendance = attendanceDoc.data().records;
      console.log(`📥 출결 기록 ${appState.attendance.length}건 불러오기 완료`);
    }

    // 상담 기록 불러오기
    const counselingDoc = await userDocRef.collection('data').doc('counseling').get();
    if (counselingDoc.exists && counselingDoc.data().records) {
      appState.counselingRecords = counselingDoc.data().records;
      console.log(`📥 상담 기록 ${appState.counselingRecords.length}건 불러오기 완료`);
    }

    console.log('✅ 모든 데이터 불러오기 완료');

  } catch (error) {
    console.error('Firestore 불러오기 실패:', error);
    showToast('데이터 불러오기에 실패했습니다. 네트워크를 확인해주세요.', 'error');
    
    // 로컬 백업이 있으면 복원 시도
    try {
      const backup = localStorage.getItem('smartClassroom_backup');
      if (backup) {
        const parsed = JSON.parse(backup);
        appState = { ...appState, ...parsed };
        showToast('로컬 백업에서 데이터를 복원했습니다.', 'warning');
      }
    } catch (e) {
      console.error('로컬 백업 복원도 실패:', e);
    }
  } finally {
    if (loadingEl) loadingEl.classList.add('hidden');
  }
}

/** 
 * 상담 기록 저장 (counseling.js에서 호출)
 * 상담 기록만 별도로 즉시 저장합니다.
 */
async function saveCounselingToFirestore() {
  if (!currentUser) return;
  
  try {
    const uid = currentUser.uid;
    await db.collection('users').doc(uid).collection('data').doc('counseling').set({
      records: appState.counselingRecords || [],
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    });
    console.log('☁️ 상담 기록 저장 완료');
  } catch (error) {
    console.error('상담 기록 저장 실패:', error);
  }
}

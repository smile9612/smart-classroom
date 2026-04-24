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
    _saveIndicator = document.getElementById('saveIndicatorCloud');
  }
  if (!_saveIndicator) return;

  const baseClass = 'save-indicator tab-side';
  
  switch (status) {
    case 'saving':
      _saveIndicator.innerHTML = '<span class="spin-icon">🔄</span> 저장 중...';
      _saveIndicator.className = `${baseClass} saving`;
      break;
    case 'saved':
      _saveIndicator.innerHTML = '✅ 저장 완료';
      _saveIndicator.className = `${baseClass} saved`;
      // 3초 후 초기화
      setTimeout(() => {
        if (_saveIndicator.className.includes('saved')) {
          _saveIndicator.className = baseClass;
          _saveIndicator.innerHTML = '';
        }
      }, 3000);
      break;
    case 'error':
      _saveIndicator.innerHTML = '❌ 저장 실패';
      _saveIndicator.className = `${baseClass} error`;
      break;
    default:
      _saveIndicator.className = baseClass;
      _saveIndicator.innerHTML = '';
  }
}

/** 
 * Firestore에 전체 앱 상태 저장
 * @param {boolean} isImmediate true일 경우 디바운스 없이 즉시 저장 (복원 등 중요 작업 시)
 * @returns {Promise<void>}
 */
function saveState(isImmediate = false) {
  // 로그인되지 않은 경우 무시
  if (!currentUser) {
    console.warn('로그인되지 않아 저장을 건너뜁니다.');
    return Promise.resolve();
  }

  if (isImmediate) {
    clearTimeout(_saveDebounceTimer);
    return _performSave();
  }

  // 디바운스: 마지막 호출 후 SAVE_DEBOUNCE_MS 이내에 다시 호출되면 타이머 리셋
  clearTimeout(_saveDebounceTimer);
  return new Promise((resolve) => {
    _saveDebounceTimer = setTimeout(async () => {
      await _performSave();
      resolve();
    }, SAVE_DEBOUNCE_MS);
  });
}

/** 실제 Firestore 저장 수행 */
async function _performSave() {
  if (!currentUser) return;

  updateSaveIndicator('saving');

  // 타임아웃 처리 (15초 내에 완료되지 않으면 에러로 간주)
  const saveTimeout = setTimeout(() => {
    console.warn('⚠️ Firestore 저장 타임아웃 발생 (15초 경과)');
    updateSaveIndicator('error');
    showToast('저장 시간이 오래 걸리고 있습니다. 네트워크를 확인해주세요.', 'warning');
  }, 15000);

  try {
    const uid = currentUser.uid;
    const userDocRef = db.collection('users').doc(uid);
    const dataCol = userDocRef.collection('data');
    const now = new Date().toISOString();

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
      lastUpdated: now
    };

    console.log('🔄 클라우드 데이터 병렬 저장 시작...');

    // undefined 값으로 인한 Firestore 저장 실패를 막기 위해 JSON 직렬화/역직렬화로 데이터 정제
    const cleanState = JSON.parse(JSON.stringify(stateToSave));
    const cleanBehaviors = JSON.parse(JSON.stringify({ records: appState.behaviors || [], lastUpdated: now }));
    const cleanAttendance = JSON.parse(JSON.stringify({ records: appState.attendance || [], lastUpdated: now }));
    const cleanCounseling = JSON.parse(JSON.stringify({ records: appState.counselingRecords || [], lastUpdated: now }));

    // 4개 영역을 동시에 저장 (저장 속도 최적화)
    await Promise.all([
      userDocRef.set(cleanState, { merge: true }),
      dataCol.doc('behaviors').set(cleanBehaviors),
      dataCol.doc('attendance').set(cleanAttendance),
      dataCol.doc('counseling').set(cleanCounseling)
    ]);

    clearTimeout(saveTimeout); // 타임아웃 해제
    updateSaveIndicator('saved');
    console.log('✅ 클라우드 저장 완료');

  } catch (error) {
    clearTimeout(saveTimeout);
    console.error('Firestore 저장 실패:', error);
    updateSaveIndicator('error');
    
    // 에러 원인을 명확하게 표시 (용량 초과, 권한 부족 등)
    let errorMsg = '서버 저장 중 오류가 발생했습니다.';
    if (error.message) {
      if (error.message.includes('permission')) {
        errorMsg = '저장 권한이 없습니다. (Firebase Security Rules 확인 필요)';
      } else if (error.message.includes('exceeds limits') || error.message.includes('too large')) {
        errorMsg = '저장할 데이터 용량이 초과되었습니다. (1MB 제한)';
      } else {
        errorMsg = `저장 실패: ${error.message}`;
      }
    }
    showToast(errorMsg, 'error', 5000);
    
    // 실패 시 네트워크 재설정 시도 (오프라인 고착 현상 복구)
    console.log('🔄 네트워크 재설정 시도 중...');
    db.disableNetwork().then(() => db.enableNetwork());

    // 실패 시 로컬스토리지에 백업 저장
    try {
      localStorage.setItem('smartClassroom_backup', JSON.stringify(appState));
    } catch (e) {
      console.error('로컬 백업 실패:', e);
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

  console.log('🔄 클라우드 데이터 병렬 로딩 시작...');

  try {
    const uid = currentUser.uid;
    const userDocRef = db.collection('users').doc(uid);
    const dataCol = userDocRef.collection('data');

    // 4개 문서를 동시에 요청 (로딩 속도 최적화)
    const [mainDoc, behaviorDoc, attendanceDoc, counselingDoc] = await Promise.all([
      userDocRef.get(),
      dataCol.doc('behaviors').get(),
      dataCol.doc('attendance').get(),
      dataCol.doc('counseling').get()
    ]);

    // 1. 메인 설정
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
      console.log('📥 메인 설정 로드 완료');
    }

    // 2. 행동 기록
    if (behaviorDoc.exists && behaviorDoc.data().records) {
      appState.behaviors = behaviorDoc.data().records;
    }

    // 3. 출결 기록
    if (attendanceDoc.exists && attendanceDoc.data().records) {
      appState.attendance = attendanceDoc.data().records;
    }

    // 4. 상담 기록
    if (counselingDoc.exists && counselingDoc.data().records) {
      appState.counselingRecords = counselingDoc.data().records;
    }

    console.log('✅ 클라우드 모든 데이터 로드 완료');

  } catch (error) {
    console.error('Firestore 불러오기 실패:', error);
    showToast('데이터 불러오기에 실패했습니다. 네트워크를 확인해주세요.', 'error');
    
    // 로컬 백업이 있으면 복원 시도
    try {
      const backup = localStorage.getItem('smartClassroom_backup');
      if (backup) {
        const parsed = JSON.parse(backup);
        Object.assign(appState, parsed);
        showToast('로컬 백업에서 데이터를 복원했습니다.', 'warning');
      }
    } catch (e) {
      console.error('로컬 백업 복원 실패:', e);
    }
  } finally {
    if (loadingEl) loadingEl.classList.add('hidden');
    
    // UI 전체 갱신
    if (typeof updateClassSelect === 'function') updateClassSelect();
    if (typeof renderSeating === 'function') renderSeating();
    if (typeof renderStudentSidebar === 'function') renderStudentSidebar();
    if (typeof applyTheme === 'function') applyTheme();
    if (typeof applyLayoutSettings === 'function') applyLayoutSettings();
    if (typeof checkAndRunAutoBackup === 'function') checkAndRunAutoBackup();
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
    const cleanData = JSON.parse(JSON.stringify({
      records: appState.counselingRecords || [],
      lastUpdated: new Date().toISOString()
    }));
    await db.collection('users').doc(uid).collection('data').doc('counseling').set(cleanData);
    console.log('☁️ 상담 기록 개별 저장 완료');
  } catch (error) {
    console.error('상담 기록 저장 실패:', error);
  }
}

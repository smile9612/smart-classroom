/* ==========================================
   auth.js - Firebase 인증 (구글 로그인) 관리
   ========================================== */

// 현재 로그인된 사용자 정보
let currentUser = null;

// ── 로그인 화면 표시/숨김 ──

/** 로그인 화면 표시 (메인 앱 숨김) */
function showLoginScreen() {
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('appContainer').classList.add('hidden');
}

/** 메인 앱 표시 (로그인 화면 숨김) */
function showAppScreen() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appContainer').classList.remove('hidden');
}

// ── 구글 로그인 ──

/** 구글 계정으로 로그인 */
async function signInWithGoogle() {
  const btn = document.getElementById('btnGoogleLogin');
  const errorEl = document.getElementById('loginError');
  
  // 버튼 비활성화 및 로딩 표시
  btn.disabled = true;
  btn.innerHTML = '<span class="login-spinner"></span> 로그인 중...';
  errorEl.classList.add('hidden');

  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    // 항상 계정 선택 창을 보여주도록 설정
    provider.setCustomParameters({ prompt: 'select_account' });
    
    await auth.signInWithPopup(provider);
    // 인증 상태 변화 리스너가 처리
  } catch (error) {
    console.error('로그인 실패:', error);
    
    let errorMsg = '로그인에 실패했습니다. 다시 시도해주세요.';
    if (error.code === 'auth/popup-closed-by-user') {
      errorMsg = '로그인 창이 닫혔습니다. 다시 시도해주세요.';
    } else if (error.code === 'auth/network-request-failed') {
      errorMsg = '네트워크 연결을 확인해주세요.';
    } else if (error.code === 'auth/popup-blocked') {
      errorMsg = '팝업이 차단되었습니다. 팝업 차단을 해제해주세요.';
    }
    
    errorEl.textContent = errorMsg;
    errorEl.classList.remove('hidden');
    
    btn.disabled = false;
    btn.innerHTML = '<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" class="google-icon" /> Google 계정으로 로그인';
  }
}

/** 로그아웃 */
async function signOut() {
  if (!confirm('로그아웃 하시겠습니까? 저장되지 않은 변경 사항이 있을 수 있습니다.')) return;
  
  try {
    await auth.signOut();
    // 인증 상태 변화 리스너가 처리
    showToast('로그아웃 되었습니다.', 'info');
  } catch (error) {
    console.error('로그아웃 실패:', error);
    showToast('로그아웃에 실패했습니다.', 'error');
  }
}

// ── 사용자 프로필 UI 업데이트 ──

/** 헤더에 사용자 정보 표시 */
function updateUserProfile(user) {
  const profileArea = document.getElementById('userProfile');
  if (!profileArea) return;
  
  if (user) {
    const displayName = user.displayName || user.email || '사용자';
    const photoURL = user.photoURL || '';
    
    profileArea.innerHTML = `
      <div class="user-info" title="${user.email}">
        ${photoURL ? `<img src="${photoURL}" alt="프로필" class="user-avatar" referrerpolicy="no-referrer" />` : '<span class="user-avatar-placeholder">👤</span>'}
        <span class="user-name">${displayName}</span>
      </div>
      <button id="btnSignOut" class="btn btn-ghost btn-sm btn-logout" title="로그아웃">🚪</button>
    `;
    
    // 로그아웃 버튼 이벤트
    document.getElementById('btnSignOut').addEventListener('click', signOut);
  } else {
    profileArea.innerHTML = '';
  }
}

// ── Firebase 인증 상태 감시 ──

/** 인증 상태 변화 리스너 (핵심) */
auth.onAuthStateChanged(async (user) => {
  if (user) {
    // ✅ 로그인 성공
    currentUser = user;
    console.log('✅ 로그인 성공:', user.displayName, user.uid);
    
    // 사용자 프로필 UI 업데이트
    updateUserProfile(user);
    
    // 로그인 화면 → 앱 화면 전환
    showAppScreen();
    
    // Firestore에서 데이터 불러오기 후 앱 초기화
    await loadStateFromFirestore();
    initApp();
    
  } else {
    // ❌ 로그아웃 상태
    currentUser = null;
    console.log('❌ 로그아웃 상태');
    
    // 사용자 프로필 초기화
    updateUserProfile(null);
    
    // 앱 화면 → 로그인 화면 전환
    showLoginScreen();
  }
});

// ── 로그인 버튼 이벤트 바인딩 ──
document.addEventListener('DOMContentLoaded', () => {
  const btnGoogle = document.getElementById('btnGoogleLogin');
  if (btnGoogle) {
    btnGoogle.addEventListener('click', signInWithGoogle);
  }
});

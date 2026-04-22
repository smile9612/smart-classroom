/* ==========================================
   firebase-config.js - Firebase 초기화 설정
   ========================================== */

// Firebase 앱 설정 (사용자 프로젝트)
const firebaseConfig = {
  apiKey: "AIzaSyCFX5oiwBytONlDezW8iNREd5BSa0KJzFM",
  authDomain: "smart-classroom-web.firebaseapp.com",
  projectId: "smart-classroom-web",
  storageBucket: "smart-classroom-web.firebasestorage.app",
  messagingSenderId: "842065402289",
  appId: "1:842065402289:web:c1626a2d58e7284c014590"
};

// Firebase 앱 초기화
firebase.initializeApp(firebaseConfig);

// Firestore 오프라인 캐시 활성화 (더 안전한 설정)
firebase.firestore().enablePersistence({ synchronizeTabs: true })
  .catch((err) => {
    console.warn('Firestore Persistence:', err.code);
  });

const db = firebase.firestore();
const auth = firebase.auth();

// 강제 온라인 전환 로직 (오프라인 멈춤 방지 핵심)
async function ensureFirestoreOnline() {
  try {
    await db.enableNetwork();
    console.log('🌐 Firestore Online Status: Forced Enabled');
  } catch (err) {
    console.error('Firestore Online Error:', err);
  }
}

// 초기 로드 시 및 주기적으로 온라인 확인
ensureFirestoreOnline();
setInterval(ensureFirestoreOnline, 30000); // 30초마다 연결 확인

console.log('✅ Firebase 초기화 및 네트워크 감시 시작');

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

// Firebase 서비스 인스턴스
const auth = firebase.auth();
const db = firebase.firestore();

// Firestore 오프라인 캐시 활성화
db.enablePersistence({ synchronizeTabs: true })
  .catch((err) => {
    console.warn('Firestore Persistence Error:', err.code);
  });

// 강제 온라인 전환 (오프라인 멈춤 현상 방지)
db.enableNetwork()
  .then(() => console.log('🌐 Firestore Online Status: Enabled'))
  .catch((err) => console.error('Firestore Online Status Error:', err));

console.log('✅ Firebase 초기화 완료');

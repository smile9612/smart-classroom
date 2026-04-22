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

// Firestore 오프라인 캐시 활성화 (한 번만 호출)
db.enablePersistence({ synchronizeTabs: true })
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      // 다중 탭에서 사용 시 발생 가능 – 무시
      console.warn('Firestore 오프라인 캐시: 다중 탭 환경에서는 제한됩니다.');
    } else if (err.code === 'unimplemented') {
      console.warn('Firestore 오프라인 캐시: 이 브라우저에서 지원되지 않습니다.');
    }
  });

console.log('✅ Firebase 초기화 완료');

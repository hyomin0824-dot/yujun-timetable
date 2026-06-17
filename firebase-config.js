// Firebase 프로젝트 설정 (yujun-timetable)
// 호환(compat) 버전: import/export 없이 일반 스크립트로 동작합니다.
firebase.initializeApp({
  apiKey: "AIzaSyB4irbIVbjt3xzJ2uHK59wkvtpFBks0j_Y",
  authDomain: "yujun-timetable.firebaseapp.com",
  projectId: "yujun-timetable",
  storageBucket: "yujun-timetable.firebasestorage.app",
  messagingSenderId: "169664012236",
  appId: "1:169664012236:web:f8c8b516dcfb9ac78c8769",
});

window.db = firebase.firestore();

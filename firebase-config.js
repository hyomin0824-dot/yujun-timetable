// Firebase 프로젝트 설정 (yujun-timetable)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB4irbIVbjt3xzJ2uHK59wkvtpFBks0j_Y",
  authDomain: "yujun-timetable.firebaseapp.com",
  projectId: "yujun-timetable",
  storageBucket: "yujun-timetable.firebasestorage.app",
  messagingSenderId: "169664012236",
  appId: "1:169664012236:web:f8c8b516dcfb9ac78c8769",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

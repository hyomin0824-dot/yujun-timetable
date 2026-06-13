import React, { useState, useEffect, useRef } from "react";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-config.js";

// 가족 공유 데이터 경로. 모든 가족 구성원이 같은 경로를 보고/씁니다.
const FAMILY_ID = "yujun";
const famCol = (name) => collection(db, "families", FAMILY_ID, name);
const famDoc = (name, id) => doc(db, "families", FAMILY_ID, name, id);

// 빈 시간대 길게 누르기 감지 헬퍼
// - 스크롤이 시작되면 브라우저가 pointercancel을 보내므로 그 즉시 취소
// - 기본 길게누르기 메뉴/텍스트 선택은 차단해 두었으므로 0.9초로 여유 있게
function useLongPress(callback) {
  const timer = useRef(null);
  const startPos = useRef(null);

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    startPos.current = null;
  };

  const onPointerDown = (e, payload) => {
    // 일정 블록(버튼) 위에서는 동작하지 않음
    if (e.target.closest("button")) return;
    startPos.current = { x: e.clientX, y: e.clientY };
    timer.current = setTimeout(() => {
      callback(payload);
      cancel();
    }, 900);
  };

  const onPointerMove = (e) => {
    if (!startPos.current) return;
    const dx = Math.abs(e.clientX - startPos.current.x);
    const dy = Math.abs(e.clientY - startPos.current.y);
    if (dx > 10 || dy > 10) cancel(); // 손가락이 움직이면 취소
  };

  // 길게 누르는 영역에 공통으로 줄 스타일/속성
  const holdProps = {
    onPointerMove,
    onPointerUp: cancel,
    onPointerCancel: cancel, // 브라우저가 스크롤을 시작하면 즉시 취소
    onContextMenu: (e) => e.preventDefault(), // 기본 길게누르기 메뉴 차단
    style: {
      touchAction: "pan-y",
      userSelect: "none",
      WebkitUserSelect: "none",
      WebkitTouchCallout: "none",
    },
  };

  return { onPointerDown, onPointerMove, cancel, holdProps };
}

// ---------- 기본 데이터 ----------
const DAYS = ["월", "화", "수", "목", "금", "토", "일"];
const SHOWN_DAYS = DAYS; // 월~일

// 고를 수 있는 아이콘 (수학, 영어, 독서논술, 과학, 미술, 농구, 속독, 글쓰기, 문제집 등)
const ICONS = ["🏫", "📚", "🔢", "🔠", "📖", "🔬", "🎨", "🏀", "👀", "✍️", "📝", "🎹", "💻", "⚽", "🥋", "🏊", "🎮", "✏️", "🎵", "⭐"];

// 고를 수 있는 색깔
const COLORS = {
  blue: { bg: "bg-blue-100", border: "border-blue-300", text: "text-blue-700", chip: "bg-blue-400" },
  sky: { bg: "bg-sky-100", border: "border-sky-300", text: "text-sky-700", chip: "bg-sky-400" },
  teal: { bg: "bg-teal-100", border: "border-teal-300", text: "text-teal-700", chip: "bg-teal-400" },
  green: { bg: "bg-green-100", border: "border-green-300", text: "text-green-700", chip: "bg-green-400" },
  yellow: { bg: "bg-yellow-100", border: "border-yellow-300", text: "text-yellow-700", chip: "bg-yellow-400" },
  orange: { bg: "bg-orange-100", border: "border-orange-300", text: "text-orange-700", chip: "bg-orange-400" },
  red: { bg: "bg-red-100", border: "border-red-300", text: "text-red-700", chip: "bg-red-400" },
  pink: { bg: "bg-pink-100", border: "border-pink-300", text: "text-pink-700", chip: "bg-pink-400" },
  purple: { bg: "bg-purple-100", border: "border-purple-300", text: "text-purple-700", chip: "bg-purple-400" },
  indigo: { bg: "bg-indigo-100", border: "border-indigo-300", text: "text-indigo-700", chip: "bg-indigo-400" },
};

// 예전 "종류" 데이터를 아이콘+색깔로 바꾸기 위한 변환표
const CAT_MIGRATE = {
  school: { icon: "🏫", color: "yellow" },
  academy: { icon: "📚", color: "orange" },
  art: { icon: "🎹", color: "teal" },
  sports: { icon: "⚽", color: "green" },
  homework: { icon: "✏️", color: "purple" },
  fun: { icon: "🎮", color: "pink" },
};

const styleOf = (item) =>
  COLORS[item.color] || COLORS[(CAT_MIGRATE[item.cat] || {}).color] || COLORS.orange;
const iconOf = (item) => item.icon || (CAT_MIGRATE[item.cat] || {}).icon || "📚";

// 저장된 옛 데이터 자동 변환 (이름 수정 + 종류→아이콘/색깔)
const migrateItems = (arr) =>
  arr.map((i) => {
    const m = { ...i };
    if (m.title === "비피아트") m.title = "비끄아트";
    if (m.title === "리디아") m.title = "리드101";
    if (!m.icon) {
      const c = CAT_MIGRATE[m.cat] || {};
      m.icon = c.icon || "📚";
      m.color = m.color || c.color || "orange";
    }
    return m;
  });

// 유준이의 실제 시간표 (손글씨 시간표 기준)
const SAMPLE = [
  // 월
  { id: "s1", day: 0, title: "학교", start: "08:40", end: "14:30", icon: "🏫", color: "yellow", memo: "" },
  { id: "s2", day: 0, title: "와이즈만 (사고력)", start: "15:30", end: "17:30", icon: "🔢", color: "red", memo: "" },
  { id: "s3", day: 0, title: "과학과외", start: "19:00", end: "21:00", icon: "🔬", color: "orange", memo: "" },
  // 화
  { id: "s4", day: 1, title: "학교", start: "08:40", end: "14:30", icon: "🏫", color: "yellow", memo: "" },
  { id: "s5", day: 1, title: "비끄아트", start: "15:00", end: "16:00", icon: "🎨", color: "teal", memo: "" },
  { id: "s6", day: 1, title: "피아노", start: "16:00", end: "17:00", icon: "🎹", color: "sky", memo: "" },
  { id: "s7", day: 1, title: "리드101", start: "17:00", end: "19:00", icon: "🔠", color: "indigo", memo: "" },
  // 수
  { id: "s8", day: 2, title: "학교", start: "08:40", end: "13:40", icon: "🏫", color: "yellow", memo: "" },
  { id: "s9", day: 2, title: "방과후 컴퓨터교실", start: "13:50", end: "15:05", icon: "💻", color: "blue", memo: "" },
  { id: "s10", day: 2, title: "피아노", start: "16:00", end: "17:00", icon: "🎹", color: "sky", memo: "" },
  { id: "s11", day: 2, title: "와이즈만 (교과)", start: "17:30", end: "19:30", icon: "🔢", color: "red", memo: "" },
  // 목
  { id: "s12", day: 3, title: "학교", start: "08:40", end: "14:30", icon: "🏫", color: "yellow", memo: "" },
  { id: "s13", day: 3, title: "글빛여정", start: "14:50", end: "16:50", icon: "📖", color: "purple", memo: "" },
  { id: "s14", day: 3, title: "리드101", start: "17:00", end: "19:00", icon: "🔠", color: "indigo", memo: "" },
  // 금
  { id: "s15", day: 4, title: "학교", start: "08:40", end: "14:30", icon: "🏫", color: "yellow", memo: "" },
  { id: "s16", day: 4, title: "와이즈만 (교과)", start: "15:30", end: "17:30", icon: "🔢", color: "red", memo: "" },
  // 토
  { id: "s17", day: 5, title: "과학영재원", start: "09:00", end: "12:30", icon: "🔬", color: "orange", memo: "" },
  { id: "s18", day: 5, title: "과학과외", start: "13:30", end: "15:30", icon: "🔬", color: "orange", memo: "" },
];

// 유준이의 주간 할 일 (과목 × 요일 체크)
const TODO_SAMPLE = [
  // 와이즈만 숙제: 월, 목, 토
  { id: "t1", day: 0, text: "와이즈만", done: false },
  { id: "t2", day: 3, text: "와이즈만", done: false },
  { id: "t3", day: 5, text: "와이즈만", done: false },
  // 글빛여정: 토
  { id: "t4", day: 5, text: "글빛여정", done: false },
  // 구몬: 월, 화, 수, 목
  { id: "t5", day: 0, text: "구몬", done: false },
  { id: "t6", day: 1, text: "구몬", done: false },
  { id: "t7", day: 2, text: "구몬", done: false },
  { id: "t8", day: 3, text: "구몬", done: false },
  // 빠작: 화, 수, 토
  { id: "t9", day: 1, text: "빠작", done: false },
  { id: "t10", day: 2, text: "빠작", done: false },
  { id: "t11", day: 5, text: "빠작", done: false },
  // 요약독해: 화, 수, 토
  { id: "t12", day: 1, text: "요약독해", done: false },
  { id: "t13", day: 2, text: "요약독해", done: false },
  { id: "t14", day: 5, text: "요약독해", done: false },
  // 한국사: 화, 금, 토
  { id: "t15", day: 1, text: "한국사", done: false },
  { id: "t16", day: 4, text: "한국사", done: false },
  { id: "t17", day: 5, text: "한국사", done: false },
  // ☆ 학교숙제: 토
  { id: "t18", day: 5, text: "독서록 ☆", done: false },
  { id: "t19", day: 5, text: "글짓기 ☆", done: false },
  // 일요일
  { id: "t20", day: 6, text: "와이즈만", done: false },
  { id: "t21", day: 6, text: "글빛여정", done: false },
  { id: "t22", day: 6, text: "구몬", done: false },
  { id: "t23", day: 6, text: "빠작", done: false },
  { id: "t24", day: 6, text: "요약독해", done: false },
  { id: "t25", day: 6, text: "한국사", done: false },
];

// ---------- 유틸 ----------
const todayIndex = () => (new Date().getDay() + 6) % 7; // 월=0 ... 일=6
const defaultDay = () => todayIndex();

const fmt = (t) => {
  const [h, m] = t.split(":").map(Number);
  const period = h < 12 ? "오전" : "오후";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${period} ${h12}:${String(m).padStart(2, "0")}`;
};

const toMinutes = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

// ---------- 메인 ----------
export default function KidsTimetable() {
  const [items, setItems] = useState(null); // null = 로딩 중
  const [todos, setTodos] = useState([]);
  const [comments, setComments] = useState([]);
  const [toast, setToast] = useState(null); // { msg, key }
  const [day, setDay] = useState(defaultDay());
  const [view, setView] = useState("day"); // "day" | "week"
  const [editing, setEditing] = useState(null); // 기존 일정 수정
  const [draft, setDraft] = useState(null); // 새 일정(추가/복사) 초기값
  const [selected, setSelected] = useState([]); // 선택된 일정 id 목록
  const [confirmDelete, setConfirmDelete] = useState(false);
  const selecting = selected.length > 0;

  // 일정을 누르면 바로 선택 모드
  const handlePick = (item) => {
    setSelected((s) =>
      s.includes(item.id) ? s.filter((id) => id !== item.id) : [...s, item.id]
    );
  };

  const exitSelectMode = () => {
    setSelected([]);
    setConfirmDelete(false);
  };

  const deleteSelected = () => {
    deleteItems(selected);
    exitSelectMode();
  };

  // 1개 선택 시 수정 버튼
  const editSelected = () => {
    const target = items.find((i) => i.id === selected[0]);
    if (target) setEditing(target);
    setSelected([]);
  };

  // 1개 선택 시 복사 버튼: 내용을 복사한 새 일정 화면 열기
  const copySelected = () => {
    const t = items.find((i) => i.id === selected[0]);
    if (t)
      setDraft({ day: t.day, title: t.title, start: t.start, end: t.end, icon: t.icon || iconOf(t), color: t.color || "orange", memo: t.memo });
    setSelected([]);
  };

  // 빈 시간대를 길게 누르면 그 시간으로 새 일정 화면 열기
  const openDraftAt = (d, startMin) => {
    const endMin = Math.min(startMin + 60, 24 * 60 - 1);
    const toT = (m) =>
      String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
    setDraft({ day: d, title: "", start: toT(startMin), end: toT(endMin), icon: "📚", color: "orange", memo: "" });
  };

  // Firestore 실시간 구독: 가족 누구든 바꾸면 모든 기기에 바로 반영됨
  useEffect(() => {
    const unsubItems = onSnapshot(famCol("items"), (snap) => {
      if (snap.empty) {
        // 처음 사용: 샘플 시간표를 가족 공유 DB에 한 번 씁니다
        const batch = writeBatch(db);
        SAMPLE.forEach((it) => batch.set(famDoc("items", it.id), it));
        batch.commit().catch((e) => console.error("초기 데이터 저장 실패", e));
      } else {
        setItems(snap.docs.map((d) => migrateItems([{ id: d.id, ...d.data() }])[0]));
      }
    }, (e) => {
      console.error("items 구독 실패", e);
      setItems(SAMPLE);
    });

    const unsubTodos = onSnapshot(famCol("todos"), (snap) => {
      if (snap.empty) {
        const batch = writeBatch(db);
        TODO_SAMPLE.forEach((t) => batch.set(famDoc("todos", t.id), t));
        batch.commit().catch((e) => console.error("초기 할일 저장 실패", e));
      } else {
        setTodos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    }, (e) => console.error("todos 구독 실패", e));

    const unsubComments = onSnapshot(famCol("comments"), (snap) => {
      setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (e) => console.error("comments 구독 실패", e));

    return () => {
      unsubItems();
      unsubTodos();
      unsubComments();
    };
  }, []);

  // 알림 배너 띄우기 (몇 초 후 자동으로 사라짐)
  const notify = (msg) => {
    const key = Date.now();
    setToast({ msg, key });
    setTimeout(() => {
      setToast((t) => (t && t.key === key ? null : t));
    }, 4000);
  };

  // 할 일에 설정한 시간이 되면 알림 배너 띄우기 (앱이 열려 있을 때)
  const notifiedRef = useRef({}); // { "오늘날짜-할일id": true }
  useEffect(() => {
    const check = () => {
      const now = new Date();
      const todayKey = now.toDateString();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const nowT = `${hh}:${mm}`;
      const todayIdx = todayIndex();
      todos.forEach((t) => {
        if (t.done || !t.time || t.day !== todayIdx) return;
        if (t.time !== nowT) return;
        const key = `${todayKey}-${t.id}`;
        if (notifiedRef.current[key]) return;
        notifiedRef.current[key] = true;
        notify(`⏰ "${t.text}" 할 시간이에요!`);
      });
    };
    const id = setInterval(check, 20000); // 20초마다 확인
    check();
    return () => clearInterval(id);
  }, [todos]);

  // ---- Firestore 쓰기 헬퍼 ----
  const writeItem = (item) =>
    setDoc(famDoc("items", item.id), item).catch((e) => console.error("저장 실패", e));

  const writeItems = async (arr) => {
    const batch = writeBatch(db);
    arr.forEach((it) => batch.set(famDoc("items", it.id), it));
    try {
      await batch.commit();
    } catch (e) {
      console.error("저장 실패", e);
    }
  };

  const deleteItems = async (ids) => {
    const batch = writeBatch(db);
    ids.forEach((id) => batch.delete(famDoc("items", id)));
    try {
      await batch.commit();
    } catch (e) {
      console.error("삭제 실패", e);
    }
  };

  const writeTodo = (t) =>
    setDoc(famDoc("todos", t.id), t).catch((e) => console.error("저장 실패", e));

  const writeTodos = async (arr) => {
    const batch = writeBatch(db);
    arr.forEach((t) => batch.set(famDoc("todos", t.id), t));
    try {
      await batch.commit();
    } catch (e) {
      console.error("저장 실패", e);
    }
  };

  const deleteTodo = (id) =>
    deleteDoc(famDoc("todos", id)).catch((e) => console.error("삭제 실패", e));

  const toggleTodoDone = (id) => {
    const t = todos.find((x) => x.id === id);
    if (!t) return;
    setDoc(famDoc("todos", id), { ...t, done: !t.done }).catch((e) =>
      console.error("저장 실패", e)
    );
  };

  const writeComment = (c) =>
    setDoc(famDoc("comments", c.id), c).catch((e) => console.error("저장 실패", e));

  const deleteComment = (id) =>
    deleteDoc(famDoc("comments", id)).catch((e) => console.error("삭제 실패", e));

  const upsert = (form, opts = {}) => {
    if (form.id) {
      // 기존 일정 수정
      writeItem(form);
    } else {
      // 새 일정: 선택한 요일마다 하나씩 생성
      const days = opts.days && opts.days.length ? opts.days : [form.day];
      const base = Date.now();
      const newItems = days.map((d, idx) => ({
        ...form,
        day: d,
        id: "id" + (base + idx),
      }));
      writeItems(newItems);

      // 체크리스트에도 자동 추가
      if (opts.addToChecklist && form.title.trim()) {
        const newTodos = days.map((d, idx) => ({
          id: "t" + (base + idx),
          day: d,
          text: form.title.trim(),
          done: false,
        }));
        writeTodos(newTodos);
      }
    }
    setEditing(null);
    setDraft(null);
  };

  const remove = (id) => {
    deleteItems([id]);
    setEditing(null);
    setDraft(null);
  };

  if (items === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400">
        시간표 불러오는 중...
      </div>
    );
  }

  const dayItems = items
    .filter((i) => i.day === day)
    .sort((a, b) => a.start.localeCompare(b.start));

  const isToday = day === todayIndex();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-md mx-auto relative">
      {/* 알림 배너 */}
      {toast && (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md">
          <div className="bg-slate-800 text-white rounded-2xl shadow-lg px-4 py-3 flex items-center gap-2 animate-[fadeIn_0.2s_ease-out]">
            <span className="text-sm font-bold flex-1">{toast.msg}</span>
            <button
              onClick={() => setToast(null)}
              className="text-slate-400 text-lg leading-none px-1"
              aria-label="닫기"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <header className="px-5 pt-6 pb-3 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">
            유준이의 일주일 <span className="text-xl">🗓️</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {selecting
              ? `${selected.length}개 선택됨`
              : view === "week"
              ? "한눈에 보는 일주일!"
              : isToday
              ? "오늘 할 일을 확인해 보자!"
              : `${DAYS[day]}요일 일정이야`}
          </p>
        </div>
        <div className="flex bg-white border border-slate-200 rounded-full p-1 mt-1">
          <button
            onClick={() => setView("day")}
            className={
              "px-3 py-1.5 rounded-full text-xs font-bold " +
              (view === "day" ? "bg-slate-800 text-white" : "text-slate-400")
            }
          >
            하루
          </button>
          <button
            onClick={() => setView("week")}
            className={
              "px-3 py-1.5 rounded-full text-xs font-bold " +
              (view === "week" ? "bg-slate-800 text-white" : "text-slate-400")
            }
          >
            일주일
          </button>
        </div>
      </header>

      {view === "week" ? (
        <WeekView
          items={items}
          selectedIds={selected}
          onPickDay={(i) => {
            setDay(i);
            setView("day");
          }}
          onPickItem={handlePick}
          onLongPressSlot={openDraftAt}
          todos={todos}
          onToggleTodo={toggleTodoDone}
          onMoveItem={(id, newDay, newStart, newEnd) => {
            const it = items.find((i) => i.id === id);
            if (it) writeItem({ ...it, day: newDay, start: newStart, end: newEnd });
          }}
        />
      ) : (
        <>
      {/* 요일 선택 탭 */}
      <nav className="flex gap-1.5 px-4 pb-3 overflow-x-auto">
        {SHOWN_DAYS.map((d, i) => {
          const active = i === day;
          const today = i === todayIndex();
          return (
            <button
              key={d}
              onClick={() => setDay(i)}
              className={
                "relative flex-1 min-w-10 py-2.5 rounded-2xl text-sm font-bold transition-all " +
                (active
                  ? "bg-slate-800 text-white shadow-md scale-105"
                  : "bg-white text-slate-500 border border-slate-200")
              }
            >
              {d}
              {today && (
                <span className={"absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full " + (active ? "bg-yellow-300" : "bg-red-400")} />
              )}
            </button>
          );
        })}
      </nav>

      {/* 하루 타임라인 */}
      <main className="flex-1 px-4 pb-28">
        {dayItems.length === 0 && (
          <div className="mt-6 mb-2 text-center">
            <div className="text-4xl mb-2">🛋️</div>
            <p className="font-bold text-slate-600 text-sm">
              일정이 없어요 — 빈 칸을 꾹 누르거나 + 버튼으로 추가해 보세요
            </p>
          </div>
        )}
        <DayTimeline
          items={dayItems}
          isToday={isToday}
          onPick={handlePick}
          selectedIds={selected}
          onLongPressSlot={(startMin) => openDraftAt(day, startMin)}
        />

        {/* 오늘의 할 일 메모지 */}
        <TodoPad
          day={day}
          todos={todos.filter((t) => t.day === day)}
          onAdd={(text, time) =>
            writeTodo({ id: "t" + Date.now(), day, text, time, done: false })
          }
          onToggle={toggleTodoDone}
          onRemove={deleteTodo}
        />

        {/* 하루 댓글 */}
        <CommentBox
          day={day}
          comments={comments.filter((c) => c.day === day)}
          onAdd={(text) => {
            const now = new Date();
            writeComment({
              id: "c" + Date.now(),
              day,
              text,
              at: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
            });
            notify("💬 댓글을 남겼어요");
          }}
          onRemove={deleteComment}
        />
      </main>
        </>
      )}

      {/* 추가 버튼 / 선택 모드 하단 바 */}
      {!selecting ? (
        <button
          onClick={() =>
            setDraft({ day, title: "", start: "15:00", end: "16:00", icon: "📚", color: "orange", memo: "" })
          }
          className="fixed bottom-6 right-5 w-14 h-14 rounded-full bg-slate-800 text-white text-3xl font-light shadow-lg active:scale-90 transition-transform flex items-center justify-center z-30"
          aria-label="일정 추가"
        >
          +
        </button>
      ) : (
        <div className="fixed bottom-0 left-0 right-0 flex justify-center z-40">
          <div className="w-full max-w-md bg-white border-t-2 border-slate-200 px-4 py-3 flex items-center gap-2 shadow-lg">
            <span className="text-sm font-extrabold text-slate-700 flex-1">
              {selected.length}개 선택됨
            </span>
            {selected.length === 1 && (
              <>
                <button
                  onClick={editSelected}
                  className="px-3 py-2.5 rounded-xl bg-slate-800 text-white font-bold text-sm"
                >
                  ✏️ 수정
                </button>
                <button
                  onClick={copySelected}
                  className="px-3 py-2.5 rounded-xl bg-blue-500 text-white font-bold text-sm"
                >
                  📋 복사
                </button>
              </>
            )}
            <button
              onClick={exitSelectMode}
              className="px-3 py-2.5 rounded-xl bg-white text-slate-500 font-bold border-2 border-slate-200 text-sm"
            >
              취소
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="px-3 py-2.5 rounded-xl bg-red-500 text-white font-extrabold active:scale-95 transition-transform"
            >
              🗑️
            </button>
          </div>
        </div>
      )}

      {/* 삭제 확인 */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-8">
          <div className="w-full max-w-xs bg-white rounded-3xl p-6 text-center">
            <div className="text-4xl mb-2">🗑️</div>
            <p className="font-extrabold text-slate-800 text-lg">
              {selected.length}개 선택됨
            </p>
            <p className="text-sm text-slate-500 font-semibold mt-1 mb-5">
              정말 삭제할까요?
            </p>
            <div className="flex gap-2">
              <button
                onClick={exitSelectMode}
                className="flex-1 py-3 rounded-xl bg-white text-slate-600 font-bold border-2 border-slate-200"
              >
                아니오
              </button>
              <button
                onClick={deleteSelected}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-extrabold active:scale-95 transition-transform"
              >
                예
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 추가/수정 모달 */}
      {(editing !== null || draft !== null) && (
        <EditSheet
          item={draft !== null ? draft : editing}
          isNew={draft !== null}
          onSave={upsert}
          onDelete={remove}
          onClose={() => {
            setEditing(null);
            setDraft(null);
          }}
        />
      )}
    </div>
  );
}

// ---------- 할 일 메모지 ----------
function TodoPad({ day, todos, onAdd, onToggle, onRemove }) {
  const [text, setText] = useState("");
  const [time, setTime] = useState("");
  const doneCount = todos.filter((t) => t.done).length;
  const allDone = todos.length > 0 && doneCount === todos.length;

  // 시간이 있는 항목 먼저(시간순), 없는 항목은 뒤에
  const sorted = [...todos].sort((a, b) => {
    if (a.time && b.time) return a.time.localeCompare(b.time);
    if (a.time) return -1;
    if (b.time) return 1;
    return 0;
  });

  const submit = () => {
    if (text.trim()) {
      onAdd(text.trim(), time || null);
      setText("");
      setTime("");
    }
  };

  return (
    <section className="mt-6 mb-2 relative">
      {/* 테이프 */}
      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-20 h-5 bg-amber-200/70 rotate-2 rounded-sm z-10" />

      <div
        className="rounded-lg border border-amber-200 shadow-md px-4 pt-5 pb-4"
        style={{
          background:
            "repeating-linear-gradient(#FEF9C3, #FEF9C3 31px, #FDE68A 31px, #FDE68A 32px)",
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-extrabold text-amber-800 text-base">
            📝 {DAYS[day]}요일 할 일
          </h2>
          {todos.length > 0 && (
            <span className="text-xs font-bold text-amber-700">
              {allDone ? "다 했다! 🎉" : `${doneCount} / ${todos.length} 완료`}
            </span>
          )}
        </div>

        {/* 할 일 목록 */}
        {todos.length === 0 ? (
          <p className="text-sm text-amber-600/70 font-semibold py-1">
            아래에 할 일을 적어보자!
          </p>
        ) : (
          <ul className="flex flex-col">
            {sorted.map((t) => (
              <li key={t.id} className="flex items-center gap-2" style={{ height: 32 }}>
                <button
                  onClick={() => onToggle(t.id)}
                  className={
                    "w-5 h-5 shrink-0 rounded-md border-2 flex items-center justify-center text-xs font-black " +
                    (t.done
                      ? "bg-green-500 border-green-500 text-white"
                      : "bg-white/70 border-amber-400 text-transparent")
                  }
                  aria-label={t.done ? "완료 취소" : "완료"}
                >
                  ✓
                </button>
                {t.time && (
                  <span
                    className={
                      "shrink-0 text-[10px] font-extrabold px-1.5 py-0.5 rounded-md " +
                      (t.done ? "bg-amber-100 text-amber-400" : "bg-amber-400 text-white")
                    }
                  >
                    🔔 {t.time}
                  </span>
                )}
                <span
                  className={
                    "flex-1 text-sm font-bold truncate " +
                    (t.done ? "text-amber-500 line-through" : "text-slate-700")
                  }
                >
                  {t.text}
                </span>
                <button
                  onClick={() => onRemove(t.id)}
                  className="text-amber-400 text-sm px-1"
                  aria-label="삭제"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* 입력 */}
        <div className="flex gap-2 mt-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="예: 알림장 보여드리기"
            className="flex-1 min-w-0 bg-white/80 border-2 border-amber-300 rounded-xl px-3 py-1.5 text-sm font-semibold text-slate-700 outline-none focus:border-amber-500"
          />
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-24 shrink-0 bg-white/80 border-2 border-amber-300 rounded-xl px-1.5 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-amber-500"
          />
          <button
            onClick={submit}
            disabled={!text.trim()}
            className={
              "px-3 py-1.5 rounded-xl text-sm font-extrabold " +
              (text.trim()
                ? "bg-amber-500 text-white active:scale-95 transition-transform"
                : "bg-amber-200 text-amber-400")
            }
          >
            추가
          </button>
        </div>
        {time && (
          <p className="text-[11px] text-amber-700 font-semibold mt-1.5">
            🔔 {fmt(time)}에 알려줄게요 (앱을 열어둔 동안에만 알림이 떠요)
          </p>
        )}
      </div>
    </section>
  );
}

// ---------- 하루 댓글 ----------
function CommentBox({ day, comments, onAdd, onRemove }) {
  const [text, setText] = useState("");

  const submit = () => {
    if (text.trim()) {
      onAdd(text.trim());
      setText("");
    }
  };

  return (
    <section className="mt-4 mb-2">
      <div className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3">
        <h2 className="font-extrabold text-slate-700 text-sm mb-2">
          💬 {DAYS[day]}요일 댓글
        </h2>

        {comments.length === 0 ? (
          <p className="text-sm text-slate-400 font-semibold py-1">
            오늘 하루는 어땠어? 한 줄 남겨봐!
          </p>
        ) : (
          <ul className="flex flex-col gap-2 mb-2">
            {comments.map((c) => (
              <li
                key={c.id}
                className="flex items-start gap-2 bg-slate-50 rounded-xl px-3 py-2"
              >
                <span className="text-xs font-bold text-slate-400 shrink-0 mt-0.5">
                  {c.at}
                </span>
                <span className="flex-1 text-sm font-semibold text-slate-700 break-words">
                  {c.text}
                </span>
                <button
                  onClick={() => onRemove(c.id)}
                  className="text-slate-300 text-sm px-1"
                  aria-label="삭제"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="오늘 하루 한 줄 남기기"
            className="flex-1 min-w-0 bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-1.5 text-sm font-semibold text-slate-700 outline-none focus:border-slate-400"
          />
          <button
            onClick={submit}
            disabled={!text.trim()}
            className={
              "px-3 py-1.5 rounded-xl text-sm font-extrabold " +
              (text.trim()
                ? "bg-slate-800 text-white active:scale-95 transition-transform"
                : "bg-slate-200 text-slate-400")
            }
          >
            등록
          </button>
        </div>
      </div>
    </section>
  );
}

// ---------- 하루 보기 (시간축 타임라인) ----------
function DayTimeline({ items, isToday, onPick, selectedIds = [], onLongPressSlot }) {
  const HOUR_PX = 60;
  const lp = useLongPress(({ y }) => {
    // 누른 위치를 30분 단위 시각으로 변환
    const min = startHour * 60 + Math.floor((y / HOUR_PX) * 60);
    const snapped = Math.max(0, Math.floor(min / 30) * 30);
    onLongPressSlot && onLongPressSlot(snapped);
  });

  let startHour = 8;
  let endHour = 19;
  items.forEach((it) => {
    startHour = Math.min(startHour, Math.floor(toMinutes(it.start) / 60));
    endHour = Math.max(endHour, Math.ceil(toMinutes(it.end) / 60));
  });
  const hours = [];
  for (let h = startHour; h <= endHour; h++) hours.push(h);
  const gridHeight = (endHour - startHour) * HOUR_PX;

  // 현재 시각 표시선
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const showNowLine =
    isToday && nowMin >= startHour * 60 && nowMin <= endHour * 60;
  const nowTop = ((nowMin - startHour * 60) / 60) * HOUR_PX;

  return (
    <div className="flex mt-2">
      {/* 시간 눈금 */}
      <div className="w-12 shrink-0 relative" style={{ height: gridHeight }}>
        {hours.map((h, idx) => (
          <div
            key={h}
            className="absolute right-2 text-[11px] font-bold text-slate-400"
            style={{ top: idx * HOUR_PX - 7 }}
          >
            {h}시
          </div>
        ))}
      </div>

      {/* 타임라인 본체 */}
      <div
        className="flex-1 relative bg-white rounded-2xl border border-slate-200 overflow-hidden"
        {...lp.holdProps}
        style={{ ...lp.holdProps.style, height: gridHeight }}
        onPointerDown={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          lp.onPointerDown(e, { y: e.clientY - rect.top });
        }}
      >
        {/* 시간 구분선 */}
        {hours.map((h, idx) =>
          idx === 0 ? null : (
            <div
              key={h}
              className="absolute left-0 right-0 border-t border-slate-100"
              style={{ top: idx * HOUR_PX }}
            />
          )
        )}

        {/* 일정 블록 */}
        {items.map((item) => {
          const c = styleOf(item);
          const isSel = selectedIds.includes(item.id);
          const top = ((toMinutes(item.start) - startHour * 60) / 60) * HOUR_PX;
          const height = Math.max(
            ((toMinutes(item.end) - toMinutes(item.start)) / 60) * HOUR_PX - 3,
            30
          );
          return (
            <button
              key={item.id}
              onClick={() => onPick(item)}
              className={
                `absolute left-1.5 right-1.5 rounded-xl border-2 ${c.border} ${c.bg} overflow-hidden text-left px-3 py-1.5 active:scale-95 transition-transform` +
                (isSel ? " ring-4 ring-red-400" : "")
              }
              style={{ top: top + 1.5, height }}
            >
              {isSel && (
                <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-black flex items-center justify-center">
                  ✓
                </span>
              )}
              <div className="flex items-center gap-2">
                <span className="text-lg">{iconOf(item)}</span>
                <div className="min-w-0">
                  <div className="font-bold text-slate-800 text-sm leading-tight truncate">
                    {item.title}
                  </div>
                  <div className={`text-[11px] font-semibold ${c.text}`}>
                    {fmt(item.start)} ~ {fmt(item.end)}
                  </div>
                </div>
              </div>
              {item.memo && height > 70 && (
                <div className="text-[11px] text-slate-500 mt-1 truncate">
                  📌 {item.memo}
                </div>
              )}
            </button>
          );
        })}

        {/* 지금 시각 표시선 */}
        {showNowLine && (
          <div
            className="absolute left-0 right-0 z-10 pointer-events-none"
            style={{ top: nowTop }}
          >
            <div className="border-t-2 border-red-400" />
            <span className="absolute -top-2 right-1 text-[9px] font-extrabold text-red-400 bg-white px-1 rounded">
              지금
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- 일주일 보기 (격자형) ----------
function WeekView({ items, onPickDay, onPickItem, selectedIds = [], onLongPressSlot, todos = [], onToggleTodo, onMoveItem }) {
  const HOUR_PX = 48;
  const lp = useLongPress(({ day, y }) => {
    const min = startHour * 60 + Math.floor((y / HOUR_PX) * 60);
    const snapped = Math.max(0, Math.floor(min / 30) * 30);
    onLongPressSlot && onLongPressSlot(day, snapped);
  });

  // 일정에 맞춰 시간 범위 자동 계산 (기본 8시~19시)
  const toMin = (t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const minToT = (m) =>
    String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
  let startHour = 8;
  let endHour = 19;
  items.forEach((it) => {
    startHour = Math.min(startHour, Math.floor(toMin(it.start) / 60));
    endHour = Math.max(endHour, Math.ceil(toMin(it.end) / 60));
  });
  const hours = [];
  for (let h = startHour; h < endHour; h++) hours.push(h);
  const gridHeight = (endHour - startHour) * HOUR_PX;
  const N = SHOWN_DAYS.length;

  // ----- 블록 길게 눌러 드래그 이동 -----
  const colsRef = useRef(null);
  const [drag, setDrag] = useState(null); // {id, day, startMin, durMin}
  const dragRef = useRef(null);
  const pressTimer = useRef(null);
  const downPos = useRef(null);
  const grabOffset = useRef(0);
  const didDrag = useRef(false);

  const preventScroll = (e) => e.preventDefault();

  const endDrag = (commit) => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
    document.removeEventListener("touchmove", preventScroll);
    const d = dragRef.current;
    if (commit && d && onMoveItem) {
      onMoveItem(d.id, d.day, minToT(d.startMin), minToT(d.startMin + d.durMin));
    }
    dragRef.current = null;
    setDrag(null);
    downPos.current = null;
  };

  const pointerToSlot = (e) => {
    const rect = colsRef.current.getBoundingClientRect();
    const day = Math.min(N - 1, Math.max(0, Math.floor(((e.clientX - rect.left) / rect.width) * N)));
    const min = startHour * 60 + ((e.clientY - rect.top) / HOUR_PX) * 60;
    return { day, min };
  };

  const blockDown = (e, item) => {
    downPos.current = { x: e.clientX, y: e.clientY };
    didDrag.current = false;
    const target = e.currentTarget;
    const pid = e.pointerId;
    const slot = pointerToSlot(e);
    pressTimer.current = setTimeout(() => {
      // 0.5초 누르면 드래그 시작
      const durMin = toMin(item.end) - toMin(item.start);
      grabOffset.current = slot.min - toMin(item.start);
      dragRef.current = { id: item.id, day: item.day, startMin: toMin(item.start), durMin };
      setDrag({ ...dragRef.current });
      didDrag.current = true;
      try { target.setPointerCapture(pid); } catch {}
      document.addEventListener("touchmove", preventScroll, { passive: false });
      if (navigator.vibrate) navigator.vibrate(30);
    }, 500);
  };

  const blockMove = (e) => {
    if (dragRef.current) {
      const { day, min } = pointerToSlot(e);
      const dur = dragRef.current.durMin;
      let ns = Math.round((min - grabOffset.current) / 5) * 5; // 5분 단위
      ns = Math.max(startHour * 60, Math.min(ns, endHour * 60 - dur));
      dragRef.current = { ...dragRef.current, day, startMin: ns };
      setDrag({ ...dragRef.current });
    } else if (downPos.current) {
      // 드래그 시작 전 손가락이 움직이면 (스크롤) 길게누르기 취소
      const dx = Math.abs(e.clientX - downPos.current.x);
      const dy = Math.abs(e.clientY - downPos.current.y);
      if (dx > 10 || dy > 10) {
        if (pressTimer.current) clearTimeout(pressTimer.current);
        pressTimer.current = null;
      }
    }
  };

  const blockUp = () => endDrag(true);
  const blockCancel = () => endDrag(false);

  return (
    <main className="flex-1 px-2 pb-28 overflow-x-auto">
      <div className="min-w-[360px]">
        {/* 요일 헤더 */}
        <div className="flex sticky top-0 bg-slate-50 z-10 pb-1">
          <div className="w-8 shrink-0" />
          {SHOWN_DAYS.map((d, i) => {
            const today = i === todayIndex();
            return (
              <button
                key={d}
                onClick={() => onPickDay(i)}
                className={
                  "flex-1 py-1.5 mx-0.5 rounded-xl text-xs font-extrabold " +
                  (today ? "bg-slate-800 text-white" : "bg-white text-slate-500 border border-slate-200")
                }
              >
                {d}
              </button>
            );
          })}
        </div>

        {/* 격자 본체 */}
        <div className="flex">
          {/* 시간 눈금 */}
          <div className="w-8 shrink-0 relative" style={{ height: gridHeight }}>
            {hours.map((h, idx) => (
              <div
                key={h}
                className="absolute right-1 text-[10px] font-bold text-slate-400"
                style={{ top: idx * HOUR_PX - 6 }}
              >
                {h}
              </div>
            ))}
          </div>

          {/* 요일별 컬럼 (드래그 좌표 기준 컨테이너) */}
          <div ref={colsRef} className="flex flex-1 relative">
            {SHOWN_DAYS.map((d, i) => {
              const list = items.filter((it) => it.day === i);
              const today = i === todayIndex();
              return (
                <div
                  key={d}
                  className={
                    "flex-1 mx-0.5 relative rounded-xl " +
                    (today ? "bg-yellow-50" : "bg-white")
                  }
                  {...lp.holdProps}
                  style={{ ...lp.holdProps.style, height: gridHeight }}
                  onPointerDown={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    lp.onPointerDown(e, { day: i, y: e.clientY - rect.top });
                  }}
                >
                  {/* 시간 구분선 */}
                  {hours.map((h, idx) =>
                    idx === 0 ? null : (
                      <div
                        key={h}
                        className="absolute left-0 right-0 border-t border-slate-100"
                        style={{ top: idx * HOUR_PX }}
                      />
                    )
                  )}
                  {/* 일정 블록 */}
                  {list.map((item) => {
                    const c = styleOf(item);
                    const isSel = selectedIds.includes(item.id);
                    const dragging = drag && drag.id === item.id;
                    const top = ((toMin(item.start) - startHour * 60) / 60) * HOUR_PX;
                    const height = Math.max(
                      ((toMin(item.end) - toMin(item.start)) / 60) * HOUR_PX,
                      22
                    );
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          if (didDrag.current) { didDrag.current = false; return; }
                          onPickItem(item);
                        }}
                        onPointerDown={(e) => { e.stopPropagation(); blockDown(e, item); }}
                        onPointerMove={blockMove}
                        onPointerUp={blockUp}
                        onPointerCancel={blockCancel}
                        onContextMenu={(e) => e.preventDefault()}
                        className={
                          `absolute left-0.5 right-0.5 rounded-lg border ${c.border} ${c.bg} overflow-hidden text-left px-1 py-0.5 transition-transform` +
                          (isSel ? " ring-2 ring-red-400" : "") +
                          (dragging ? " opacity-30" : " active:scale-95")
                        }
                        style={{
                          top,
                          height,
                          touchAction: "pan-y",
                          userSelect: "none",
                          WebkitUserSelect: "none",
                          WebkitTouchCallout: "none",
                        }}
                      >
                        {isSel && (
                          <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] font-black flex items-center justify-center">
                            ✓
                          </span>
                        )}
                        <div className="text-[10px] leading-tight font-bold text-slate-800">
                          {iconOf(item)} {item.title}
                        </div>
                        {height > 40 && (
                          <div className={`text-[9px] leading-tight font-semibold ${c.text}`}>
                            {item.start.replace(/^0/, "")}~
                            <br />
                            {item.end.replace(/^0/, "")}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}

            {/* 드래그 중인 블록의 고스트 + 시간 말풍선 */}
            {drag && (() => {
              const item = items.find((i) => i.id === drag.id);
              if (!item) return null;
              const c = styleOf(item);
              const top = ((drag.startMin - startHour * 60) / 60) * HOUR_PX;
              const height = Math.max((drag.durMin / 60) * HOUR_PX, 22);
              const leftPct = (drag.day / N) * 100;
              const widthPct = 100 / N;
              return (
                <div
                  className="absolute z-30 pointer-events-none"
                  style={{
                    top,
                    left: `calc(${leftPct}% + 2px)`,
                    width: `calc(${widthPct}% - 4px)`,
                    height,
                  }}
                >
                  {/* 말풍선: 바뀌는 시작 시간 */}
                  <div className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    <div className="bg-slate-800 text-white text-xs font-extrabold px-2.5 py-1.5 rounded-xl shadow-lg">
                      {DAYS[drag.day]} {fmt(minToT(drag.startMin))}
                    </div>
                    <div className="w-2 h-2 bg-slate-800 rotate-45 mx-auto -mt-1" />
                  </div>
                  {/* 고스트 블록 */}
                  <div
                    className={`w-full h-full rounded-lg border-2 border-dashed ${c.border} ${c.bg} opacity-90 px-1 py-0.5 shadow-xl`}
                  >
                    <div className="text-[10px] leading-tight font-bold text-slate-800">
                      {iconOf(item)} {item.title}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* 할일 체크 그리드 (과목 × 요일) */}
        {(() => {
          const names = [];
          todos.forEach((t) => {
            if (!names.includes(t.text)) names.push(t.text);
          });
          if (names.length === 0) return null;
          return (
            <div className="mt-5 bg-amber-50 border-2 border-amber-200 rounded-2xl p-3">
              <h2 className="text-sm font-extrabold text-amber-800 mb-2 px-1">
                📝 할 일 <span className="text-[10px] font-bold text-amber-600">(동그라미를 눌러서 체크!)</span>
              </h2>
              {/* 요일 헤더 행 */}
              <div className="flex items-center mb-1">
                <div className="w-20 shrink-0" />
                {SHOWN_DAYS.map((d) => (
                  <div key={d} className="flex-1 text-center text-[10px] font-extrabold text-amber-700">
                    {d}
                  </div>
                ))}
              </div>
              {names.map((name) => (
                <div key={name} className="flex items-center border-t border-amber-200/70 py-1">
                  <div className="w-20 shrink-0 text-xs font-bold text-slate-700 truncate pr-1">
                    {name}
                  </div>
                  {SHOWN_DAYS.map((d, di) => {
                    const todo = todos.find((t) => t.text === name && t.day === di);
                    return (
                      <div key={d} className="flex-1 flex justify-center">
                        {todo ? (
                          <button
                            onClick={() => onToggleTodo && onToggleTodo(todo.id)}
                            className={
                              "w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-black active:scale-90 transition-transform " +
                              (todo.done
                                ? "bg-green-500 border-green-500 text-white"
                                : "bg-white border-slate-400 text-transparent")
                            }
                          >
                            ✓
                          </button>
                        ) : (
                          <span className="w-6 h-6" />
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </main>
  );
}

// ---------- 입력 시트 ----------
function EditSheet({ item, isNew, onSave, onDelete, onClose }) {
  const [form, setForm] = useState(item);
  const [selDays, setSelDays] = useState([item.day]); // 새 일정일 때 다중 선택
  const [addToChecklist, setAddToChecklist] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const toggleDay = (i) => {
    if (isNew) {
      setSelDays((ds) =>
        ds.includes(i) ? (ds.length > 1 ? ds.filter((d) => d !== i) : ds) : [...ds, i]
      );
    } else {
      set("day", i);
    }
  };

  const dayActive = (i) => (isNew ? selDays.includes(i) : form.day === i);

  // 저장이 안 되는 이유를 알려주기
  let blockReason = null;
  if (!form.title.trim()) blockReason = "일정 이름을 적어주세요";
  else if (!form.start || !form.end) blockReason = "시작과 끝 시간을 골라주세요";
  else if (form.start >= form.end) blockReason = "끝나는 시간이 시작보다 늦어야 해요";
  else if (isNew && selDays.length === 0) blockReason = "요일을 하나 이상 골라주세요";
  const valid = blockReason === null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white rounded-t-3xl p-5 pb-8 overflow-y-auto overscroll-contain"
        style={{
          maxHeight: "85dvh",
          touchAction: "pan-y",
          WebkitOverflowScrolling: "touch",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
        <h2 className="text-lg font-extrabold text-slate-800 mb-4">
          {isNew ? "일정 추가하기 ✨" : "일정 고치기 ✏️"}
        </h2>

        {/* 이름 */}
        <label className="block text-xs font-bold text-slate-500 mb-1">무슨 일정이야?</label>
        <input
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="예: 영어 학원"
          className="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 font-semibold text-slate-800 focus:border-slate-500 outline-none"
        />

        {/* 아이콘 */}
        <label className="block text-xs font-bold text-slate-500 mt-4 mb-1">아이콘</label>
        <div className="flex flex-wrap gap-1.5">
          {ICONS.map((ic) => (
            <button
              key={ic}
              onClick={() => set("icon", ic)}
              className={
                "w-9 h-9 rounded-xl text-lg flex items-center justify-center border-2 transition-all " +
                ((form.icon || iconOf(form)) === ic
                  ? "bg-slate-100 border-slate-700 scale-110"
                  : "bg-white border-slate-200")
              }
            >
              {ic}
            </button>
          ))}
        </div>

        {/* 색깔 */}
        <label className="block text-xs font-bold text-slate-500 mt-4 mb-1">색깔</label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(COLORS).map(([key, c]) => (
            <button
              key={key}
              onClick={() => set("color", key)}
              aria-label={key}
              className={
                `w-8 h-8 rounded-full ${c.chip} transition-all ` +
                ((form.color || "orange") === key
                  ? "ring-4 ring-slate-700 ring-offset-1 scale-110"
                  : "")
              }
            />
          ))}
        </div>

        {/* 요일 */}
        <label className="block text-xs font-bold text-slate-500 mt-4 mb-1">
          요일 {isNew && <span className="text-slate-400 font-semibold">(여러 개 선택 가능)</span>}
        </label>
        <div className="flex gap-1.5">
          {SHOWN_DAYS.map((d, i) => (
            <button
              key={d}
              onClick={() => toggleDay(i)}
              className={
                "flex-1 py-2 rounded-xl text-sm font-bold border-2 " +
                (dayActive(i) ? "bg-slate-800 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-400")
              }
            >
              {d}
            </button>
          ))}
        </div>
        {isNew && selDays.length > 1 && (
          <p className="text-xs text-slate-400 font-semibold mt-1">
            {selDays
              .slice()
              .sort((a, b) => a - b)
              .map((i) => DAYS[i])
              .join(", ")}
            요일에 똑같이 추가돼요
          </p>
        )}

        {/* 시간 */}
        <div className="flex gap-3 mt-4">
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-500 mb-1">시작</label>
            <input
              type="time"
              value={form.start}
              onChange={(e) => set("start", e.target.value)}
              className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 font-semibold focus:border-slate-500 outline-none"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-500 mb-1">끝</label>
            <input
              type="time"
              value={form.end}
              onChange={(e) => set("end", e.target.value)}
              className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 font-semibold focus:border-slate-500 outline-none"
            />
          </div>
        </div>
        {form.start >= form.end && (
          <p className="text-xs text-red-500 font-semibold mt-1">끝나는 시간이 시작보다 늦어야 해요</p>
        )}

        {/* 메모 */}
        <label className="block text-xs font-bold text-slate-500 mt-4 mb-1">메모 (선택)</label>
        <input
          value={form.memo}
          onChange={(e) => set("memo", e.target.value)}
          placeholder="예: 준비물 챙기기"
          className="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-slate-700 focus:border-slate-500 outline-none"
        />

        {/* 체크리스트 자동 추가 (새 일정만) */}
        {isNew && (
          <button
            onClick={() => setAddToChecklist((v) => !v)}
            className={
              "w-full mt-4 flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-left transition-all " +
              (addToChecklist
                ? "bg-amber-50 border-amber-400"
                : "bg-white border-slate-200")
            }
          >
            <span
              className={
                "w-5 h-5 shrink-0 rounded-md border-2 flex items-center justify-center text-xs font-black " +
                (addToChecklist
                  ? "bg-amber-500 border-amber-500 text-white"
                  : "bg-white border-slate-300 text-transparent")
              }
            >
              ✓
            </span>
            <span className="flex-1">
              <span className={"block text-sm font-bold " + (addToChecklist ? "text-amber-800" : "text-slate-600")}>
                📝 할 일 메모지에도 추가하기
              </span>
              <span className="block text-[11px] text-slate-400 font-semibold">
                선택한 요일의 체크리스트에 자동으로 들어가요
              </span>
            </span>
          </button>
        )}

        {/* 버튼 */}
        <div className="flex gap-2 mt-6">
          {!isNew && (
            <button
              onClick={() => onDelete(form.id)}
              className="px-4 py-3 rounded-xl bg-red-50 text-red-500 font-bold border-2 border-red-200"
            >
              삭제
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-3 rounded-xl bg-white text-slate-500 font-bold border-2 border-slate-200"
          >
            취소
          </button>
          <button
            onClick={() => valid && onSave(form, { days: selDays, addToChecklist })}
            disabled={!valid}
            className={
              "flex-1 py-3 rounded-xl font-extrabold text-white " +
              (valid ? "bg-slate-800 active:scale-95 transition-transform" : "bg-slate-300")
            }
          >
            {isNew ? "추가하기" : "저장하기"}
          </button>
        </div>
        {!valid && (
          <p className="text-center text-xs font-bold text-orange-500 mt-2">
            ⚠️ {blockReason}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------- 앱 시작 ----------
import { createRoot } from "react-dom/client";
createRoot(document.getElementById("root")).render(<KidsTimetable />);

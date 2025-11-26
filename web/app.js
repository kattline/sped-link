/* app.js - SPED-Link modern client
   Features:
   - IndexedDB local queue (simple)
   - Firebase Realtime Database sync (auto when online)
   - Realtime updates for parent UI
   - beforeinstallprompt handler for install banner
*/

const firebaseConfig = {
  apiKey: "AIzaSyCJ2BQVolPgeFsu6rw85VXbihA3avwDokU",
  authDomain: "sped-link.firebaseapp.com",
  projectId: "sped-link",
  storageBucket: "sped-link.firebasestorage.app",
  messagingSenderId: "421020848346",
  appId: "1:421020848346:web:7f5fb15dcad42b2ec615e3",
  measurementId: "G-EBS9KXRM4Z"
};

// Load firebase scripts must be included in index.html. If not, host via modules or CDN.
// Init firebase
if (typeof firebase === 'undefined') {
  console.warn('Firebase SDK not found. Make sure you included firebase-app and firebase-database scripts in index.html');
}
firebase.initializeApp(firebaseConfig);
const rtdb = firebase.database();

/* ---------- IndexedDB helper ---------- */
const DB_NAME = 'spedlink-db';
const STORE_LOGS = 'logs';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_LOGS)) {
        db.createObjectStore(STORE_LOGS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveLocalLog(log) {
  const db = window._db;
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE_LOGS, 'readwrite');
    const store = tx.objectStore(STORE_LOGS);
    const req = store.put(log);
    req.onsuccess = () => res(true);
    req.onerror = () => rej(req.error);
  });
}

async function getAllLocalLogs() {
  const db = window._db;
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE_LOGS, 'readonly');
    const store = tx.objectStore(STORE_LOGS);
    const arr = [];
    const cursor = store.openCursor();
    cursor.onsuccess = e => {
      const cur = e.target.result;
      if (cur) {
        arr.push(cur.value);
        cur.continue();
      } else res(arr);
    };
    cursor.onerror = () => rej(cursor.error);
  });
}

async function clearLocalLogs() {
  const db = window._db;
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE_LOGS, 'readwrite');
    const store = tx.objectStore(STORE_LOGS);
    const r = store.clear();
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  });
}

/* ---------- UI helpers ---------- */
function el(q) { return document.querySelector(q); }
function showToast(msg, timeout = 2200) {
  // temporary toast using history-section header area
  const tmp = document.createElement('div');
  tmp.className = 'log-item';
  tmp.style.position = 'fixed';
  tmp.style.left = '20px';
  tmp.style.bottom = '20px';
  tmp.style.zIndex = 9999;
  tmp.innerHTML = `<div class="left"><div class="bubble">${msg}</div></div>`;
  document.body.appendChild(tmp);
  setTimeout(()=> tmp.remove(), timeout);
}

/* ---------- Data model and UI binding ---------- */
let currentStudent = {
  id: 'student-001',
  name: 'Juan Dela Cruz'
};

function renderStudentCard() {
  el('#studentName').textContent = currentStudent.name || 'Select Student';
  el('#studentIdTxt').textContent = `ID: ${currentStudent.id || '—'}`;
  // avatar fallback handled by <img> src in index.html (ensure icons/student.png exists)
}

function renderHistory(logs) {
  const container = el('#historyList');
  if (!logs || logs.length === 0) {
    container.innerHTML = '<div class="muted">No logs yet.</div>';
    return;
  }
  logs.sort((a,b)=> new Date(b.ts) - new Date(a.ts));
  container.innerHTML = logs.map(l => {
    const time = new Date(l.ts).toLocaleString();
    const color = l.type === 'positive' ? 'background:linear-gradient(90deg,#ECFCCB,#BBF7D0);color:#065F46' :
                  l.type === 'neutral' ? 'background:linear-gradient(90deg,#FEF3C7,#FDE68A);color:#92400E' :
                  'background:linear-gradient(90deg,#FECACA,#FCA5A5);color:#7F1D1D';
    const remark = l.remark ? `<div style="font-size:13px;color:#374151;margin-top:6px">${escapeHtml(l.remark)}</div>` : '';
    return `<div class="log-item">
      <div class="left">
        <div class="bubble" style="${color}">${l.type.toUpperCase()}</div>
        <div>
          <div style="font-weight:600">${l.by || 'Teacher'}</div>
          <div class="time">${time}</div>
          ${remark}
        </div>
      </div>
      <div style="min-width:70px;text-align:right;color:var(--muted);font-size:12px">${l.id.split('-').pop()}</div>
    </div>`;
  }).join('');
}

function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}

/* ---------- Logging actions ---------- */
function submitLog(type) {
  // quick log without remark
  const remark = el('#remarks').value.trim();
  const log = {
    id: `${currentStudent.id}-${Date.now()}`,
    studentId: currentStudent.id,
    type,
    remark: remark || '',
    by: 'Teacher',
    ts: new Date().toISOString()
  };
  queueAndMaybeSync(log);
  // clear remarks after save
  el('#remarks').value = '';
  showToast('Entry saved');
}

async function saveLog() {
  submitLog('neutral'); // default to neutral if clicking Save
}

/* ---------- Sync logic with Firebase ---------- */
async function queueAndMaybeSync(log) {
  await saveLocalLog(log);
  // try immediate push
  try {
    await pushLogToFirebase(log);
    // optional: remove from local queue (we will clear all after sync attempts)
    console.log('pushed immediate', log.id);
    // fetch fresh logs for UI
    // no-op; RTDB listener updates automatically
  } catch (e) {
    console.warn('push failed, kept locally', e);
  }
}

function pushLogToFirebase(log) {
  return new Promise((res, rej) => {
    const ref = rtdb.ref(`logs/${log.studentId}`).push();
    ref.set(log, err => {
      if (err) rej(err); else res(true);
    });
  });
}

async function syncQueuedToFirebase() {
  if (!navigator.onLine) return;
  try {
    const queued = await getAllLocalLogs();
    if (!queued.length) return;
    for (const q of queued) {
      try {
        await pushLogToFirebase(q);
      } catch (e) {
        console.warn('failed sync for', q.id, e);
      }
    }
    await clearLocalLogs();
    console.log('Queued logs cleared after sync');
  } catch (e) {
    console.error('syncQueuedToFirebase error', e);
  }
}

/* ---------- Real-time listener for UI (parent view) ---------- */
let parentListener = null;
function attachParentListener(studentId) {
  // detach old
  if (parentListener) parentListener.off();
  parentListener = rtdb.ref(`logs/${studentId}`);
  parentListener.on('value', snapshot => {
    const data = snapshot.val();
    const arr = data ? Object.values(data) : [];
    renderHistory(arr);
  });
}

/* ---------- PWA install prompt handling ---------- */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const banner = document.getElementById('installBanner');
  if (banner) banner.classList.remove('hidden');
});

function installPWA() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(choice => {
    if (choice.outcome === 'accepted') {
      console.log('User accepted install');
      const banner = document.getElementById('installBanner');
      if (banner) banner.classList.add('hidden');
    } else {
      console.log('User dismissed install');
    }
    deferredPrompt = null;
  });
}

/* ---------- Startup ---------- */
window.addEventListener('load', async () => {
  // open DB
  window._db = await openDb();
  renderStudentCard();

  // register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(() => console.log('sw registered')).catch(console.error);
  }

  // attach parent listener for current student
  attachParentListener(currentStudent.id);

  // attempt to sync queued logs when online
  window.addEventListener('online', () => {
    syncQueuedToFirebase();
  });

  // initial sync attempt
  if (navigator.onLine) syncQueuedToFirebase();

  // sample: if you want to allow changing selected student dynamically,
  // hook UI events here (not included in minimal template)
});

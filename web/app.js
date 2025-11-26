// SPED-Link app.js (IndexedDB + Firebase RTDB sync)
const DB_NAME = 'spedlink-db';
const STORE_LOGS = 'logs';
let db;
let deferredPrompt;

// --- Firebase init (REPLACE with your config) ---
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
firebase.initializeApp(firebaseConfig);
const rtdb = firebase.database();

// --- IndexedDB helper ---
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const idb = e.target.result;
      if (!idb.objectStoreNames.contains(STORE_LOGS)) {
        idb.createObjectStore(STORE_LOGS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveLogLocal(log) {
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE_LOGS, 'readwrite');
    const store = tx.objectStore(STORE_LOGS);
    const r = store.put(log);
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  });
}

async function getAllLocalLogsByStudent(studentId) {
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE_LOGS, 'readonly');
    const store = tx.objectStore(STORE_LOGS);
    const items = [];
    const q = store.openCursor();
    q.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        if (cursor.value.studentId === studentId) items.push(cursor.value);
        cursor.continue();
      } else res(items);
    };
    q.onerror = () => rej(q.error);
  });
}

async function getAllLocalLogs() {
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE_LOGS, 'readonly');
    const store = tx.objectStore(STORE_LOGS);
    const items = [];
    const q = store.openCursor();
    q.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        items.push(cursor.value);
        cursor.continue();
      } else res(items);
    };
    q.onerror = () => rej(q.error);
  });
}

async function clearQueuedLogs() {
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE_LOGS, 'readwrite');
    const store = tx.objectStore(STORE_LOGS);
    const r = store.clear();
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  });
}

// --- Queue + Sync logic ---
async function queueAndSync(log) {
  await saveLogLocal(log);
  try {
    await pushLogToFirebase(log);
    console.log('Uploaded to Firebase immediately');
  } catch (err) {
    console.log('Firebase upload failed — queued locally', err);
  }
}

async function pushLogToFirebase(log) {
  // Use student-specific node
  const ref = rtdb.ref(`logs/${log.studentId}`).push();
  await ref.set(log);
}

// Try syncing all local logs (called when online)
async function syncQueuedLogs() {
  if (!navigator.onLine) return;
  const logs = await getAllLocalLogs();
  if (!logs.length) return;
  for (const log of logs) {
    try {
      await pushLogToFirebase(log);
      console.log('Synced to Firebase:', log.id);
    } catch (e) {
      console.log('Failed to sync', log.id, e);
    }
  }
  // After attempting sync, clear local queue to avoid duplicates
  await clearQueuedLogs();
}

// --- UI + event bindings ---
window.addEventListener('load', async () => {
  db = await openDb();

  // register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(() => console.log('SW registered'));
  }

  // handle install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('installBanner').classList.remove('hidden');
  });

  document.getElementById('installBtn').addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        document.getElementById('installBanner').classList.add('hidden');
      }
      deferredPrompt = null;
    }
  });
  document.getElementById('dismissInstall').addEventListener('click', () => {
    document.getElementById('installBanner').classList.add('hidden');
  });

  // teacher buttons
  document.querySelectorAll('#teacher .icon').forEach(b => b.addEventListener('click', async (ev) => {
    const evtype = b.dataset.event || ev.target.dataset.event;
    const studentId = document.getElementById('teacherStudentId').value || 'unknown';
    const log = {
      id: `${studentId}-${Date.now()}`,
      studentId,
      type: evtype,
      ts: new Date().toISOString()
    };
    await queueAndSync(log);
    showToast('Logged: ' + evtype);
  }));

  // parent refresh uses Firebase real-time listener fallback
  document.getElementById('refreshSummary').addEventListener('click', async () => {
    const studentId = document.getElementById('parentStudentId').value || 'unknown';
    const summaryEl = document.getElementById('summary');

    // Try reading from Firebase first
    try {
      const snap = await rtdb.ref(`logs/${studentId}`).once('value');
      const data = snap.val();
      if (data) {
        const arr = Object.values(data).sort((a,b)=> new Date(a.ts)-new Date(b.ts));
        summaryEl.innerHTML = formatSummary(arr);
        return;
      }
    } catch (e) {
      // fallback to local
    }

    const local = await getAllLocalLogsByStudent(studentId);
    summaryEl.innerHTML = formatSummary(local || []);
  });

  // Real-time subscription for parent (auto updates)
  document.getElementById('parentStudentId').addEventListener('change', (e) => {
    const sid = e.target.value;
    attachRealtimeParentListener(sid);
  });
  // attach default
  attachRealtimeParentListener(document.getElementById('parentStudentId').value);

  window.addEventListener('online', () => {
    syncQueuedLogs();
  });
});

// Attach RTDB listener for parent view
let currentParentListener = null;
function attachRealtimeParentListener(studentId) {
  if (currentParentListener) currentParentListener.off();
  const ref = rtdb.ref(`logs/${studentId}`);
  currentParentListener = ref;
  ref.on('value', snapshot => {
    const data = snapshot.val();
    const summaryEl = document.getElementById('summary');
    if (!data) {
      summaryEl.innerHTML = '<p>No events yet.</p>';
      return;
    }
    const arr = Object.values(data).sort((a,b)=> new Date(a.ts)-new Date(b.ts));
    summaryEl.innerHTML = formatSummary(arr);
  });
}

function formatSummary(logs) {
  if (!logs || logs.length === 0) return '<p>No events yet.</p>';
  const counts = logs.reduce((acc, l) => { acc[l.type] = (acc[l.type]||0)+1; return acc; }, {});
  const lines = Object.entries(counts).map(([k,v]) => `<li>${k}: ${v}</li>`).join('');
  const last = logs[logs.length-1];
  return `<p>Latest: ${last.type} at ${new Date(last.ts).toLocaleTimeString()}</p><ul>${lines}</ul>`;
}

function showToast(msg) {
  const t = document.getElementById('teacherToast');
  t.textContent = msg;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 2000);
}

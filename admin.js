// ===== ADMIN LOGIC (Firebase Firestore) =====
import { db, doc, getDoc, setDoc, deleteDoc, collection, getDocs, onSnapshot }
  from './firebase.js';

const CREATOR_NAMES = {
  mrbeast:    { name: 'Ace Macho',          category: 'entertainment' },
  markiplier: { name: 'Markiplier',         category: 'entertainment' },
  emma:       { name: 'Emma Chamberlain',   category: 'entertainment' },
  ent4:       { name: 'Creator 4',           category: 'entertainment' },
  charli:     { name: "Charli D'Amelio",    category: 'influencer'    },
  khaby:      { name: 'Khaby Lame',         category: 'influencer'    },
  addison:    { name: 'Addison Rae',        category: 'influencer'    },
  inf4:       { name: 'Creator 4',           category: 'influencer'    },
  ninja:      { name: 'Ninja',              category: 'gaming'        },
  pokimane:   { name: 'Pokimane',           category: 'gaming'        },
  shroud:     { name: 'Shroud',             category: 'gaming'        },
  gam4:       { name: 'Creator 4',           category: 'gaming'        },
};

function formatCountdown(ms) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const days  = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins  = Math.floor((totalSec % 3600) / 60);
  const secs  = totalSec % 60;
  const parts = [];
  if (days)  parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  parts.push(`${String(mins).padStart(2,'0')}m`);
  parts.push(`${String(secs).padStart(2,'0')}s`);
  return parts.join(' ');
}

let timerInterval = null;
let cachedUsers   = [];
let cachedVotes   = [];

// ===== FIRESTORE HELPERS =====
async function saveRevealState(s) {
  await setDoc(doc(db, 'settings', 'reveal'), s);
}
async function getRevealState() {
  const snap = await getDoc(doc(db, 'settings', 'reveal'));
  return snap.exists() ? snap.data() : { revealed: false, revealAt: null, locked: false };
}

// ===== LOGOUT =====
function adminLogout() {
  sessionStorage.removeItem('admin_auth');
  clearInterval(timerInterval);
  window.location.href = 'index.html';
}

// ===== TABS =====
function switchTab(name, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  btn.classList.add('active');
}

// ===== REVEAL CONTROLS =====
async function revealNow() {
  await saveRevealState({ revealed: true, revealAt: null, locked: false });
  clearInterval(timerInterval);
  updateRevealUI();
}

async function hideResults() {
  await saveRevealState({ revealed: false, revealAt: null, locked: false });
  clearInterval(timerInterval);
  updateRevealUI();
}

async function startRevealTimer() {
  const days  = parseInt(document.getElementById('timerDays').value,    10) || 0;
  const hours = parseInt(document.getElementById('timerHours').value,   10) || 0;
  const mins  = parseInt(document.getElementById('timerMinutes').value, 10) || 0;
  const secs  = parseInt(document.getElementById('timerSeconds').value, 10) || 0;
  const totalMs = (days * 86400 + hours * 3600 + mins * 60 + secs) * 1000;
  if (totalMs < 30000) return alert('Please set at least 30 seconds.');
  const revealAt = new Date(Date.now() + totalMs).toISOString();
  await saveRevealState({ revealed: false, revealAt, locked: false });
  clearInterval(timerInterval);
  startTimerTick();
  updateRevealUI();
}

async function cancelTimer() {
  const s = await getRevealState();
  s.revealAt = null; s.locked = false;
  await saveRevealState(s);
  clearInterval(timerInterval);
  updateRevealUI();
}

function startTimerTick() {
  clearInterval(timerInterval);
  timerInterval = setInterval(timerTick, 1000);
  timerTick();
}

async function timerTick() {
  const s = await getRevealState();
  if (!s.revealAt) { updateRevealUI(); return; }
  const remaining = new Date(s.revealAt).getTime() - Date.now();
  if (remaining <= 0) {
    await saveRevealState({ revealed: true, revealAt: null, locked: false });
    clearInterval(timerInterval);
    updateRevealUI();
    return;
  }
  if (remaining <= 30000 && !s.locked) {
    s.locked = true;
    await saveRevealState(s);
  }
  updateRevealUI();
  updateCountdown(remaining);
}

function updateCountdown(ms) {
  const el = document.getElementById('timerCountdown');
  if (!el) return;
  el.textContent = formatCountdown(ms);
  el.className   = 'timer-countdown' + (ms <= 30000 ? ' warning' : '');
  const statusEl = document.getElementById('timerStatusText');
  if (statusEl) statusEl.textContent = ms <= 30000 ? '🔒 Voting locked' : 'Voting open';
}

async function updateRevealUI() {
  const s         = await getRevealState();
  const badge     = document.getElementById('revealStatusBadge');
  const timerD    = document.getElementById('timerDisplay');
  const cancelBtn = document.getElementById('btnCancelTimer');
  if (!badge) return;
  if (s.revealed)      { badge.textContent = '● Results Revealed'; badge.className = 'reveal-status-badge revealed'; }
  else if (s.locked)   { badge.textContent = '🔒 Voting Locked';   badge.className = 'reveal-status-badge locked'; }
  else                 { badge.textContent = '● Results Hidden';   badge.className = 'reveal-status-badge hidden'; }
  if (s.revealAt && !s.revealed) {
    timerD.classList.add('active');
    cancelBtn.style.display = 'inline-flex';
    const remaining = new Date(s.revealAt).getTime() - Date.now();
    if (remaining > 0) updateCountdown(remaining);
  } else {
    timerD.classList.remove('active');
    cancelBtn.style.display = 'none';
  }
}

// ===== RENDER DASHBOARD =====
async function renderDashboard() {
  const [usersSnap, votesSnap] = await Promise.all([
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'votes'))
  ]);
  cachedUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  cachedVotes = votesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  document.getElementById('statTotalUsers').textContent = cachedUsers.length;
  document.getElementById('statTotalVotes').textContent = cachedVotes.length;
  renderVoteResults(cachedVotes);
  renderUsersTable(cachedUsers, cachedVotes);
  updateRevealUI();
}

// ===== VOTE RESULTS =====
function renderVoteResults(votes) {
  ['entertainment', 'influencer', 'gaming'].forEach(cat => {
    const creators = Object.entries(CREATOR_NAMES).filter(([, v]) => v.category === cat);
    const catVotes = votes.filter(v => v.category === cat);
    const total    = catVotes.length;
    const ranked   = creators.map(([id, info]) => ({
      id, name: info.name,
      count: catVotes.filter(v => v.creatorId === id).length
    })).sort((a, b) => b.count - a.count);
    const container = document.getElementById('results-' + cat);
    if (!container) return;
    if (total === 0) { container.innerHTML = '<div class="empty-state">No votes yet in this category.</div>'; return; }
    container.innerHTML = ranked.map((r, i) => `
      <div class="result-row">
        <div class="result-rank">${i + 1}</div>
        <div class="result-name">${r.name}</div>
        <div class="result-cat ${cat}">${cat === 'entertainment' ? 'Media & Ent.' : cat === 'influencer' ? 'Social Impact' : 'Gaming'}</div>
        <div class="result-bar-wrap"><div class="result-bar" style="width:${total > 0 ? (r.count/total*100) : 0}%"></div></div>
        <div class="result-votes">${r.count} vote${r.count !== 1 ? 's' : ''}</div>
      </div>`).join('');
  });
}

// ===== USERS TABLE =====
function renderUsersTable(users, votes) {
  const tbody = document.getElementById('usersTableBody');
  document.getElementById('userCountLabel').textContent = `${users.length} registered user${users.length !== 1 ? 's' : ''}`;
  if (users.length === 0) { tbody.innerHTML = `<tr><td colspan="8" class="empty-state">No users registered yet.</td></tr>`; return; }
  tbody.innerHTML = users.map((u, i) => {
    const userVotes = votes.filter(v => v.userId === u.id);
    const votedFor  = cat => {
      const v = userVotes.find(v => v.category === cat);
      return v ? `<span class="voted-pill yes">${CREATOR_NAMES[v.creatorId]?.name || v.creatorId}</span>`
               : `<span class="voted-pill no">—</span>`;
    };
    return `<tr>
      <td>${i + 1}</td>
      <td>${escHtml(u.name)}</td>
      <td class="td-email">${escHtml(u.email)}</td>
      <td class="td-id">${u.id}</td>
      <td>${votedFor('entertainment')}</td>
      <td>${votedFor('influencer')}</td>
      <td>${votedFor('gaming')}</td>
      <td><button class="btn-delete" onclick="promptDelete('${u.id}','${escHtml(u.name)}')">Delete</button></td>
    </tr>`;
  }).join('');
}

// ===== RESET VOTES =====
function promptResetVotes() { document.getElementById('resetConfirmOverlay').classList.add('open'); }
function closeResetConfirm() { document.getElementById('resetConfirmOverlay').classList.remove('open'); }
async function confirmResetVotes() {
  const snap = await getDocs(collection(db, 'votes'));
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
  await saveRevealState({ revealed: false, revealAt: null, locked: false });
  clearInterval(timerInterval);
  closeResetConfirm();
  renderDashboard();
  updateRevealUI();
}

// ===== DELETE USER =====
let pendingDeleteId = null;
function promptDelete(userId, userName) {
  pendingDeleteId = userId;
  document.getElementById('confirmMsg').textContent = `This will permanently remove "${userName}" and all their votes.`;
  document.getElementById('confirmOverlay').classList.add('open');
}
function closeConfirm() { pendingDeleteId = null; document.getElementById('confirmOverlay').classList.remove('open'); }
async function confirmDelete() {
  if (!pendingDeleteId) return;
  await deleteDoc(doc(db, 'users', pendingDeleteId));
  const votesSnap = await getDocs(collection(db, 'votes'));
  await Promise.all(votesSnap.docs.filter(d => d.data().userId === pendingDeleteId).map(d => deleteDoc(d.ref)));
  closeConfirm();
  renderDashboard();
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ===== INIT =====
window.onload = async function () {
  if (sessionStorage.getItem('admin_auth') !== '1') { window.location.href = 'index.html'; return; }
  document.getElementById('adminDashboard').classList.add('active');
  await renderDashboard();
  startTimerTick();

  // Real-time updates
  onSnapshot(collection(db, 'votes'),   () => renderDashboard());
  onSnapshot(collection(db, 'users'),   () => renderDashboard());
  onSnapshot(doc(db, 'settings', 'reveal'), () => updateRevealUI());
};

// Expose to HTML
window.adminLogout = adminLogout; window.switchTab = switchTab;
window.revealNow = revealNow; window.hideResults = hideResults;
window.startRevealTimer = startRevealTimer; window.cancelTimer = cancelTimer;
window.promptResetVotes = promptResetVotes; window.closeResetConfirm = closeResetConfirm;
window.confirmResetVotes = confirmResetVotes; window.promptDelete = promptDelete;
window.closeConfirm = closeConfirm; window.confirmDelete = confirmDelete;
window.renderDashboard = renderDashboard;

// ===== ADMIN LOGIC =====

const CREATOR_NAMES = {
  mrbeast:    { name: 'Ace Macho',          category: 'entertainment' },
  markiplier: { name: 'Markiplier',        category: 'entertainment' },
  emma:       { name: 'Emma Chamberlain',  category: 'entertainment' },
  charli:     { name: "Charli D'Amelio",   category: 'influencer'    },
  khaby:      { name: 'Khaby Lame',        category: 'influencer'    },
  addison:    { name: 'Addison Rae',       category: 'influencer'    },
  ninja:      { name: 'Ninja',             category: 'gaming'        },
  pokimane:   { name: 'Pokimane',          category: 'gaming'        },
  shroud:     { name: 'Shroud',            category: 'gaming'        },
};

// ---- DB helpers ----
function getUsers()    { return JSON.parse(localStorage.getItem('nv_users')  || '[]'); }
function getVotes()    { return JSON.parse(localStorage.getItem('nv_votes')  || '[]'); }
function saveUsers(u)  { localStorage.setItem('nv_users',  JSON.stringify(u)); }
function saveVotes(v)  { localStorage.setItem('nv_votes',  JSON.stringify(v)); }

// ---- Reveal state helpers ----
// nv_reveal: { revealed: bool, revealAt: ISO string | null, locked: bool }
function getRevealState() {
  return JSON.parse(localStorage.getItem('nv_reveal') || '{"revealed":false,"revealAt":null,"locked":false}');
}
function saveRevealState(s) { localStorage.setItem('nv_reveal', JSON.stringify(s)); }

// ===== SHARED COUNTDOWN FORMATTER =====
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

function revealNow() {
  const s = getRevealState();
  s.revealed = true;
  s.revealAt  = null;
  s.locked    = false;
  saveRevealState(s);
  localStorage.setItem('nv_reveal_change', Date.now().toString());
  clearInterval(timerInterval);
  updateRevealUI();
  renderDashboard();
}

function hideResults() {
  const s = { revealed: false, revealAt: null, locked: false };
  saveRevealState(s);
  localStorage.setItem('nv_reveal_change', Date.now().toString());
  clearInterval(timerInterval);
  updateRevealUI();
  renderDashboard();
}

function startRevealTimer() {
  const days  = parseInt(document.getElementById('timerDays').value,    10) || 0;
  const hours = parseInt(document.getElementById('timerHours').value,   10) || 0;
  const mins  = parseInt(document.getElementById('timerMinutes').value, 10) || 0;
  const secs  = parseInt(document.getElementById('timerSeconds').value, 10) || 0;
  const totalMs = (days * 86400 + hours * 3600 + mins * 60 + secs) * 1000;
  if (totalMs < 30000) return alert('Please set at least 30 seconds.');
  const revealAt = new Date(Date.now() + totalMs).toISOString();
  const s = { revealed: false, revealAt, locked: false };
  saveRevealState(s);
  clearInterval(timerInterval);
  startTimerTick();
  updateRevealUI();
}

function cancelTimer() {
  const s = getRevealState();
  s.revealAt = null;
  s.locked   = false;
  saveRevealState(s);
  clearInterval(timerInterval);
  updateRevealUI();
}

let timerInterval = null;

function startTimerTick() {
  clearInterval(timerInterval);
  timerInterval = setInterval(timerTick, 1000);
  timerTick();
}

function timerTick() {
  const s = getRevealState();
  if (!s.revealAt) { updateRevealUI(); return; }

  const now       = Date.now();
  const revealAt  = new Date(s.revealAt).getTime();
  const remaining = revealAt - now;

  if (remaining <= 0) {
    // Time's up — reveal, unlock voting
    s.revealed = true;
    s.revealAt  = null;
    s.locked    = false;
    saveRevealState(s);
    clearInterval(timerInterval);
    updateRevealUI();
    renderDashboard();
    return;
  }

  // Lock votes at 30 seconds remaining
  if (remaining <= 30000 && !s.locked) {
    s.locked = true;
    saveRevealState(s);
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

function updateRevealUI() {
  const s      = getRevealState();
  const badge  = document.getElementById('revealStatusBadge');
  const timerD = document.getElementById('timerDisplay');
  const cancelBtn = document.getElementById('btnCancelTimer');

  if (!badge) return;

  if (s.revealed) {
    badge.textContent = '● Results Revealed';
    badge.className   = 'reveal-status-badge revealed';
  } else if (s.locked) {
    badge.textContent = '🔒 Voting Locked';
    badge.className   = 'reveal-status-badge locked';
  } else {
    badge.textContent = '● Results Hidden';
    badge.className   = 'reveal-status-badge hidden';
  }

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
function renderDashboard() {
  const users = getUsers();
  const votes = getVotes();
  document.getElementById('statTotalUsers').textContent = users.length;
  document.getElementById('statTotalVotes').textContent = votes.length;
  renderVoteResults(votes);
  renderUsersTable(users, votes);
  updateRevealUI();
}

// ===== VOTE RESULTS (always visible to admin) =====
function renderVoteResults(votes) {
  ['entertainment', 'influencer', 'gaming'].forEach(cat => {
    const creators = Object.entries(CREATOR_NAMES).filter(([, v]) => v.category === cat);
    const catVotes = votes.filter(v => v.category === cat);
    const total    = catVotes.length;

    const ranked = creators.map(([id, info]) => ({
      id, name: info.name,
      count: catVotes.filter(v => v.creator_id === id).length
    })).sort((a, b) => b.count - a.count);

    const container = document.getElementById('results-' + cat);
    if (!container) return;

    if (total === 0) {
      container.innerHTML = '<div class="empty-state">No votes yet in this category.</div>';
      return;
    }

    container.innerHTML = ranked.map((r, i) => `
      <div class="result-row">
        <div class="result-rank">${i + 1}</div>
        <div class="result-name">${r.name}</div>
        <div class="result-cat ${cat}">${cat === 'entertainment' ? 'Media & Ent.' : cat === 'influencer' ? 'Social Impact' : 'Gaming'}</div>
        <div class="result-bar-wrap">
          <div class="result-bar" style="width:${total > 0 ? (r.count / total * 100) : 0}%"></div>
        </div>
        <div class="result-votes">${r.count} vote${r.count !== 1 ? 's' : ''}</div>
      </div>
    `).join('');
  });
}

// ===== USERS TABLE =====
function renderUsersTable(users, votes) {
  const tbody = document.getElementById('usersTableBody');
  document.getElementById('userCountLabel').textContent =
    `${users.length} registered user${users.length !== 1 ? 's' : ''}`;

  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state">No users registered yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map((u, i) => {
    const userVotes = votes.filter(v => String(v.user_id) === String(u.id));
    const votedFor  = cat => {
      const v = userVotes.find(v => v.category === cat);
      return v
        ? `<span class="voted-pill yes">${CREATOR_NAMES[v.creator_id]?.name || v.creator_id}</span>`
        : `<span class="voted-pill no">—</span>`;
    };
    return `
      <tr>
        <td>${i + 1}</td>
        <td>${escHtml(u.name)}</td>
        <td class="td-email">${escHtml(u.email)}</td>
        <td class="td-id">${u.id}</td>
        <td>${votedFor('entertainment')}</td>
        <td>${votedFor('influencer')}</td>
        <td>${votedFor('gaming')}</td>
        <td><button class="btn-delete" onclick="promptDelete('${u.id}', '${escHtml(u.name)}')">Delete</button></td>
      </tr>
    `;
  }).join('');
}

// ===== RESET VOTES =====
function promptResetVotes() {
  document.getElementById('resetConfirmOverlay').classList.add('open');
}
function closeResetConfirm() {
  document.getElementById('resetConfirmOverlay').classList.remove('open');
}
function confirmResetVotes() {
  saveVotes([]);
  saveRevealState({ revealed: false, revealAt: null, locked: false });
  // Signal vote page to re-sync (works across tabs via storage event)
  localStorage.setItem('nv_reset_signal', Date.now().toString());
  clearInterval(timerInterval);
  closeResetConfirm();
  renderDashboard();
  updateRevealUI();
}

// ===== DELETE USER =====
let pendingDeleteId = null;

function promptDelete(userId, userName) {
  pendingDeleteId = userId;
  document.getElementById('confirmMsg').textContent =
    `This will permanently remove "${userName}" and all their votes. This cannot be undone.`;
  document.getElementById('confirmOverlay').classList.add('open');
}

function closeConfirm() {
  pendingDeleteId = null;
  document.getElementById('confirmOverlay').classList.remove('open');
}

function confirmDelete() {
  if (!pendingDeleteId) return;

  // Remove user
  const users = getUsers().filter(u => String(u.id) !== String(pendingDeleteId));
  saveUsers(users);

  // Remove their votes
  const votes = getVotes().filter(v => String(v.user_id) !== String(pendingDeleteId));
  saveVotes(votes);

  closeConfirm();
  renderDashboard();
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ===== INIT =====
window.onload = function () {
  if (sessionStorage.getItem('admin_auth') !== '1') {
    window.location.href = 'index.html';
    return;
  }
  document.getElementById('adminDashboard').classList.add('active');
  renderDashboard();
  startTimerTick();
};

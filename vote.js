// ===== VOTE PAGE LOGIC (Firebase Firestore) =====
import { db, doc, getDoc, setDoc, addDoc, collection, query, where,
         getDocs, onSnapshot, serverTimestamp }
  from './firebase.js';

const VIDEOS = {
  mrbeast:    { id: 'ha1y3iFhV1U', name: 'Ace Macho',          category: 'entertainment' },
  markiplier: { id: '5bGCElFBYhk', name: 'Markiplier',         category: 'entertainment' },
  emma:       { id: 'Ks-_Mh1QhMc', name: 'Emma Chamberlain',   category: 'entertainment' },
  charli:     { id: 'FlsCjmMhFmw', name: "Charli D'Amelio",    category: 'influencer'    },
  khaby:      { id: 'Ks-_Mh1QhMc', name: 'Khaby Lame',         category: 'influencer'    },
  addison:    { id: 'TQ_4MBMFkMk', name: 'Addison Rae',        category: 'influencer'    },
  ninja:      { id: '5bGCElFBYhk', name: 'Ninja',              category: 'gaming'        },
  pokimane:   { id: 'FlsCjmMhFmw', name: 'Pokimane',           category: 'gaming'        },
  shroud:     { id: 'TQ_4MBMFkMk', name: 'Shroud',             category: 'gaming'        },
};

const CATEGORY_ORDER = ['entertainment', 'influencer', 'gaming'];
const CATEGORY_LABELS = {
  entertainment: { emoji: '🎬', name: 'Next-Gen Media & Entertainment Creators' },
  influencer:    { emoji: '✨', name: 'Next-Gen Social Impact Creators'          },
  gaming:        { emoji: '🎮', name: 'Next-Gen Gaming Creators'                 },
};

const PHANTOM_TOTAL = 342945;

// ===== COUNTDOWN FORMATTER =====
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

// ===== PHANTOM VOTES =====
function getPhantomVotes() {
  let seed = localStorage.getItem('nv_phantom_seed');
  if (!seed) { seed = Date.now().toString(); localStorage.setItem('nv_phantom_seed', seed); }
  function sr(s) { let x = Math.sin(s) * 10000; return x - Math.floor(x); }
  let sn = parseInt(seed) % 999983;
  const phantom = {};
  CATEGORY_ORDER.forEach(cat => {
    const creators = Object.keys(VIDEOS).filter(id => VIDEOS[id].category === cat);
    const r1 = 0.2 + sr(sn++) * 0.6, r2 = 0.2 + sr(sn++) * 0.6;
    const splits = [r1, r2].sort((a,b) => a-b);
    const shares = [splits[0], splits[1]-splits[0], 1-splits[1]];
    creators.forEach((id, i) => { phantom[id] = Math.round(PHANTOM_TOTAL * shares[i]); });
  });
  return phantom;
}

// ===== STATE =====
let currentModalCreator = null;
let voteTimerInterval   = null;
let revealState         = { revealed: false, revealAt: null, locked: false };
let allVotes            = []; // cached from Firestore

// ===== FIRESTORE HELPERS =====
async function fetchVotes() {
  const snap = await getDocs(collection(db, 'votes'));
  allVotes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return allVotes;
}

async function fetchRevealState() {
  const snap = await getDoc(doc(db, 'settings', 'reveal'));
  if (snap.exists()) revealState = snap.data();
  else revealState = { revealed: false, revealAt: null, locked: false };
  return revealState;
}

// ===== INIT =====
window.onload = async function () {
  const user = JSON.parse(sessionStorage.getItem('nexvote_session') || 'null');
  if (!user) return window.location.href = 'index.html';
  document.getElementById('navUser').textContent = `👤 ${user.name || user.email}`;

  hideAllTallies();
  await fetchVotes();
  await fetchRevealState();

  if (revealState.revealed) {
    if (sessionStorage.getItem('reveal_animated') === '1') showFinalResults();
    else runSequentialReveal();
  }

  applyLockState();
  startVoteTimerTick();

  // Listen for real-time reveal state changes
  onSnapshot(doc(db, 'settings', 'reveal'), snap => {
    if (!snap.exists()) return;
    const prev = revealState.revealed;
    revealState = snap.data();

    if (revealState.revealed && !prev) {
      if (sessionStorage.getItem('reveal_animated') !== '1') {
        clearInterval(voteTimerInterval);
        fetchVotes().then(() => runSequentialReveal());
      } else {
        fetchVotes().then(() => showFinalResults());
      }
    } else if (!revealState.revealed && prev) {
      sessionStorage.removeItem('reveal_animated');
      localStorage.removeItem('nv_phantom_seed');
      hideAllTallies();
      document.querySelectorAll('.creator-card.winner').forEach(c => c.classList.remove('winner'));
      applyLockState();
      updateVoterBanner(revealState, null, false);
    } else {
      applyLockState();
    }
  });

  // Listen for real-time vote changes
  onSnapshot(collection(db, 'votes'), snap => {
    allVotes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (revealState.revealed) showFinalResults();
    applyLockState();
  });
};

// ===== HIDE ALL TALLIES =====
function hideAllTallies() {
  Object.keys(VIDEOS).forEach(id => {
    const countEl = document.getElementById(`count-${id}`);
    const barWrap = document.getElementById(`bar-${id}`)?.closest('.vote-bar-wrap');
    if (countEl) { countEl.textContent = ''; countEl.style.visibility = 'hidden'; }
    if (barWrap) barWrap.style.visibility = 'hidden';
  });
}

// ===== SHOW FINAL RESULTS =====
function showFinalResults() {
  const totals   = buildTotals(allVotes);
  const catTotals = buildCatTotals(allVotes);
  Object.keys(VIDEOS).forEach(id => {
    const count = totals[id] || 0;
    const cat   = VIDEOS[id].category;
    const pct   = catTotals[cat] > 0 ? (count / catTotals[cat]) * 100 : 0;
    const countEl = document.getElementById(`count-${id}`);
    const barEl   = document.getElementById(`bar-${id}`);
    const barWrap = barEl?.closest('.vote-bar-wrap');
    if (countEl) { countEl.textContent = `${count.toLocaleString()} votes`; countEl.style.visibility = 'visible'; }
    if (barEl)   barEl.style.width = pct + '%';
    if (barWrap) barWrap.style.visibility = 'visible';
  });
  CATEGORY_ORDER.forEach(cat => crownWinner(cat));
}

// ===== SEQUENTIAL REVEAL =====
async function runSequentialReveal() {
  sessionStorage.setItem('reveal_animated', '1');
  localStorage.setItem('nv_phantom_seed', Date.now().toString());

  for (let i = 0; i < CATEGORY_ORDER.length; i++) {
    const cat   = CATEGORY_ORDER[i];
    const label = CATEGORY_LABELS[cat];
    await showRevealOverlay(label.emoji, label.name);
    const section = document.querySelector(`.category-label.${cat}`)?.closest('.category-section');
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(400);
    if (section) section.classList.add('revealing');
    await countUpCategory(cat);
    await sleep(600);
    if (section) section.classList.add('counting-done');
    crownWinner(cat);
    await sleep(1800);
    if (section) { section.classList.remove('revealing'); section.classList.remove('counting-done'); }
  }
  updateVoterBanner(revealState, null, false);
}

function showRevealOverlay(emoji, name) {
  return new Promise(resolve => {
    const overlay = document.getElementById('revealOverlay');
    document.getElementById('revealOverlayCat').textContent = `${emoji} ${name}`;
    document.getElementById('revealOverlaySub').textContent = 'Category';
    overlay.classList.add('show');
    setTimeout(() => { overlay.classList.remove('show'); setTimeout(resolve, 300); }, 2000);
  });
}

function countUpCategory(cat) {
  return new Promise(resolve => {
    const creators = Object.keys(VIDEOS).filter(id => VIDEOS[id].category === cat);
    const totals   = buildTotals(allVotes);
    const catTotal = creators.reduce((s, id) => s + (totals[id] || 0), 0);

    creators.forEach(id => {
      const countEl = document.getElementById(`count-${id}`);
      const barEl   = document.getElementById(`bar-${id}`);
      const barWrap = barEl?.closest('.vote-bar-wrap');
      if (countEl) { countEl.style.visibility = 'visible'; countEl.classList.add('counting'); countEl.textContent = '0 votes'; }
      if (barEl)   { barEl.style.width = '0%'; barEl.classList.add('counting'); }
      if (barWrap) { barWrap.style.visibility = 'visible'; barWrap.classList.add('counting'); }
    });

    if (catTotal === 0) { resolve(); return; }

    const duration = 3000, startTime = performance.now();
    const targets  = {};
    creators.forEach(id => { targets[id] = totals[id] || 0; });

    function tick(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3);
      creators.forEach(id => {
        const cur = Math.round(eased * targets[id]);
        const pct = eased * (catTotal > 0 ? (targets[id] / catTotal) * 100 : 0);
        const countEl = document.getElementById(`count-${id}`);
        const barEl   = document.getElementById(`bar-${id}`);
        if (countEl) countEl.textContent = `${cur.toLocaleString()} votes`;
        if (barEl)   barEl.style.width   = pct + '%';
      });
      if (progress < 1) { requestAnimationFrame(tick); return; }
      creators.forEach(id => {
        const countEl = document.getElementById(`count-${id}`);
        const barEl   = document.getElementById(`bar-${id}`);
        const barWrap = barEl?.closest('.vote-bar-wrap');
        const pct = catTotal > 0 ? (targets[id] / catTotal) * 100 : 0;
        if (countEl) { countEl.textContent = `${targets[id].toLocaleString()} votes`; countEl.classList.remove('counting'); }
        if (barEl)   { barEl.style.width = pct + '%'; barEl.classList.remove('counting'); }
        if (barWrap) barWrap.classList.remove('counting');
      });
      resolve();
    }
    requestAnimationFrame(tick);
  });
}

function crownWinner(cat) {
  const creators = Object.keys(VIDEOS).filter(id => VIDEOS[id].category === cat);
  const totals   = buildTotals(allVotes);
  let maxVotes = -1, winnerId = null;
  creators.forEach(id => { const c = totals[id] || 0; if (c > maxVotes) { maxVotes = c; winnerId = id; } });
  if (winnerId && maxVotes > 0) {
    const card = document.querySelector(`.creator-card[data-id="${winnerId}"]`);
    if (card) card.classList.add('winner');
  }
}

// ===== HELPERS =====
function buildTotals(votes) {
  const t = {}, phantom = getPhantomVotes();
  votes.forEach(v => { t[v.creatorId] = (t[v.creatorId] || 0) + 1; });
  Object.keys(phantom).forEach(id => { t[id] = (t[id] || 0) + phantom[id]; });
  return t;
}
function buildCatTotals(votes) {
  const t = { entertainment: 0, influencer: 0, gaming: 0 }, phantom = getPhantomVotes();
  votes.forEach(v => { if (t[v.category] !== undefined) t[v.category]++; });
  Object.keys(VIDEOS).forEach(id => { const cat = VIDEOS[id].category; if (t[cat] !== undefined) t[cat] += (phantom[id] || 0); });
  return t;
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ===== TIMER TICK =====
function startVoteTimerTick() {
  clearInterval(voteTimerInterval);
  voteTimerInterval = setInterval(() => {
    const remaining = revealState.revealAt ? new Date(revealState.revealAt).getTime() - Date.now() : null;
    if (!revealState.revealed) {
      hideAllTallies();
      document.querySelectorAll('.creator-card.winner').forEach(c => c.classList.remove('winner'));
    }
    applyLockState();
    updateVoterBanner(revealState, remaining, !revealState.revealed && (revealState.locked || (remaining !== null && remaining <= 30000)));
  }, 1000);
}

// ===== APPLY LOCK STATE =====
function applyLockState() {
  const remaining = revealState.revealAt ? new Date(revealState.revealAt).getTime() - Date.now() : null;
  const isLocked  = !revealState.revealed && (revealState.locked || (remaining !== null && remaining <= 30000));
  const user      = JSON.parse(sessionStorage.getItem('nexvote_session') || 'null');
  const userVotes = allVotes.filter(v => v.userId === user?.id);

  document.querySelectorAll('.creator-card').forEach(card => {
    const creatorId = card.dataset.id;
    const category  = card.dataset.category;
    const btn       = card.querySelector('.btn-vote');
    const hasVoted  = userVotes.some(v => v.category === category && v.creatorId === creatorId);
    const catVoted  = userVotes.some(v => v.category === category);
    card.classList.remove('winner');
    if (hasVoted) {
      card.classList.add('voted');
      if (btn) { btn.textContent = '✓ Voted'; btn.classList.add('voted-btn'); btn.disabled = true; }
    } else if (catVoted) {
      card.classList.remove('voted');
      if (btn) { btn.textContent = 'Vote'; btn.classList.remove('voted-btn'); btn.disabled = true; }
    } else {
      card.classList.remove('voted');
      if (btn) { btn.classList.remove('voted-btn'); btn.disabled = isLocked; btn.textContent = isLocked ? '🔒 Locked' : 'Vote'; }
    }
  });
  if (revealState.revealed) CATEGORY_ORDER.forEach(cat => crownWinner(cat));
}

// ===== VOTER BANNER =====
function updateVoterBanner(s, remaining, isLocked) {
  let banner = document.getElementById('voterBanner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'voterBanner';
    banner.style.cssText = `position:fixed;top:64px;left:0;right:0;z-index:200;text-align:center;padding:10px 20px;font-size:0.85rem;font-weight:700;letter-spacing:1px;`;
    document.body.appendChild(banner);
  }
  if (s.revealed) {
    banner.style.cssText += 'background:linear-gradient(90deg,rgba(57,255,20,0.15),rgba(57,255,20,0.08));border-bottom:1px solid rgba(57,255,20,0.3);color:#39ff14;display:block;';
    banner.textContent = '🏆 Results are now revealed!';
  } else if (isLocked && remaining !== null) {
    banner.style.cssText += 'background:linear-gradient(90deg,rgba(255,60,110,0.15),rgba(255,60,110,0.08));border-bottom:1px solid rgba(255,60,110,0.3);color:#ff6b8a;display:block;';
    banner.textContent = `🔒 Voting locked — results reveal in ${formatCountdown(remaining)}`;
  } else if (s.locked && !s.revealAt) {
    banner.style.cssText += 'background:linear-gradient(90deg,rgba(255,140,0,0.12),rgba(255,140,0,0.06));border-bottom:1px solid rgba(255,140,0,0.3);color:#ff8c00;display:block;';
    banner.textContent = '🔒 Voting is currently locked by the administrator.';
  } else if (remaining !== null && remaining > 30000) {
    banner.style.cssText += 'background:linear-gradient(90deg,rgba(123,47,255,0.12),rgba(123,47,255,0.06));border-bottom:1px solid rgba(123,47,255,0.25);color:#9d7fc0;display:block;';
    banner.textContent = `⏳ Results will be revealed in ${formatCountdown(remaining)}`;
  } else {
    banner.style.display = 'none';
  }
}

// ===== VIDEO MODAL =====
function openVideo(creatorId) {
  const creator = VIDEOS[creatorId];
  if (!creator) return;
  currentModalCreator = creatorId;
  document.getElementById('modalCreatorName').textContent = `▶ ${creator.name} — Highlights`;
  document.getElementById('videoFrame').src = `https://www.youtube.com/embed/${creator.id}?autoplay=1&rel=0`;
  const user         = JSON.parse(sessionStorage.getItem('nexvote_session') || 'null');
  const userVotes    = allVotes.filter(v => v.userId === user?.id);
  const alreadyVoted = userVotes.some(v => v.category === creator.category);
  const remaining    = revealState.revealAt ? new Date(revealState.revealAt).getTime() - Date.now() : null;
  const isLocked     = !revealState.revealed && (revealState.locked || (remaining !== null && remaining <= 30000));
  const voteBtn = document.getElementById('modalVoteBtn');
  if (alreadyVoted)  { voteBtn.textContent = '✓ Already Voted'; voteBtn.disabled = true; }
  else if (isLocked) { voteBtn.textContent = '🔒 Voting Locked'; voteBtn.disabled = true; }
  else { voteBtn.textContent = `Vote for ${creator.name}`; voteBtn.disabled = false; voteBtn.onclick = () => { closeVideoModal(); castVote(creator.category, creatorId); }; }
  document.getElementById('videoModal').classList.add('open');
}

function closeVideoModal() {
  document.getElementById('videoModal').classList.remove('open');
  document.getElementById('videoFrame').src = '';
  currentModalCreator = null;
}
function closeModal(e) { if (e.target === document.getElementById('videoModal')) closeVideoModal(); }

// ===== CAST VOTE =====
async function castVote(category, creatorId) {
  const remaining = revealState.revealAt ? new Date(revealState.revealAt).getTime() - Date.now() : null;
  const isLocked  = !revealState.revealed && (revealState.locked || (remaining !== null && remaining <= 30000));
  if (isLocked) return showToast('🔒 Voting is locked.');

  const user = JSON.parse(sessionStorage.getItem('nexvote_session') || 'null');
  if (!user) return window.location.href = 'index.html';

  const alreadyVoted = allVotes.some(v => v.userId === user.id && v.category === category);
  if (alreadyVoted) return showToast(`You already voted in this category!`);

  try {
    await addDoc(collection(db, 'votes'), {
      userId: user.id, creatorId, category,
      votedAt: Date.now()
    });
    showToast(`Voted for ${VIDEOS[creatorId].name}! 🎉`);
  } catch (err) {
    showToast('Failed to save vote. Check your connection.');
  }
}

function markVoted(category, votedId) {
  document.querySelectorAll(`.creator-card[data-category="${category}"] .btn-vote`).forEach(btn => { btn.disabled = true; });
  const card = document.querySelector(`.creator-card[data-id="${votedId}"]`);
  if (card) { card.classList.add('voted'); const btn = card.querySelector('.btn-vote'); if (btn) { btn.textContent = '✓ Voted'; btn.classList.add('voted-btn'); } }
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function logout() {
  sessionStorage.removeItem('nexvote_session');
  sessionStorage.removeItem('reveal_animated');
  window.location.href = 'index.html';
}

// Expose to HTML
window.openVideo = openVideo; window.closeVideoModal = closeVideoModal;
window.closeModal = closeModal; window.castVote = castVote; window.logout = logout;

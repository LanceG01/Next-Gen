// ===== NexVote — Vote Page Logic =====

const VIDEOS = {
  mrbeast:    { id: 'ha1y3iFhV1U', name: 'Ace Macho',          category: 'entertainment' },
  markiplier: { id: '5bGCElFBYhk', name: 'Markiplier',        category: 'entertainment' },
  emma:       { id: 'Ks-_Mh1QhMc', name: 'Emma Chamberlain',  category: 'entertainment' },
  charli:     { id: 'FlsCjmMhFmw', name: "Charli D'Amelio",   category: 'influencer'    },
  khaby:      { id: 'Ks-_Mh1QhMc', name: 'Khaby Lame',        category: 'influencer'    },
  addison:    { id: 'TQ_4MBMFkMk', name: 'Addison Rae',       category: 'influencer'    },
  ninja:      { id: '5bGCElFBYhk', name: 'Ninja',             category: 'gaming'        },
  pokimane:   { id: 'FlsCjmMhFmw', name: 'Pokimane',          category: 'gaming'        },
  shroud:     { id: 'TQ_4MBMFkMk', name: 'Shroud',            category: 'gaming'        },
};

const CATEGORY_ORDER = ['entertainment', 'influencer', 'gaming'];
const CATEGORY_LABELS = {
  entertainment: { emoji: '🎬', name: 'Next-Gen Media & Entertainment Creators' },
  influencer:    { emoji: '✨', name: 'Next-Gen Social Impact Creators'          },
  gaming:        { emoji: '🎮', name: 'Next-Gen Gaming Creators'                 },
};

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


function getVotes()   { return JSON.parse(localStorage.getItem('nv_votes')  || '[]'); }
function saveVotes(v) { localStorage.setItem('nv_votes', JSON.stringify(v)); }
function getRevealState() {
  return JSON.parse(localStorage.getItem('nv_reveal') || '{"revealed":false,"revealAt":null,"locked":false}');
}

let currentModalCreator = null;
let voteTimerInterval   = null;
let revealAnimDone      = false; // tracks if count-up animation already ran this session

// ===== INIT =====
window.onload = function () {
  const user = JSON.parse(sessionStorage.getItem('nexvote_session') || 'null');
  if (!user) return window.location.href = 'index.html';

  document.getElementById('navUser').textContent = `👤 ${user.name || user.email}`;

  hideAllTallies();

  const s = getRevealState();
  if (s.revealed) {
    if (sessionStorage.getItem('reveal_animated') === '1') {
      showFinalResults();
    } else {
      runSequentialReveal();
    }
  }

  applyLockState();
  startVoteTimerTick();
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

// ===== SHOW FINAL RESULTS (no animation, already seen) =====
function showFinalResults() {
  const votes    = getVotes();
  const totals   = buildTotals(votes);
  const catTotals = buildCatTotals(votes);

  Object.keys(VIDEOS).forEach(id => {
    const count   = totals[id] || 0;
    const cat     = VIDEOS[id].category;
    const pct     = catTotals[cat] > 0 ? (count / catTotals[cat]) * 100 : 0;
    const countEl = document.getElementById(`count-${id}`);
    const barEl   = document.getElementById(`bar-${id}`);
    const barWrap = barEl?.closest('.vote-bar-wrap');
    if (countEl) { countEl.textContent = `${count} vote${count !== 1 ? 's' : ''}`; countEl.style.visibility = 'visible'; }
    if (barEl)   barEl.style.width = pct + '%';
    if (barWrap) barWrap.style.visibility = 'visible';
  });

  // Crown winners
  CATEGORY_ORDER.forEach(cat => crownWinner(cat, votes));
}

// ===== SEQUENTIAL REVEAL ANIMATION =====
async function runSequentialReveal() {
  sessionStorage.setItem('reveal_animated', '1');
  const votes = getVotes();

  for (let i = 0; i < CATEGORY_ORDER.length; i++) {
    const cat = CATEGORY_ORDER[i];
    const label = CATEGORY_LABELS[cat];

    // Show overlay announcement
    await showRevealOverlay(label.emoji, label.name);

    // Scroll category to center of screen
    const section = document.querySelector(`.category-label.${cat}`)?.closest('.category-section');
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'center' });

    await sleep(400);

    // Mark section as actively revealing
    if (section) section.classList.add('revealing');

    // Count up this category
    await countUpCategory(cat, votes);

    // Pause to let viewers see the result, then crown winner
    await sleep(600);
    if (section) section.classList.add('counting-done');
    crownWinner(cat, votes);
    await sleep(1800);
    if (section) { section.classList.remove('revealing'); section.classList.remove('counting-done'); }
  }

  // All done — show banner
  updateVoterBanner(getRevealState(), null, false);
}

// ===== SHOW REVEAL OVERLAY =====
function showRevealOverlay(emoji, name) {
  return new Promise(resolve => {
    const overlay = document.getElementById('revealOverlay');
    document.getElementById('revealOverlayCat').textContent = `${emoji} ${name}`;
    document.getElementById('revealOverlaySub').textContent = 'Category';
    overlay.classList.add('show');
    setTimeout(() => {
      overlay.classList.remove('show');
      setTimeout(resolve, 300);
    }, 2000);
  });
}

// ===== COUNT UP A SINGLE CATEGORY =====
function countUpCategory(cat, votes) {
  return new Promise(resolve => {
    const creators = Object.keys(VIDEOS).filter(id => VIDEOS[id].category === cat);
    const totals   = buildTotals(votes);
    const catTotal = creators.reduce((sum, id) => sum + (totals[id] || 0), 0);

    // Make bars/counts visible and add counting class
    creators.forEach(id => {
      const countEl = document.getElementById(`count-${id}`);
      const barEl   = document.getElementById(`bar-${id}`);
      const barWrap = barEl?.closest('.vote-bar-wrap');
      if (countEl) { countEl.style.visibility = 'visible'; countEl.classList.add('counting'); countEl.textContent = '0 votes'; }
      if (barEl)   { barEl.style.width = '0%'; barEl.classList.add('counting'); }
      if (barWrap) { barWrap.style.visibility = 'visible'; barWrap.classList.add('counting'); }
    });
    if (catTotal === 0) { resolve(); return; }

    const duration  = 3000; // ms for full count-up
    const startTime = performance.now();
    const targets   = {};
    creators.forEach(id => { targets[id] = totals[id] || 0; });

    function tick(now) {
      const elapsed  = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic for dramatic slow-down at the end
      const eased    = 1 - Math.pow(1 - progress, 3);

      creators.forEach(id => {
        const current  = Math.round(eased * targets[id]);
        const finalPct = catTotal > 0 ? (targets[id] / catTotal) * 100 : 0;
        const curPct   = eased * finalPct;
        const countEl  = document.getElementById(`count-${id}`);
        const barEl    = document.getElementById(`bar-${id}`);
        if (countEl) countEl.textContent = `${current} vote${current !== 1 ? 's' : ''}`;
        if (barEl)   barEl.style.width   = curPct + '%';
      });

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        // Snap to exact final values
        creators.forEach(id => {
          const countEl = document.getElementById(`count-${id}`);
          const barEl   = document.getElementById(`bar-${id}`);
          const barWrap = barEl?.closest('.vote-bar-wrap');
          const finalPct = catTotal > 0 ? (targets[id] / catTotal) * 100 : 0;
          if (countEl) { countEl.textContent = `${targets[id]} vote${targets[id] !== 1 ? 's' : ''}`; countEl.classList.remove('counting'); }
          if (barEl)   { barEl.style.width = finalPct + '%'; barEl.classList.remove('counting'); }
          if (barWrap) barWrap.classList.remove('counting');
        });
        resolve();
      }
    }

    requestAnimationFrame(tick);
  });
}

// ===== CROWN THE WINNER =====
function crownWinner(cat, votes) {
  const creators  = Object.keys(VIDEOS).filter(id => VIDEOS[id].category === cat);
  const totals    = buildTotals(votes);
  let   maxVotes  = -1;
  let   winnerId  = null;

  creators.forEach(id => {
    const count = totals[id] || 0;
    if (count > maxVotes) { maxVotes = count; winnerId = id; }
  });

  if (winnerId && maxVotes > 0) {
    const card = document.querySelector(`.creator-card[data-id="${winnerId}"]`);
    if (card) card.classList.add('winner');
  }
}

// ===== HELPERS =====
function buildTotals(votes) {
  const t = {};
  votes.forEach(v => { t[v.creator_id] = (t[v.creator_id] || 0) + 1; });
  return t;
}
function buildCatTotals(votes) {
  const t = { entertainment: 0, influencer: 0, gaming: 0 };
  votes.forEach(v => { if (t[v.category] !== undefined) t[v.category]++; });
  return t;
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ===== TIMER TICK =====
function startVoteTimerTick() {
  clearInterval(voteTimerInterval);
  voteTimerInterval = setInterval(checkRevealTick, 1000);
}

function checkRevealTick() {
  const s         = getRevealState();
  const now       = Date.now();
  const revealAt  = s.revealAt ? new Date(s.revealAt).getTime() : null;
  const remaining = revealAt ? revealAt - now : null;

  // Auto-reveal when timer hits zero
  if (revealAt && remaining <= 0 && !s.revealed) {
    s.revealed = true; s.revealAt = null; s.locked = false;
    localStorage.setItem('nv_reveal', JSON.stringify(s));
  }

  // Trigger animation when revealed for the first time this session
  if (s.revealed && sessionStorage.getItem('reveal_animated') !== '1') {
    clearInterval(voteTimerInterval);
    runSequentialReveal();
    return;
  }

  // If not revealed, make sure tallies are hidden
  if (!s.revealed) {
    hideAllTallies();
    document.querySelectorAll('.creator-card.winner').forEach(c => c.classList.remove('winner'));
  }

  applyLockState();
  updateVoterBanner(s, remaining, !s.revealed && (s.locked || (remaining !== null && remaining <= 30000)));
}

// ===== APPLY LOCK STATE =====
function applyLockState() {
  const s         = getRevealState();
  const remaining = s.revealAt ? new Date(s.revealAt).getTime() - Date.now() : null;
  const isLocked  = !s.revealed && (s.locked || (remaining !== null && remaining <= 30000));

  const user      = JSON.parse(sessionStorage.getItem('nexvote_session') || 'null');
  const userVotes = user ? getVotes().filter(v => String(v.user_id) === String(user.id)) : [];

  // Full DOM sync — reset every card then re-apply current state
  document.querySelectorAll('.creator-card').forEach(card => {
    const creatorId = card.dataset.id;
    const category  = card.dataset.category;
    const btn       = card.querySelector('.btn-vote');
    const hasVoted  = userVotes.some(v => v.category === category && v.creator_id === creatorId);
    const catVoted  = userVotes.some(v => v.category === category);

    // Remove stale winner/voted classes first
    card.classList.remove('winner');

    if (hasVoted) {
      // This creator was voted for
      card.classList.add('voted');
      if (btn) { btn.textContent = '✓ Voted'; btn.classList.add('voted-btn'); btn.disabled = true; }
    } else if (catVoted) {
      // Another creator in this category was voted for — disable but don't mark voted
      card.classList.remove('voted');
      if (btn) { btn.textContent = 'Vote'; btn.classList.remove('voted-btn'); btn.disabled = true; }
    } else {
      // No vote cast in this category yet
      card.classList.remove('voted');
      if (btn) {
        btn.classList.remove('voted-btn');
        btn.disabled  = isLocked;
        btn.textContent = isLocked ? '🔒 Locked' : 'Vote';
      }
    }
  });

  // Re-crown winners if revealed
  if (s.revealed) {
    CATEGORY_ORDER.forEach(cat => crownWinner(cat, getVotes()));
  }
}

// ===== VOTER BANNER =====
function updateVoterBanner(s, remaining, isLocked) {
  let banner = document.getElementById('voterBanner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'voterBanner';
    banner.style.cssText = `position:fixed;top:64px;left:0;right:0;z-index:200;
      text-align:center;padding:10px 20px;font-size:0.85rem;font-weight:700;letter-spacing:1px;transition:all 0.3s;`;
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

// ===== OPEN VIDEO MODAL =====
function openVideo(creatorId) {
  const creator = VIDEOS[creatorId];
  if (!creator) return;

  currentModalCreator = creatorId;
  document.getElementById('modalCreatorName').textContent = `▶ ${creator.name} — Highlights`;
  document.getElementById('videoFrame').src =
    `https://www.youtube.com/embed/${creator.id}?autoplay=1&rel=0`;

  const user         = JSON.parse(sessionStorage.getItem('nexvote_session') || 'null');
  const userVotes    = getVotes().filter(v => String(v.user_id) === String(user?.id));
  const alreadyVoted = userVotes.some(v => v.category === creator.category);
  const s            = getRevealState();
  const isLocked     = !s.revealed && (s.locked || (s.revealAt && (new Date(s.revealAt).getTime() - Date.now()) <= 30000));

  const voteBtn = document.getElementById('modalVoteBtn');
  if (alreadyVoted) {
    voteBtn.textContent = '✓ Already Voted'; voteBtn.disabled = true;
  } else if (isLocked) {
    voteBtn.textContent = '🔒 Voting Locked'; voteBtn.disabled = true;
  } else {
    voteBtn.textContent = `Vote for ${creator.name}`;
    voteBtn.disabled    = false;
    voteBtn.onclick     = () => { closeVideoModal(); castVote(creator.category, creatorId); };
  }

  document.getElementById('videoModal').classList.add('open');
}

function closeVideoModal() {
  document.getElementById('videoModal').classList.remove('open');
  document.getElementById('videoFrame').src = '';
  currentModalCreator = null;
}

function closeModal(e) {
  if (e.target === document.getElementById('videoModal')) closeVideoModal();
}

// ===== CAST VOTE =====
function castVote(category, creatorId) {
  const s         = getRevealState();
  const remaining = s.revealAt ? new Date(s.revealAt).getTime() - Date.now() : null;
  const isLocked  = !s.revealed && (s.locked || (remaining !== null && remaining <= 30000));
  if (isLocked) return showToast('🔒 Voting is locked.');

  const user = JSON.parse(sessionStorage.getItem('nexvote_session') || 'null');
  if (!user) return window.location.href = 'index.html';

  const votes        = getVotes();
  const alreadyVoted = votes.some(v => String(v.user_id) === String(user.id) && v.category === category);
  if (alreadyVoted)  return showToast(`You already voted in ${category}!`);

  votes.push({ user_id: user.id, creator_id: creatorId, category, voted_at: new Date().toISOString() });
  saveVotes(votes);

  markVoted(category, creatorId);
  showToast(`Voted for ${VIDEOS[creatorId].name}! 🎉`);
}

// ===== MARK VOTED UI =====
function markVoted(category, votedId) {
  document.querySelectorAll(`.creator-card[data-category="${category}"] .btn-vote`).forEach(btn => {
    btn.disabled = true;
  });
  const card = document.querySelector(`.creator-card[data-id="${votedId}"]`);
  if (card) {
    card.classList.add('voted');
    const btn = card.querySelector('.btn-vote');
    if (btn) { btn.textContent = '✓ Voted'; btn.classList.add('voted-btn'); }
  }
}

// ===== TOAST =====
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function logout() {
  sessionStorage.removeItem('nexvote_session');
  sessionStorage.removeItem('reveal_animated');
  window.location.href = 'index.html';
}

// ===== LISTEN FOR ADMIN CHANGES (cross-tab) =====
window.addEventListener('storage', function (e) {
  if (e.key === 'nv_reset_signal') {
    sessionStorage.removeItem('reveal_animated');
    hideAllTallies();
    document.querySelectorAll('.creator-card.winner').forEach(c => c.classList.remove('winner'));
    applyLockState();
    updateVoterBanner(getRevealState(), null, false);
  }

  if (e.key === 'nv_reveal_change') {
    const s = getRevealState();
    if (s.revealed) {
      // Trigger reveal animation if not yet seen this session
      if (sessionStorage.getItem('reveal_animated') !== '1') {
        clearInterval(voteTimerInterval);
        runSequentialReveal();
      } else {
        showFinalResults();
      }
    } else {
      // Hide results — clear tallies, crowns, banner
      sessionStorage.removeItem('reveal_animated');
      hideAllTallies();
      document.querySelectorAll('.creator-card.winner').forEach(c => c.classList.remove('winner'));
      applyLockState();
      updateVoterBanner(s, null, false);
    }
  }
});

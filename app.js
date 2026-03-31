// ===== NexVote — Auth Logic =====

// ---- Admin credentials ----
const ADMIN = { username: 'Lance', password: 'pogi1121' };

// ---- "Database" helpers ----
function getUsers()  { return JSON.parse(localStorage.getItem('nv_users')  || '[]'); }
function saveUsers(u){ localStorage.setItem('nv_users',  JSON.stringify(u)); }

// ---- UI helpers ----
function switchForm(type) {
  document.getElementById('loginForm').classList.toggle('active', type === 'login');
  document.getElementById('signupForm').classList.toggle('active', type === 'signup');
  showMsg('', '');
}

function showMsg(text, type) {
  const el = document.getElementById('authMsg');
  el.textContent = text;
  el.className = 'auth-msg ' + type;
}

// ---- Login ----
function login(e) {
  e.preventDefault();
  const input    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  // Check admin credentials first
  if (input === ADMIN.username && password === ADMIN.password) {
    sessionStorage.setItem('admin_auth', '1');
    window.location.href = 'admin.html';
    return;
  }

  // Regular user login (email)
  const email = input.toLowerCase();
  const user  = getUsers().find(u => u.email === email && u.password === password);
  if (!user) return showMsg('Invalid email/username or password.', 'error');

  saveSession(user);
  window.location.href = 'vote.html';
}

// ---- Signup ----
function signup(e) {
  e.preventDefault();
  const name     = document.getElementById('signupName').value.trim();
  const email    = document.getElementById('signupEmail').value.trim().toLowerCase();
  const password = document.getElementById('signupPassword').value;

  const users = getUsers();
  if (users.find(u => u.email === email)) {
    return showMsg('Email already registered.', 'error');
  }
  if (users.find(u => u.name.toLowerCase() === name.toLowerCase())) {
    return showMsg('Username is already taken.', 'error');
  }

  const user = { id: Date.now(), name, email, password };
  users.push(user);
  saveUsers(users);
  saveSession(user);
  window.location.href = 'vote.html';
}

function saveSession(user) {
  sessionStorage.setItem('nexvote_session', JSON.stringify({ id: user.id, name: user.name, email: user.email }));
}

function logout() {
  sessionStorage.removeItem('nexvote_session');
  window.location.href = 'index.html';
}

// ---- Init ----
window.onload = function () {
  if (sessionStorage.getItem('admin_auth') === '1') {
    window.location.href = 'admin.html';
    return;
  }
  if (sessionStorage.getItem('nexvote_session')) {
    window.location.href = 'vote.html';
    return;
  }
};

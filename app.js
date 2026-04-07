// ===== AUTH LOGIC (Firebase Firestore) =====
import { db, doc, getDoc, setDoc, collection, query, where, getDocs }
  from './firebase.js';

const ADMIN = { username: 'Lance', password: 'pogi1121' };

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
async function login(e) {
  e.preventDefault();
  const input    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  // Admin check
  if (input === ADMIN.username && password === ADMIN.password) {
    sessionStorage.setItem('admin_auth', '1');
    navigateTo('admin.html');
    return;
  }

  showMsg('Signing in…', '');
  try {
    const lower = input.toLowerCase();

    // Try email first
    let q    = query(collection(db, 'users'), where('email', '==', lower));
    let snap = await getDocs(q);

    // Fallback: try username
    if (snap.empty) {
      q    = query(collection(db, 'users'), where('nameLower', '==', lower));
      snap = await getDocs(q);
    }

    if (snap.empty) return showMsg('Invalid email/username or password.', 'error');
    const userDoc = snap.docs[0];
    const user    = userDoc.data();
    if (user.password !== password) return showMsg('Invalid email/username or password.', 'error');
    saveSession({ id: userDoc.id, name: user.name, email: user.email });
    navigateTo('intro.html');
  } catch (err) {
    showMsg('Connection error. Check your internet.', 'error');
  }
}

// ---- Signup ----
async function signup(e) {
  e.preventDefault();
  const name     = document.getElementById('signupName').value.trim();
  const email    = document.getElementById('signupEmail').value.trim().toLowerCase();
  const password = document.getElementById('signupPassword').value;

  showMsg('Creating account…', '');
  try {
    // Check duplicate email
    const emailQ = query(collection(db, 'users'), where('email', '==', email));
    const emailSnap = await getDocs(emailQ);
    if (!emailSnap.empty) return showMsg('Email already registered.', 'error');

    // Check duplicate username
    const nameQ = query(collection(db, 'users'), where('nameLower', '==', name.toLowerCase()));
    const nameSnap = await getDocs(nameQ);
    if (!nameSnap.empty) return showMsg('Username is already taken.', 'error');

    // Create user doc
    const newRef = doc(collection(db, 'users'));
    await setDoc(newRef, { name, nameLower: name.toLowerCase(), email, password, createdAt: Date.now() });
    showMsg('Account created! Please log in.', 'success');
    setTimeout(() => switchForm('login'), 1500);
  } catch (err) {
    showMsg('Connection error. Check your internet.', 'error');
  }
}

function saveSession(user) {
  sessionStorage.setItem('nexvote_session', JSON.stringify({ id: user.id, name: user.name, email: user.email }));
}

function logout() {
  sessionStorage.removeItem('nexvote_session');
  navigateTo('index.html');
}

function navigateTo(url) {
  document.body.classList.add('page-exit');
  setTimeout(() => { window.location.href = url; }, 300);
}

window.onload = function () {
  if (sessionStorage.getItem('admin_auth') === '1') { navigateTo('admin.html'); return; }
  if (sessionStorage.getItem('nexvote_session'))    { navigateTo('intro.html'); return; }
};

// Expose to HTML onclick
window.login      = login;
window.signup     = signup;
window.switchForm = switchForm;
window.logout     = logout;

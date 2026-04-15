// Simple frontend logic for login/register
const defaultApiBaseUrl = 'http://localhost:3001/api';
let apiUrl = defaultApiBaseUrl;

function buildApiCandidates() {
  const webCandidates = ['http://localhost:3001/api', 'http://127.0.0.1:3001/api'];
  return [...new Set(webCandidates.filter(Boolean))];
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function resolveApiBaseUrl() {
  const candidates = buildApiCandidates();
  for (const candidate of candidates) {
    try {
      const response = await fetchWithTimeout(candidate + '/health', { method: 'GET' }, 4000);
      if (!response.ok) continue;
      const data = await response.json();
      if (data && data.success) {
        apiUrl = candidate;
        localStorage.setItem('lastWorkingApiBaseUrl', candidate);
        return candidate;
      }
    } catch (err) {
      // Try next candidate.
    }
  }
  const lastKnown = localStorage.getItem('lastWorkingApiBaseUrl');
  if (lastKnown) {
    apiUrl = lastKnown;
    return lastKnown;
  }
  return apiUrl;
}

const apiReady = resolveApiBaseUrl();

function getRequestCandidates() {
  const lastKnown = localStorage.getItem('lastWorkingApiBaseUrl');
  return [...new Set([apiUrl, ...buildApiCandidates(), lastKnown].filter(Boolean))];
}

async function requestAcrossCandidates(path, options = {}) {
  let lastError = null;
  for (const candidate of getRequestCandidates()) {
    try {
      const response = await fetchWithTimeout(candidate + path, options, 8000);
      apiUrl = candidate;
      localStorage.setItem('lastWorkingApiBaseUrl', candidate);
      return response;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('Backend unreachable');
}

async function apiRequest(path, options = {}) {
  await apiReady;
  const response = await requestAcrossCandidates(path, options);
  if (!response || !response.ok) {
    throw new Error(`Backend error: ${response ? response.status : 'unreachable'}`);
  }
  return response.json();
}

function bindSideMenu() {
  const menuToggle = document.getElementById('menuToggle');
  const sideMenu = document.getElementById('sideMenu');
  const menuBackdrop = document.getElementById('menuBackdrop');
  const closeMenuBtn = document.getElementById('closeMenuBtn');
  if (!menuToggle || !sideMenu || !menuBackdrop) return;

  const openMenu = () => {
    sideMenu.classList.add('open');
    menuBackdrop.classList.add('show');
    document.body.classList.add('menu-open');
  };

  const closeMenu = () => {
    sideMenu.classList.remove('open');
    menuBackdrop.classList.remove('show');
    document.body.classList.remove('menu-open');
  };

  menuToggle.onclick = openMenu;
  menuBackdrop.onclick = closeMenu;
  if (closeMenuBtn) closeMenuBtn.onclick = closeMenu;

  sideMenu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      if (link.dataset.action === 'logout') {
        localStorage.clear();
      }
      closeMenu();
    });
  });
}

bindSideMenu();

// Auth form logic
if (document.getElementById('authForm')) {
  const form = document.getElementById('authForm');
  const loginBtn = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');
  const message = document.getElementById('message');

  loginBtn.onclick = async (e) => {
    e.preventDefault();
    const email = form.email.value;
    const password = form.password.value;
    message.textContent = '';
    try {
      const data = await apiRequest('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (data.success) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('name', data.name);
        window.location.href = 'dashboard.html';
      } else {
        message.textContent = data.message || 'Login failed';
      }
    } catch (err) {
      message.textContent = 'Cannot connect to backend. Check server and API URL.';
    }
  };

  registerBtn.onclick = async (e) => {
    e.preventDefault();
    const name = form.name.value;
    const email = form.email.value;
    const password = form.password.value;
    message.textContent = '';
    try {
      const data = await apiRequest('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      if (data.success) {
        message.style.color = '#2e7d32';
        message.textContent = 'Registration successful! Please login.';
        form.name.value = '';
        form.password.value = '';
        loginBtn.focus();
      } else {
        message.textContent = data.message || 'Registration failed';
      }
    } catch (err) {
      message.textContent = 'Cannot connect to backend. Check server and API URL.';
    }
  };
}

if (document.getElementById('userName')) {
  document.getElementById('userName').textContent = localStorage.getItem('name') || '';
  document.getElementById('logoutBtn').onclick = () => {
    localStorage.clear();
    window.location.href = 'index.html';
  };
  // Fetch points
  apiRequest('/points', {
    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
  })
    .then(data => {
      if (data.success) {
        document.getElementById('totalPoints').textContent = data.points;
      }
    })
    .catch(() => {
      document.getElementById('totalPoints').textContent = '0';
    });
  // Notification
  document.getElementById('notification').textContent = 'Recycle plastic today and earn points!';
}

// Add Waste logic
if (document.getElementById('wasteForm')) {
  const form = document.getElementById('wasteForm');
  const resultDiv = document.getElementById('wasteResult');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const item = form.item.value;
    resultDiv.textContent = '';
    try {
      const data = await apiRequest('/add-waste', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + localStorage.getItem('token')
        },
        body: JSON.stringify({ item })
      });
      if (data.success) {
        if (data.isRecyclable) {
          resultDiv.style.color = '#2e7d32';
          resultDiv.textContent = `Recyclable! +${data.points} points awarded.`;
        } else {
          resultDiv.style.color = '#c5352f';
          resultDiv.textContent = 'Not recyclable. No points awarded.';
        }
      } else {
        resultDiv.style.color = '#c5352f';
        resultDiv.textContent = data.message || 'Error adding waste.';
      }
    } catch (err) {
      resultDiv.style.color = '#c5352f';
      resultDiv.textContent = 'Cannot connect to backend. Check server and API URL.';
    }
    form.item.value = '';
  };
}

// History logic
if (document.getElementById('historyTable')) {
  const tbody = document.querySelector('#historyTable tbody');
  apiRequest('/history', {
    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
  })
    .then(data => {
      if (data.success && Array.isArray(data.history)) {
        tbody.innerHTML = '';
        data.history.forEach(row => {
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${row.item}</td><td>${row.points}</td><td>${new Date(row.date).toLocaleString()}</td>`;
          tbody.appendChild(tr);
        });
      }
    })
    .catch(() => {
      tbody.innerHTML = '<tr><td colspan="3">Cannot load history. Backend unavailable.</td></tr>';
    });
}

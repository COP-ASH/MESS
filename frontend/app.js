/**
 * ==========================================================================
 * Mess Management System - Core Frontend Script
 * ==========================================================================
 */

const BACKEND_BASE_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "http://localhost:5000"
  : "https://mess-rjcn.onrender.com";

// Global cache
let activeDistrictsList = [];
let currentBillsList = [];
let memberBillsList = [];

document.addEventListener('DOMContentLoaded', () => {
  console.log('>>> [INIT] Application initialized. Base URL:', BACKEND_BASE_URL);

  // Start Live Timezone Clock
  startLiveClock();

  // Setup Global Logout Buttons
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', logout);
  }

  // Determine current page and initialize scripts
  const path = window.location.pathname;
  const page = path.substring(path.lastIndexOf('/') + 1);

  // Route page actions
  if (document.getElementById('loginForm')) {
    checkLoggedInRedirect();
    initLoginPage();
  } else if (document.getElementById('registrationForm')) {
    checkLoggedInRedirect();
    initRegisterPage();
  } else if (page === 'admin-dashboard.html') {
    requireAuth('super_admin');
    initAdminDashboard();
  } else if (page === 'district-dashboard.html') {
    requireAuth('district_admin');
    initDistrictDashboard();
  } else if (page === 'personnel-dashboard.html') {
    requireAuth('user');
    initPersonnelDashboard();
  }
});

/* ==========================================================================
   Helper Functions (Auth & Routing)
   ========================================================================== */

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

function checkLoggedInRedirect() {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  if (token && userStr) {
    const user = JSON.parse(userStr);
    redirectToDashboard(user.role);
  }
}

function requireAuth(allowedRole) {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  if (!token || !userStr) {
    logout();
    return;
  }
  const user = JSON.parse(userStr);
  if (user.role !== allowedRole) {
    redirectToDashboard(user.role);
  }
}

function redirectToDashboard(role) {
  if (role === 'super_admin') {
    window.location.href = 'admin-dashboard.html';
  } else if (role === 'district_admin') {
    window.location.href = 'district-dashboard.html';
  } else {
    window.location.href = 'personnel-dashboard.html';
  }
}

function startLiveClock() {
  const timeEl = document.getElementById('currentTimeDisplay');
  if (!timeEl) return;

  const updateTime = () => {
    const now = new Date();
    const options = {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    };
    let formatted = now.toLocaleDateString('en-IN', options);
    formatted = formatted.toUpperCase();
    timeEl.innerText = `${formatted} (IST)`;
  };

  updateTime();
  setInterval(updateTime, 1000);
}

function showNotification(message, type = 'info', elementId = 'statusMessage', duration = 4000) {
  const statusMessage = document.getElementById(elementId);
  if (!statusMessage) return;

  statusMessage.className = `message message-${type}`;
  statusMessage.innerText = message;
  statusMessage.style.display = 'block';

  if (duration > 0) {
    setTimeout(() => {
      statusMessage.style.display = 'none';
    }, duration);
  }
}

function logout() {
  console.log('>>> [LOGOUT] Terminating session.');
  const refreshToken = localStorage.getItem('refreshToken');
  if (refreshToken) {
    fetch(`${BACKEND_BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    }).catch(err => console.error('Logout error:', err));
  }
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  window.location.href = 'login.html';
}

// Switch tabs globally
function switchTab(tabId) {
  // Hide all tab contents
  const contents = document.querySelectorAll('.tab-content');
  contents.forEach(c => c.classList.remove('active'));

  // Remove active class from buttons
  const buttons = document.querySelectorAll('.tab-btn');
  buttons.forEach(b => b.classList.remove('active'));

  // Activate selected tab content
  document.getElementById(tabId).classList.add('active');

  // Activate selected tab button
  // Find button calling this function
  const activeBtn = Array.from(buttons).find(b => b.getAttribute('onclick').includes(tabId));
  if (activeBtn) activeBtn.classList.add('active');
}

/* ==========================================================================
   Voice Dictation Speech API helper
   ========================================================================== */

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const isSpeechSupported = !!SpeechRecognition;

function setupVoiceField(buttonId, inputId) {
  const btn = document.getElementById(buttonId);
  const input = document.getElementById(inputId);

  if (!btn || !input) return;

  if (!isSpeechSupported) {
    btn.style.display = 'none';
    console.warn(`[Speech API] Dictation not supported in browser for #${inputId}`);
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.lang = 'en-IN';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    if (btn.classList.contains('listening')) {
      recognition.stop();
      return;
    }

    btn.classList.add('listening');
    showNotification('Listening (Speak Name Clearly)...', 'info', 'statusMessage', 2000);

    try {
      recognition.start();
    } catch (err) {
      console.error('Speech API Start Error:', err);
      btn.classList.remove('listening');
    }
  });

  recognition.onresult = (event) => {
    let transcript = event.results[0][0].transcript;
    console.log(`[Speech API] Recorded: ${transcript}`);

    if (transcript.endsWith('.')) {
      transcript = transcript.slice(0, -1);
    }

    input.value = transcript.toUpperCase();
    showNotification(`Recorded: "${transcript}"`, 'success', 'statusMessage', 2000);
  };

  recognition.onerror = (event) => {
    console.error(`[Speech API] Error:`, event.error);
    btn.classList.remove('listening');
    showNotification(`Voice input error: ${event.error}`, 'error');
  };

  recognition.onend = () => {
    btn.classList.remove('listening');
  };
}

/* ==========================================================================
   1. Secure Login Page (login.html)
   ========================================================================== */

function initLoginPage() {
  const form = document.getElementById('loginForm');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('inputEmail').value.trim();
    const password = document.getElementById('inputPassword').value.trim();

    const btn = document.getElementById('btnLogin');
    btn.disabled = true;
    btn.innerText = 'Authenticating Credentials...';

    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Login verification failed.');
      }

      // Save session info
      localStorage.setItem('token', data.data.token);
      localStorage.setItem('refreshToken', data.data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.data.user));

      showNotification('Success! Opening portal...', 'success');

      setTimeout(() => {
        redirectToDashboard(data.data.user.role);
      }, 1000);

    } catch (err) {
      showNotification(err.message, 'error');
      btn.disabled = false;
      btn.innerText = 'Log In Securely';
    }
  });

  // Password reset flow triggers
  const resetOverlay = document.getElementById('resetOverlay');
  const linkForgot = document.getElementById('linkForgotPassword');
  const btnCancelReset = document.getElementById('btnCancelReset');

  if (linkForgot && resetOverlay) {
    linkForgot.addEventListener('click', (e) => {
      e.preventDefault();
      resetOverlay.classList.add('active');
      document.getElementById('forgotForm').style.display = 'block';
      document.getElementById('resetConfirmForm').style.display = 'none';
    });

    btnCancelReset.addEventListener('click', () => {
      resetOverlay.classList.remove('active');
    });
  }

  // Handle forgot form OTP request
  const forgotForm = document.getElementById('forgotForm');
  forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgotEmail').value.trim();
    const btn = document.getElementById('btnSendResetOtp');
    btn.disabled = true;

    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Request failed.');

      showNotification('Recovery code sent to email.', 'success', 'resetStatusMessage');
      forgotForm.style.display = 'none';
      document.getElementById('resetConfirmForm').style.display = 'block';
    } catch (err) {
      showNotification(err.message, 'error', 'resetStatusMessage');
    } finally {
      btn.disabled = false;
    }
  });

  // Handle reset confirm form submit
  const resetConfirmForm = document.getElementById('resetConfirmForm');
  resetConfirmForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgotEmail').value.trim();
    const otp = document.getElementById('resetOtp').value.trim();
    const newPassword = document.getElementById('resetNewPassword').value.trim();
    const btn = document.getElementById('btnConfirmReset');
    btn.disabled = true;

    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword })
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Reset failed.');

      showNotification('Password updated successfully. Login with your new password.', 'success', 'resetStatusMessage');
      setTimeout(() => {
        resetOverlay.classList.remove('active');
      }, 2000);
    } catch (err) {
      showNotification(err.message, 'error', 'resetStatusMessage');
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('btnBackToForgot').addEventListener('click', () => {
    forgotForm.style.display = 'block';
    resetConfirmForm.style.display = 'none';
  });
}

/* ==========================================================================
   2. Personnel Registration Page (register.html)
   ========================================================================== */

function initRegisterPage() {
  setupVoiceField('btnMicName', 'inputName');

  // Load active districts dynamically
  const selectDistrict = document.getElementById('selectDistrict');

  const loadDistricts = async () => {
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/districts/public`);
      const data = await response.json();
      if (response.ok) {
        selectDistrict.innerHTML = '<option value="" disabled selected>Select Mess / District</option>';
        data.data.forEach(d => {
          selectDistrict.innerHTML += `<option value="${d.id}">${d.districtName} (${d.districtCode})</option>`;
        });
      }
    } catch (err) {
      console.error('Failed to load active districts:', err);
      selectDistrict.innerHTML = '<option value="" disabled>Failed to load districts. Refresh page.</option>';
    }
  };

  loadDistricts();

  // Send OTP
  const btnSendOtp = document.getElementById('btnSendOtp');
  const otpSection = document.getElementById('otpSection');
  const emailInput = document.getElementById('inputEmail');

  btnSendOtp.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    if (!email) {
      showNotification('Please enter a valid email address first.', 'error');
      return;
    }

    btnSendOtp.disabled = true;
    btnSendOtp.innerText = 'Sending...';

    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/auth/otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to dispatch OTP.');
      }

      showNotification('Verification OTP sent. Check your email inbox.', 'success', 'statusMessage', 15000);
      otpSection.style.display = 'block';
      emailInput.disabled = true;
    } catch (err) {
      showNotification(err.message, 'error');
    } finally {
      btnSendOtp.disabled = false;
      btnSendOtp.innerText = 'Get OTP';
    }
  });

  // Submit registration form
  const form = document.getElementById('registrationForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fullName = document.getElementById('inputName').value.trim();
    const email = emailInput.value.trim();
    const districtId = parseInt(selectDistrict.value);
    const password = document.getElementById('inputPassword').value.trim();
    const otp = document.getElementById('inputOtp').value.trim();

    if (!fullName || !email || !districtId || !password || !otp) {
      showNotification('Please complete all form fields.', 'error');
      return;
    }

    const btn = document.getElementById('btnRegister');
    btn.disabled = true;
    btn.innerText = 'Verifying Record...';

    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, password, districtId, otp })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Registration failed.');
      }

      showNotification('Account verified and created successfully! Redirecting to login...', 'success');
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 2000);
    } catch (err) {
      showNotification(err.message, 'error');
      btn.disabled = false;
      btn.innerText = 'Verify OTP & Submit Record';
    }
  });
}

/* ==========================================================================
   3. Super Admin Dashboard (admin-dashboard.html)
   ========================================================================== */

function initAdminDashboard() {
  const user = JSON.parse(localStorage.getItem('user'));
  document.getElementById('userGreeting').innerText = `Welcome, Super Admin | ${user.fullName}`;

  // Initial load
  loadDashboardAnalytics();
  loadDistrictsTable();
  loadAdminsTable();
  loadUsersTable();
  loadAuditLogs();
  loadDistrictListForAdminsSelect();

  // Search User binding
  document.getElementById('btnSearchUser').addEventListener('click', () => {
    const q = document.getElementById('searchUserInput').value.trim();
    loadUsersTable(q);
  });

  // Settings form binding
  loadSettings();
  const settingsForm = document.getElementById('settingsForm');
  settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const website_name = document.getElementById('settingWebsiteName').value;
    const otp_expiry_minutes = document.getElementById('settingOtpExpiry').value;
    const email_sender = document.getElementById('settingEmailSender').value;
    const allowed_emails = document.getElementById('settingAllowedEmails').value;

    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/settings`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ website_name, otp_expiry_minutes, email_sender, allowed_emails })
      });
      if (response.ok) {
        showNotification('Settings configurations updated.', 'success');
      } else {
        const d = await response.json();
        throw new Error(d.error || 'Failed to update settings.');
      }
    } catch (err) {
      showNotification(err.message, 'error');
    }
  });

  // District Form binding
  const distForm = document.getElementById('districtForm');
  distForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('districtFormId').value;
    const districtName = document.getElementById('inputDistrictName').value.trim();
    const districtCode = document.getElementById('inputDistrictCode').value.trim();
    const status = document.getElementById('selectDistrictStatus').value;

    const url = id ? `${BACKEND_BASE_URL}/api/districts/${id}` : `${BACKEND_BASE_URL}/api/districts`;
    const method = id ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify({ districtName, districtCode, status })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save district.');

      showNotification('District saved successfully.', 'success');
      closeDistrictModal();
      loadDistrictsTable();
      loadDashboardAnalytics();
      loadDistrictListForAdminsSelect();
    } catch (err) {
      showNotification(err.message, 'error');
    }
  });

  // District Admin Form binding
  const adminForm = document.getElementById('adminForm');
  adminForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fullName = document.getElementById('adminFullName').value.trim();
    const email = document.getElementById('adminEmail').value.trim();
    const password = document.getElementById('adminPassword').value.trim();
    const districtId = parseInt(document.getElementById('adminDistrictId').value);
    const role = 'district_admin';

    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/users`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ fullName, email, password, districtId, role })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create admin account.');

      showNotification('District Admin account created & assigned successfully.', 'success');
      closeAdminModal();
      loadAdminsTable();
      loadDistrictsTable(); // Recalculate assigned admin list
    } catch (err) {
      showNotification(err.message, 'error');
    }
  });

  // Edit User Form binding
  const userEditForm = document.getElementById('userEditForm');
  userEditForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editUserId').value;
    const fullName = document.getElementById('editFullName').value.trim();
    const email = document.getElementById('editEmail').value.trim();
    const districtIdVal = document.getElementById('editDistrictId').value;
    const districtId = districtIdVal ? parseInt(districtIdVal) : null;
    const status = document.getElementById('selectUserStatus').value;
    const isActive = status === 'active';

    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/users/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ fullName, email, districtId, isActive })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update user.');

      showNotification('User profile settings updated.', 'success');
      closeUserEditModal();
      loadUsersTable();
      loadAdminsTable(); // Might have changed admin district
      loadDistrictsTable();
    } catch (err) {
      showNotification(err.message, 'error');
    }
  });
}

// Global analytics loader for Super Admin
let userDistributionChartInstance = null;
let dailyRegsChartInstance = null;

async function loadDashboardAnalytics() {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/dashboard`, { headers: getAuthHeaders() });
    const resData = await response.json();
    if (!response.ok) throw new Error(resData.error);

    const data = resData.data;

    // Compile widgets
    document.getElementById('statTotalDistricts').innerText = data.totalDistricts;
    document.getElementById('statActiveDistricts').innerText = data.activeDistricts;
    document.getElementById('statInactiveDistricts').innerText = data.inactiveDistricts;
    document.getElementById('statTotalUsers').innerText = data.totalUsers;

    // Load node health stats
    document.getElementById('healthDb').className = `badge badge-${data.systemHealth.database === 'healthy' ? 'success' : 'danger'}`;
    document.getElementById('healthDb').innerText = data.systemHealth.database === 'healthy' ? 'Connected' : 'Offline';
    document.getElementById('healthUptime').innerText = `${Math.floor(data.systemHealth.uptime)} seconds`;
    document.getElementById('healthMemory').innerText = `${(data.systemHealth.memoryUsage / 1024 / 1024).toFixed(2)} MB`;

    // Render Charts
    // 1. User distribution by district
    const distLabels = data.usersByDistrict.map(item => item.districtName || 'Unassigned');
    const distCounts = data.usersByDistrict.map(item => parseInt(item.count));

    if (userDistributionChartInstance) userDistributionChartInstance.destroy();
    const ctx1 = document.getElementById('chartUserDistribution').getContext('2d');
    userDistributionChartInstance = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: distLabels,
        datasets: [{
          label: 'Mess Personnel Counts',
          data: distCounts,
          backgroundColor: '#6366f1',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', precision: 0, stepSize: 1 } },
          x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
        }
      }
    });

    // 2. Daily registrations (last 30 days)
    const regDates = data.dailyRegistrations.map(item => item.date.split('T')[0]);
    const regCounts = data.dailyRegistrations.map(item => parseInt(item.count));

    if (dailyRegsChartInstance) dailyRegsChartInstance.destroy();
    const ctx2 = document.getElementById('chartDailyRegistrations').getContext('2d');
    dailyRegsChartInstance = new Chart(ctx2, {
      type: 'line',
      data: {
        labels: regDates,
        datasets: [{
          label: 'Registrations',
          data: regCounts,
          borderColor: '#ec4899',
          backgroundColor: 'rgba(236,72,153,0.1)',
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', precision: 0, stepSize: 1 } },
          x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
        }
      }
    });

  } catch (err) {
    console.error('Error compiling analytics:', err);
  }
}

// Districts CRUD ops
async function loadDistrictsTable() {
  const tbody = document.getElementById('districtsTableBody');
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/districts`, { headers: getAuthHeaders() });
    const data = await response.json();
    if (response.ok) {
      activeDistrictsList = data.data; // Save to global cache
      tbody.innerHTML = '';
      data.data.forEach(d => {
        const badgeClass = d.status === 'active' ? 'success' : 'danger';
        tbody.innerHTML += `
          <tr>
            <td>${d.id}</td>
            <td><strong>${d.districtName}</strong></td>
            <td><code style="background: rgba(255,255,255,0.05); padding: 0.2rem 0.5rem; border-radius: 4px;">${d.districtCode}</code></td>
            <td>${d.adminName || '<span style="color: var(--text-muted);">None Assigned</span>'}</td>
            <td><span class="badge badge-${badgeClass}">${d.status}</span></td>
            <td>
              <button class="btn btn-accent" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; margin-right: 0.25rem;" onclick="editDistrict(${d.id}, '${d.districtName}', '${d.districtCode}', '${d.status}')">Edit</button>
              <button class="btn btn-danger" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="deleteDistrict(${d.id})">Delete</button>
            </td>
          </tr>
        `;
      });
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--error);">Error loading districts list.</td></tr>';
  }
}

// Districts Add/Edit Modal
function openDistrictModal(id = '', name = '', code = '', status = 'active') {
  document.getElementById('districtFormId').value = id;
  document.getElementById('inputDistrictName').value = name;
  document.getElementById('inputDistrictCode').value = code;
  document.getElementById('selectDistrictStatus').value = status;
  document.getElementById('districtModalTitle').innerText = id ? 'Edit District' : 'Create New District';
  document.getElementById('districtOverlay').classList.add('active');
}

function closeDistrictModal() {
  document.getElementById('districtOverlay').classList.remove('active');
}

function editDistrict(id, name, code, status) {
  openDistrictModal(id, name, code, status);
}

async function deleteDistrict(id) {
  if (!confirm('Are you sure you want to delete this district? This action cannot be undone.')) return;
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/districts/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const data = await response.json();
    if (response.ok) {
      showNotification('District deleted successfully.', 'success');
      loadDistrictsTable();
      loadDashboardAnalytics();
      loadDistrictListForAdminsSelect();
    } else {
      throw new Error(data.error);
    }
  } catch (err) {
    showNotification(err.message, 'error');
  }
}

// Load district options inside admin select dropdowns
async function loadDistrictListForAdminsSelect() {
  const select = document.getElementById('adminDistrictId');
  const selectEditUser = document.getElementById('editDistrictId');

  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/districts`, { headers: getAuthHeaders() });
    const data = await response.json();
    if (response.ok) {
      select.innerHTML = '<option value="" disabled selected>Select District</option>';
      selectEditUser.innerHTML = '<option value="">No District (Super Admin)</option>';
      data.data.forEach(d => {
        if (d.status === 'active') {
          select.innerHTML += `<option value="${d.id}">${d.districtName}</option>`;
        }
        selectEditUser.innerHTML += `<option value="${d.id}">${d.districtName}</option>`;
      });
    }
  } catch (err) {
    console.error('Failed to load admin select options:', err);
  }
}

// District Admins List
async function loadAdminsTable() {
  const tbody = document.getElementById('adminsTableBody');
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/users`, { headers: getAuthHeaders() });
    const data = await response.json();
    if (response.ok) {
      tbody.innerHTML = '';
      const admins = data.data.filter(u => u.role === 'district_admin');
      if (admins.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-secondary);">No district admins created yet.</td></tr>';
        return;
      }
      admins.forEach(a => {
        const badgeClass = a.isActive ? 'success' : 'danger';
        tbody.innerHTML += `
          <tr>
            <td>${a.id}</td>
            <td><strong>${a.fullName}</strong></td>
            <td>${a.email}</td>
            <td>${a.districtName || '<span style="color: var(--warning);">Not Assigned</span>'}</td>
            <td><span class="badge badge-${badgeClass}">${a.isActive ? 'Active' : 'Deactivated'}</span></td>
            <td>
              <button class="btn btn-accent" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; margin-right: 0.25rem;" onclick="editUser(${a.id}, '${a.fullName}', '${a.email}', '${a.districtId || ''}', ${a.isActive})">Edit / Reassign</button>
              <button class="btn btn-danger" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="deleteUser(${a.id})">Delete</button>
            </td>
          </tr>
        `;
      });
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--error);">Error loading admins list.</td></tr>';
  }
}

function openAdminModal() {
  document.getElementById('adminForm').reset();
  document.getElementById('adminOverlay').classList.add('active');
}

function closeAdminModal() {
  document.getElementById('adminOverlay').classList.remove('active');
}

// Registered Users Management
async function loadUsersTable(searchQuery = '') {
  const tbody = document.getElementById('usersTableBody');
  const url = searchQuery
    ? `${BACKEND_BASE_URL}/api/users/search?q=${encodeURIComponent(searchQuery)}`
    : `${BACKEND_BASE_URL}/api/users`;

  try {
    const response = await fetch(url, { headers: getAuthHeaders() });
    const data = await response.json();
    if (response.ok) {
      tbody.innerHTML = '';

      const simpleUsers = data.data.filter(u => u.role !== 'super_admin');

      if (simpleUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-secondary);">No registered users found.</td></tr>';
        return;
      }

      simpleUsers.forEach(u => {
        const badgeClass = u.isActive ? 'success' : 'danger';
        tbody.innerHTML += `
          <tr>
            <td>${u.id}</td>
            <td><strong>${u.fullName}</strong></td>
            <td>${u.email}</td>
            <td><code style="background: rgba(255,255,255,0.05); padding: 0.2rem 0.5rem; border-radius: 4px;">${u.role}</code></td>
            <td>${u.districtName || 'None'}</td>
            <td>${u.isVerified ? '✅ Verified' : '❌ Pending'}</td>
            <td><span class="badge badge-${badgeClass}">${u.isActive ? 'Active' : 'Deactivated'}</span></td>
            <td>
              <button class="btn btn-accent" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; margin-right: 0.25rem;" onclick="editUser(${u.id}, '${u.fullName}', '${u.email}', '${u.districtId || ''}', ${u.isActive})">Edit</button>
              <button class="btn btn-danger" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="deleteUser(${u.id})">Delete</button>
            </td>
          </tr>
        `;
      });
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--error);">Error loading users database.</td></tr>';
  }
}

function editUser(id, fullName, email, districtId, isActive) {
  document.getElementById('editUserId').value = id;
  document.getElementById('editFullName').value = fullName;
  document.getElementById('editEmail').value = email;
  document.getElementById('editDistrictId').value = districtId;
  document.getElementById('selectUserStatus').value = isActive ? 'active' : 'inactive';
  document.getElementById('userEditOverlay').classList.add('active');
}

function closeUserEditModal() {
  document.getElementById('userEditOverlay').classList.remove('active');
}

async function deleteUser(id) {
  if (!confirm('Are you sure you want to delete this user account?')) return;
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/users/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (response.ok) {
      showNotification('User deleted successfully.', 'success');
      loadUsersTable();
      loadAdminsTable();
      loadDistrictsTable();
    } else {
      const d = await response.json();
      throw new Error(d.error);
    }
  } catch (err) {
    showNotification(err.message, 'error');
  }
}

// Load global whitelist configurations
async function loadSettings() {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/settings`, { headers: getAuthHeaders() });
    const resData = await response.json();
    if (response.ok) {
      const config = resData.data.configMap;
      document.getElementById('settingWebsiteName').value = config.website_name || '';
      document.getElementById('settingOtpExpiry').value = config.otp_expiry_minutes || '';
      document.getElementById('settingEmailSender').value = config.email_sender || '';
      document.getElementById('settingAllowedEmails').value = config.allowed_emails || '';
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

// Audit Logs loader
async function loadAuditLogs() {
  const tbody = document.getElementById('logsTableBody');
  if (!tbody) return;
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/reports?type=activity_logs`, { headers: getAuthHeaders() });
    const data = await response.json();
    if (response.ok) {
      tbody.innerHTML = '';
      if (data.data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-secondary);">No logs registered in system.</td></tr>';
        return;
      }
      data.data.forEach(log => {
        const timeStr = new Date(log.createdAt).toLocaleString();
        tbody.innerHTML += `
          <tr>
            <td>${log.id}</td>
            <td style="color: var(--text-secondary); font-size: 0.85rem;">${timeStr}</td>
            <td><strong>${log.userName || 'SYSTEM'}</strong> (${log.userEmail || 'system'})</td>
            <td><span class="badge badge-info">${log.action}</span></td>
            <td style="font-size: 0.9rem; color: var(--text-secondary);">${log.details || ''}</td>
          </tr>
        `;
      });
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--error);">Error loading system logs.</td></tr>';
  }
}


/* ==========================================================================
   4. District Admin Dashboard (district-dashboard.html)
   ========================================================================== */

function initDistrictDashboard() {
  const user = JSON.parse(localStorage.getItem('user'));
  document.getElementById('userGreeting').innerText = `Welcome, Admin | ${user.fullName}`;

  // Initialize Flatpickr date pickers
  if (typeof flatpickr !== 'undefined') {
    window.reportStartPicker = flatpickr("#reportStartDate", {
      dateFormat: "Y-m-d",
      altInput: true,
      altFormat: "d-m-Y",
      placeholder: "Select Start Date"
    });
    window.reportEndPicker = flatpickr("#reportEndDate", {
      dateFormat: "Y-m-d",
      altInput: true,
      altFormat: "d-m-Y",
      placeholder: "Select End Date"
    });
    window.summaryDatePicker = flatpickr("#attendanceSummaryDate", {
      dateFormat: "Y-m-d",
      altInput: true,
      altFormat: "d-m-Y",
      defaultDate: "today",
      maxDate: "today",
      onChange: function(selectedDates, dateStr) {
        if (dateStr) {
          loadAttendanceSummary(dateStr);
        }
      }
    });
    window.adminAttendancePicker = flatpickr("#adminAttendanceDate", {
      dateFormat: "Y-m-d",
      altInput: true,
      altFormat: "d-m-Y",
      maxDate: "today",
      onChange: function(selectedDates, dateStr) {
        const userId = document.getElementById('attendanceUserId').value;
        if (userId && dateStr) {
          fetchAndSetAdminAttendance(userId, dateStr);
        }
      }
    });
  }

  loadDistrictDashboardStats();
  loadDistrictUsersTable();
  loadDistrictNoticesTable();

  // Search member input
  document.getElementById('btnSearchUser').addEventListener('click', () => {
    const q = document.getElementById('searchUserInput').value.trim();
    loadDistrictUsersTable(q);
  });

  // Create member account
  const createUserForm = document.getElementById('createUserForm');
  createUserForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fullName = document.getElementById('memberFullName').value.trim();
    const email = document.getElementById('memberEmail').value.trim();
    const password = document.getElementById('memberPassword').value.trim();

    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/users`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ fullName, email, password, role: 'user' })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to add member.');

      showNotification('Mess member registered successfully.', 'success');
      closeCreateUserModal();
      loadDistrictUsersTable();
      loadDistrictDashboardStats();
    } catch (err) {
      showNotification(err.message, 'error');
    }
  });

  // Edit user form
  const editUserForm = document.getElementById('editUserForm');
  editUserForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editUserId').value;
    const fullName = document.getElementById('editFullName').value.trim();
    const email = document.getElementById('editEmail').value.trim();
    const status = document.getElementById('selectUserStatus').value;
    const isActive = status === 'active';

    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/users/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ fullName, email, isActive })
      });
      if (response.ok) {
        showNotification('Member settings updated.', 'success');
        closeEditUserModal();
        loadDistrictUsersTable();
        loadDistrictDashboardStats();
      } else {
        const d = await response.json();
        throw new Error(d.error);
      }
    } catch (err) {
      showNotification(err.message, 'error');
    }
  });

  // Post Notice Board Notice
  const noticeForm = document.getElementById('noticeForm');
  noticeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('inputNoticeTitle').value.trim();
    const content = document.getElementById('inputNoticeContent').value.trim();

    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/notifications`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ title, content })
      });
      if (response.ok) {
        showNotification('Notice announcement published.', 'success');
        closeNoticeModal();
        loadDistrictNoticesTable();
      } else {
        const d = await response.json();
        throw new Error(d.error);
      }
    } catch (err) {
      showNotification(err.message, 'error');
    }
  });

  // Reports generator binding
  let generatedReportData = [];
  const reportForm = document.getElementById('reportForm');
  reportForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = document.getElementById('selectReportType').value;
    const startDate = document.getElementById('reportStartDate').value;
    const endDate = document.getElementById('reportEndDate').value;

    let url = `${BACKEND_BASE_URL}/api/reports?type=${type}`;
    if (startDate) url += `&startDate=${startDate}`;
    if (endDate) url += `&endDate=${endDate}`;

    try {
      const response = await fetch(url, { headers: getAuthHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      generatedReportData = data.data;
      document.getElementById('reportSummaryText').innerText = `Successfully compiled ${generatedReportData.length} records. Ready to download as CSV spreadsheet.`;
      document.getElementById('reportSummaryPanel').style.display = 'block';
    } catch (err) {
      showNotification(err.message, 'error');
    }
  });

  document.getElementById('btnDownloadCsv').addEventListener('click', () => {
    if (generatedReportData.length === 0) return;
    const type = document.getElementById('selectReportType').value;
    downloadCSV(generatedReportData, `${type}_report_${new Date().toISOString().split('T')[0]}.csv`, type);
  });

  // Password update form
  const passForm = document.getElementById('passwordChangeForm');
  passForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('inputCurrentPassword').value;
    const newPassword = document.getElementById('inputNewPassword').value;

    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/profile/change-password`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await response.json();
      if (response.ok) {
        showNotification('Password updated successfully.', 'success');
        passForm.reset();
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      showNotification(err.message, 'error');
    }
  });

  // Load and initialize Menu Management
  loadAdminMenuTable();

  // Load and initialize Attendance Summary
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (window.summaryDatePicker) {
    window.summaryDatePicker.setDate(todayStr);
  } else {
    document.getElementById('attendanceSummaryDate').value = todayStr;
  }
  loadAttendanceSummary(todayStr);

  // Load and initialize Rates & Bills
  loadMealRates();
  loadBillsTable();

  // Admin Attendance Modal listeners
  document.getElementById('adminAttendanceDate').addEventListener('change', (e) => {
    const userId = document.getElementById('attendanceUserId').value;
    const selectedDate = e.target.value;
    if (userId && selectedDate) {
      fetchAndSetAdminAttendance(userId, selectedDate);
    }
  });

  // Mutual exclusion logic for Morning checkboxes
  const morningCheckboxes = [
    document.getElementById('adminAttendMorningNormal'),
    document.getElementById('adminAttendMorningHalfSpecial'),
    document.getElementById('adminAttendMorningFullSpecial')
  ];
  morningCheckboxes.forEach(chk => {
    if (chk) {
      chk.addEventListener('change', () => {
        if (chk.checked) {
          morningCheckboxes.forEach(other => {
            if (other !== chk) other.checked = false;
          });
        }
      });
    }
  });

  // Mutual exclusion logic for Evening checkboxes
  const eveningCheckboxes = [
    document.getElementById('adminAttendEveningNormal'),
    document.getElementById('adminAttendEveningHalfSpecial'),
    document.getElementById('adminAttendEveningFullSpecial')
  ];
  eveningCheckboxes.forEach(chk => {
    if (chk) {
      chk.addEventListener('change', () => {
        if (chk.checked) {
          eveningCheckboxes.forEach(other => {
            if (other !== chk) other.checked = false;
          });
        }
      });
    }
  });

  document.getElementById('adminAttendanceForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = document.getElementById('attendanceUserId').value;
    const date = document.getElementById('adminAttendanceDate').value;
    const morningNormal = document.getElementById('adminAttendMorningNormal').checked;
    const morningHalfSpecial = document.getElementById('adminAttendMorningHalfSpecial').checked;
    const morningFullSpecial = document.getElementById('adminAttendMorningFullSpecial').checked;
    const eveningNormal = document.getElementById('adminAttendEveningNormal').checked;
    const eveningHalfSpecial = document.getElementById('adminAttendEveningHalfSpecial').checked;
    const eveningFullSpecial = document.getElementById('adminAttendEveningFullSpecial').checked;

    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/attendance`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ userId, date, morningNormal, morningHalfSpecial, morningFullSpecial, eveningNormal, eveningHalfSpecial, eveningFullSpecial })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to submit attendance.');
      showNotification('Meal attendance updated successfully!', 'success');
      closeMarkAttendanceModal();

      const summaryDate = document.getElementById('attendanceSummaryDate').value;
      if (summaryDate) {
        loadAttendanceSummary(summaryDate);
      }
    } catch (err) {
      showNotification(err.message, 'error');
    }
  });

  // Update rates submit handler
  document.getElementById('ratesForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const normalDiet = parseFloat(document.getElementById('rateNormalDiet').value);
    const halfSpecialDiet = parseFloat(document.getElementById('rateHalfSpecialDiet').value);
    const fullSpecialDiet = parseFloat(document.getElementById('rateFullSpecialDiet').value);
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/bills/rates`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ normalDiet, halfSpecialDiet, fullSpecialDiet })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update rates.');
      showNotification('Meal cost rates updated successfully.', 'success');
    } catch (err) {
      showNotification(err.message, 'error');
    }
  });

  // Update cutoff settings submit handler
  const cutoffForm = document.getElementById('cutoffSettingsForm');
  if (cutoffForm) {
    cutoffForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const morningCutoff = document.getElementById('rateMorningCutoff').value;
      const eveningCutoff = document.getElementById('rateEveningCutoff').value;
      const user = JSON.parse(localStorage.getItem('user'));
      
      try {
        const response = await fetch(`${BACKEND_BASE_URL}/api/districts/${user.districtId}/cutoff`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ morningCutoff, eveningCutoff })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to update cutoff times.');
        showNotification('District Nil Diet cutoff settings updated successfully.', 'success');
      } catch (err) {
        showNotification(err.message, 'error');
      }
    });
  }

  // Generate monthly bills submit handler
  document.getElementById('generateBillsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const month = parseInt(document.getElementById('billMonth').value);
    const year = parseInt(document.getElementById('billYear').value);
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/bills/generate`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ month, year })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to generate bills.');
      showNotification(data.message || 'Bills generated successfully.', 'success');
      loadBillsTable();
    } catch (err) {
      showNotification(err.message, 'error');
    }
  });

  // Edit menu form submit handler
  document.getElementById('editMenuForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = parseInt(document.getElementById('editMenuDayId').value);
    const morningNormal = document.getElementById('editMenuMorningNormal').value.trim();
    const morningHalfSpecial = document.getElementById('editMenuMorningHalfSpecial').value.trim();
    const morningFullSpecial = document.getElementById('editMenuMorningFullSpecial').value.trim();
    const eveningNormal = document.getElementById('editMenuEveningNormal').value.trim();
    const eveningHalfSpecial = document.getElementById('editMenuEveningHalfSpecial').value.trim();
    const eveningFullSpecial = document.getElementById('editMenuEveningFullSpecial').value.trim();
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/menu/update`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id, morningNormal, morningHalfSpecial, morningFullSpecial, eveningNormal, eveningHalfSpecial, eveningFullSpecial })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update menu.');
      showNotification('Menu updated successfully.', 'success');
      closeEditMenuModal();
      loadAdminMenuTable();
    } catch (err) {
      showNotification(err.message, 'error');
    }
  });

  // Record payment form submit handler
  document.getElementById('recordPaymentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const billId = parseInt(document.getElementById('paymentBillId').value);
    const paymentMode = document.getElementById('paymentMode').value;
    const transactionId = document.getElementById('paymentTransactionId').value.trim();
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/bills/pay`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ billId, paymentMode, transactionId })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to record payment.');
      showNotification('Payment recorded successfully.', 'success');
      closeRecordPaymentModal();
      loadBillsTable();
    } catch (err) {
      showNotification(err.message, 'error');
    }
  });

  // Load Nil Diet Requests
  loadNilDietRequestsAdmin();
}

// District dashboard stats loaders
async function loadDistrictDashboardStats() {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/dashboard`, { headers: getAuthHeaders() });
    const resData = await response.json();
    if (response.ok) {
      const data = resData.data;

      document.getElementById('adminDistrictHeader').innerText = `👮 ${data.district.districtName} DISTRICT MESS`;
      document.getElementById('statDistrictName').innerText = data.district.districtName;
      document.getElementById('statDistrictCode').innerText = `Code: ${data.district.districtCode}`;
      document.getElementById('statTotalUsers').innerText = data.totalUsers;
      document.getElementById('statActiveUsers').innerText = data.activeUsers;
      document.getElementById('statInactiveUsers').innerText = data.inactiveUsers;

      if (document.getElementById('rateMorningCutoff')) {
        document.getElementById('rateMorningCutoff').value = data.district.morningCutoff || '20:00';
      }
      if (document.getElementById('rateEveningCutoff')) {
        document.getElementById('rateEveningCutoff').value = data.district.eveningCutoff || '12:00';
      }

      // Compile recent registrations
      const regsTbody = document.getElementById('recentRegsTableBody');
      regsTbody.innerHTML = '';
      if (data.recentRegistrations.length === 0) {
        regsTbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-secondary);">No recent registrations.</td></tr>';
      } else {
        data.recentRegistrations.forEach(r => {
          regsTbody.innerHTML += `
            <tr>
              <td><strong>${r.fullName}</strong></td>
              <td>${r.email}</td>
              <td><span class="badge badge-${r.isActive ? 'success' : 'danger'}">${r.isActive ? 'active' : 'inactive'}</span></td>
            </tr>
          `;
        });
      }


    }
  } catch (err) {
    console.error('Failed to load district summary:', err);
  }
}

// Scoped User CRUD table
async function loadDistrictUsersTable(searchTerm = '') {
  const tbody = document.getElementById('usersTableBody');
  const url = searchTerm
    ? `${BACKEND_BASE_URL}/api/users/search?q=${encodeURIComponent(searchTerm)}`
    : `${BACKEND_BASE_URL}/api/users`;

  try {
    const response = await fetch(url, { headers: getAuthHeaders() });
    const data = await response.json();
    if (response.ok) {
      tbody.innerHTML = '';

      const simpleUsers = data.data.filter(u => u.role === 'user');

      if (simpleUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-secondary);">No district members registered.</td></tr>';
        return;
      }

      simpleUsers.forEach(u => {
        const badgeClass = u.isActive ? 'success' : 'danger';
        const dateStr = new Date(u.createdAt).toLocaleDateString();
        tbody.innerHTML += `
          <tr>
            <td>${u.id}</td>
            <td><strong>${u.fullName}</strong></td>
            <td>${u.email}</td>
            <td>${u.isVerified ? '✅ Verified' : '❌ Pending'}</td>
            <td><span class="badge badge-${badgeClass}">${u.isActive ? 'Permitted' : 'Suspended'}</span></td>
            <td style="color: var(--text-secondary); font-size: 0.85rem;">${dateStr}</td>
            <td>
              <button class="btn btn-primary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; margin-right: 0.25rem;" onclick="openMarkAttendanceModal(${u.id}, '${u.fullName.replace(/'/g, "\\'")}')">Mark Attendance</button>
              <button class="btn btn-accent" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; margin-right: 0.25rem;" onclick="openEditUserModal(${u.id}, '${u.fullName.replace(/'/g, "\\'")}', '${u.email}', ${u.isActive})">Edit</button>
              <button class="btn btn-danger" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="deleteDistrictUser(${u.id})">Delete</button>
            </td>
          </tr>
        `;
      });
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--error);">Error loading members database.</td></tr>';
  }
}

// User CRUD overlays
function openCreateUserModal() {
  document.getElementById('createUserForm').reset();
  document.getElementById('createUserOverlay').classList.add('active');
}

function closeCreateUserModal() {
  document.getElementById('createUserOverlay').classList.remove('active');
}

function openEditUserModal(id, name, email, isActive) {
  document.getElementById('editUserId').value = id;
  document.getElementById('editFullName').value = name;
  document.getElementById('editEmail').value = email;
  document.getElementById('selectUserStatus').value = isActive ? 'active' : 'inactive';
  document.getElementById('editUserOverlay').classList.add('active');
}

function closeEditUserModal() {
  document.getElementById('editUserOverlay').classList.remove('active');
}

function openMarkAttendanceModal(userId, fullName) {
  document.getElementById('attendanceUserId').value = userId;
  document.getElementById('attendanceModalTitle').innerText = `Mark Attendance - ${fullName}`;

  // Default to today
  const todayDateObj = new Date();
  const today = `${todayDateObj.getFullYear()}-${String(todayDateObj.getMonth() + 1).padStart(2, '0')}-${String(todayDateObj.getDate()).padStart(2, '0')}`;
  const dateInput = document.getElementById('adminAttendanceDate');
  if (window.adminAttendancePicker) {
    window.adminAttendancePicker.setDate(today);
  } else {
    dateInput.value = today;
  }

  fetchAndSetAdminAttendance(userId, today);

  document.getElementById('markAttendanceOverlay').classList.add('active');
}

function closeMarkAttendanceModal() {
  document.getElementById('markAttendanceOverlay').classList.remove('active');
}

async function fetchAndSetAdminAttendance(userId, date) {
  const chkMorningNormal = document.getElementById('adminAttendMorningNormal');
  const chkMorningHalfSpecial = document.getElementById('adminAttendMorningHalfSpecial');
  const chkMorningFullSpecial = document.getElementById('adminAttendMorningFullSpecial');
  const chkEveningNormal = document.getElementById('adminAttendEveningNormal');
  const chkEveningHalfSpecial = document.getElementById('adminAttendEveningHalfSpecial');
  const chkEveningFullSpecial = document.getElementById('adminAttendEveningFullSpecial');
  const submitBtn = document.querySelector('#adminAttendanceForm button[type="submit"]');
  const warningDiv = document.getElementById('modalNilDietWarning');

  // Fetch Nil Diet requests to see if this user is excluded on the date
  let isMorningNil = false;
  let isEveningNil = false;
  try {
    const nilResponse = await fetch(`${BACKEND_BASE_URL}/api/nildiet`, { headers: getAuthHeaders() });
    if (nilResponse.ok) {
      const nilRequests = await nilResponse.json();
      const targetUserId = parseInt(userId);
      const matched = nilRequests.find(r => 
        r.userId === targetUserId && 
        r.status === 'approved' && 
        date >= r.fromDate.split('T')[0] && 
        date <= r.toDate.split('T')[0]
      );
      if (matched) {
        const nilStatus = checkNilStatusForDate(date, matched);
        isMorningNil = nilStatus.isMorning;
        isEveningNil = nilStatus.isEvening;
      }
    }
  } catch (err) {
    console.error('Error checking Nil request state:', err);
  }

  if (warningDiv) {
    if (isMorningNil && isEveningNil) {
      warningDiv.style.display = 'block';
      warningDiv.innerHTML = `<strong>🛑 Notice:</strong> This member has an approved Nil Diet request (both sessions) active for this date. Modifying attendance is locked.`;
    } else if (isMorningNil) {
      warningDiv.style.display = 'block';
      warningDiv.innerHTML = `<strong>🛑 Notice:</strong> This member has an approved Nil Diet request active for the Morning session. Morning attendance is locked.`;
    } else if (isEveningNil) {
      warningDiv.style.display = 'block';
      warningDiv.innerHTML = `<strong>🛑 Notice:</strong> This member has an approved Nil Diet request active for the Evening session. Evening attendance is locked.`;
    } else {
      warningDiv.style.display = 'none';
    }
  }

  if (submitBtn) {
    submitBtn.disabled = isMorningNil && isEveningNil;
  }

  // Clear or disable checkbox elements based on session-specific Nil exclusion
  [chkMorningNormal, chkMorningHalfSpecial, chkMorningFullSpecial].forEach(chk => {
    if (chk) {
      chk.disabled = isMorningNil;
      chk.checked = false;
    }
  });
  [chkEveningNormal, chkEveningHalfSpecial, chkEveningFullSpecial].forEach(chk => {
    if (chk) {
      chk.disabled = isEveningNil;
      chk.checked = false;
    }
  });

  if (isMorningNil && isEveningNil) return;

  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/attendance/member/${userId}`, { headers: getAuthHeaders() });
    if (response.ok) {
      const history = await response.json();
      const record = history.find(r => r.date.split('T')[0] === date);
      if (record) {
        if (chkMorningNormal && !isMorningNil) chkMorningNormal.checked = !!record.morningNormal;
        if (chkMorningHalfSpecial && !isMorningNil) chkMorningHalfSpecial.checked = !!record.morningHalfSpecial;
        if (chkMorningFullSpecial && !isMorningNil) chkMorningFullSpecial.checked = !!record.morningFullSpecial;
        if (chkEveningNormal && !isEveningNil) chkEveningNormal.checked = !!record.eveningNormal;
        if (chkEveningHalfSpecial && !isEveningNil) chkEveningHalfSpecial.checked = !!record.eveningHalfSpecial;
        if (chkEveningFullSpecial && !isEveningNil) chkEveningFullSpecial.checked = !!record.eveningFullSpecial;
      }
    }
  } catch (err) {
    console.error('Error fetching member attendance details:', err);
  }
}

async function deleteDistrictUser(id) {
  if (!confirm('Are you sure you want to delete this mess member account?')) return;
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/users/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (response.ok) {
      showNotification('Member deleted successfully.', 'success');
      loadDistrictUsersTable();
      loadDistrictDashboardStats();
    } else {
      const d = await response.json();
      throw new Error(d.error);
    }
  } catch (err) {
    showNotification(err.message, 'error');
  }
}

// District notices loaders
async function loadDistrictNoticesTable() {
  const tbody = document.getElementById('noticesTableBody');
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/notifications`, { headers: getAuthHeaders() });
    const data = await response.json();
    if (response.ok) {
      tbody.innerHTML = '';
      if (data.data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-secondary);">No notice announcements published.</td></tr>';
        return;
      }
      data.data.forEach(n => {
        tbody.innerHTML += `
          <tr>
            <td><strong>${n.title}</strong></td>
            <td style="font-size: 0.9rem; color: var(--text-secondary); max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${n.content}</td>
            <td>${n.postedByName}</td>
            <td style="font-size: 0.85rem; color: var(--text-secondary);">${new Date(n.createdAt).toLocaleDateString()}</td>
            <td>
              <button class="btn btn-danger" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="deleteNotice(${n.id})">Delete</button>
            </td>
          </tr>
        `;
      });
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--error);">Error loading announcements.</td></tr>';
  }
}

function openNoticeModal() {
  document.getElementById('noticeForm').reset();
  document.getElementById('noticeOverlay').classList.add('active');
}

function closeNoticeModal() {
  document.getElementById('noticeOverlay').classList.remove('active');
}

async function deleteNotice(id) {
  if (!confirm('Are you sure you want to remove this announcement notice?')) return;
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/notifications/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (response.ok) {
      showNotification('Notice deleted successfully.', 'success');
      loadDistrictNoticesTable();
    } else {
      const d = await response.json();
      throw new Error(d.error);
    }
  } catch (err) {
    showNotification(err.message, 'error');
  }
}


/* ==========================================================================
   5. Personnel/Simple User Dashboard (personnel-dashboard.html)
   ========================================================================== */

function initPersonnelDashboard() {
  const user = JSON.parse(localStorage.getItem('user'));
  document.getElementById('userGreeting').innerText = `Welcome, Member | ${user.fullName}`;

  // Initialize Flatpickr date pickers for Nil Diet range
  if (typeof flatpickr !== 'undefined') {
    flatpickr("#nilFromDate", {
      dateFormat: "Y-m-d",
      altInput: true,
      altFormat: "d-m-Y",
      placeholder: "Select Start Date"
    });
    flatpickr("#nilToDate", {
      dateFormat: "Y-m-d",
      altInput: true,
      altFormat: "d-m-Y",
      placeholder: "Select End Date"
    });
  }

  // Fill Edit Profile form with defaults
  document.getElementById('inputEmailStatic').value = user.email;
  document.getElementById('inputFullName').value = user.fullName;

  // Load district details & announcements notice boards
  loadMemberDistrictDetailsAndNotices();

  // Load Weekly Menu, Attendance, and Bills
  loadMemberMenuTable();
  loadMemberAttendanceHistory();
  loadMemberBillsTable();

  const btnFilter = document.getElementById('btnFilterMemberHistory');
  if (btnFilter) {
    btnFilter.addEventListener('click', () => {
      loadMemberAttendanceHistory();
    });
  }

  const selectMonth = document.getElementById('memberHistoryMonth');
  if (selectMonth) {
    selectMonth.addEventListener('change', () => {
      loadMemberAttendanceHistory();
    });
  }

  const inputYear = document.getElementById('memberHistoryYear');
  if (inputYear) {
    inputYear.addEventListener('input', () => {
      loadMemberAttendanceHistory();
    });
  }

  // Profile update submit
  const profileForm = document.getElementById('profileUpdateForm');
  profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fullName = document.getElementById('inputFullName').value.trim();

    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/profile`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ fullName })
      });
      const data = await response.json();
      if (response.ok) {
        showNotification('Profile updated successfully.', 'success');
        user.fullName = fullName;
        localStorage.setItem('user', JSON.stringify(user));
        document.getElementById('userGreeting').innerText = `Welcome, Member | ${fullName}`;
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      showNotification(err.message, 'error');
    }
  });

  // Password update submit
  const passForm = document.getElementById('passwordChangeForm');
  passForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('inputCurrentPassword').value;
    const newPassword = document.getElementById('inputNewPassword').value;

    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/profile/change-password`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await response.json();
      if (response.ok) {
        showNotification('Password updated successfully.', 'success');
        passForm.reset();
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      showNotification(err.message, 'error');
    }
  });

  // Nil diet request submit
  const nilDietForm = document.getElementById('nilDietForm');
  if (nilDietForm) {
    const nilFromDateInput = document.getElementById('nilFromDate');
    const nilToDateInput = document.getElementById('nilToDate');
    const nilFromMorning = document.getElementById('nilFromMorning');
    const nilFromEvening = document.getElementById('nilFromEvening');
    const nilToMorning = document.getElementById('nilToMorning');
    const nilToEvening = document.getElementById('nilToEvening');

    function syncSameDaySessions() {
      if (nilFromDateInput && nilToDateInput && nilFromDateInput.value === nilToDateInput.value && nilFromDateInput.value !== '') {
        nilToMorning.checked = nilFromMorning.checked;
        nilToEvening.checked = nilFromEvening.checked;
      }
    }

    if (nilFromMorning) nilFromMorning.addEventListener('change', syncSameDaySessions);
    if (nilFromEvening) nilFromEvening.addEventListener('change', syncSameDaySessions);
    if (nilToMorning) {
      nilToMorning.addEventListener('change', () => {
        if (nilFromDateInput && nilToDateInput && nilFromDateInput.value === nilToDateInput.value && nilFromDateInput.value !== '') {
          nilFromMorning.checked = nilToMorning.checked;
        }
      });
    }
    if (nilToEvening) {
      nilToEvening.addEventListener('change', () => {
        if (nilFromDateInput && nilToDateInput && nilFromDateInput.value === nilToDateInput.value && nilFromDateInput.value !== '') {
          nilFromEvening.checked = nilToEvening.checked;
        }
      });
    }
    if (nilFromDateInput) nilFromDateInput.addEventListener('change', syncSameDaySessions);
    if (nilToDateInput) nilToDateInput.addEventListener('change', syncSameDaySessions);

    nilDietForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fromDate = nilFromDateInput.value;
      const toDate = nilToDateInput.value;
      const fromMorning = nilFromMorning.checked;
      const fromEvening = nilFromEvening.checked;
      const toMorning = nilToMorning.checked;
      const toEvening = nilToEvening.checked;

      try {
        const response = await fetch(`${BACKEND_BASE_URL}/api/nildiet`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ fromDate, toDate, fromMorning, fromEvening, toMorning, toEvening })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to submit nil diet request.');

        showNotification('Nil diet request submitted successfully.', 'success');
        nilDietForm.reset();
        loadMemberNilDietRequests();
      } catch (err) {
        showNotification(err.message, 'error');
      }
    });
  }

  // Load Member Nil Diet requests history
  loadMemberNilDietRequests();
}

function checkNilStatusForDate(dateStr, request) {
  const date = dateStr;
  const start = request.fromDate.split('T')[0];
  const end = request.toDate.split('T')[0];

  // Fallback for legacy requests
  if (request.fromMorning === undefined || request.fromMorning === null) {
    if (date >= start && date <= end) {
      return { isMorning: !!request.morningDiet, isEvening: !!request.eveningDiet };
    }
    return { isMorning: false, isEvening: false };
  }

  if (date === start && date === end) {
    return { isMorning: !!request.fromMorning, isEvening: !!request.fromEvening };
  } else if (date === start) {
    return { isMorning: !!request.fromMorning, isEvening: !!request.fromEvening };
  } else if (date === end) {
    return { isMorning: !!request.toMorning, isEvening: !!request.toEvening };
  } else if (date > start && date < end) {
    return { isMorning: true, isEvening: true };
  }
  return { isMorning: false, isEvening: false };
}

function getEarliestAllowedNilDietDate() {
  return new Date();
}

// Scoped loader for simple user profile info
async function loadMemberDistrictDetailsAndNotices() {
  try {
    // 1. Fetch Dashboard summary containing user and district info
    const response = await fetch(`${BACKEND_BASE_URL}/api/dashboard`, { headers: getAuthHeaders() });
    const resData = await response.json();
    if (response.ok) {
      const dist = resData.data.district;
      if (dist) {
        document.getElementById('distNameText').innerText = dist.districtName;
        document.getElementById('distCodeText').innerText = dist.districtCode;

        const badge = document.getElementById('distStatusBadge');
        badge.className = `badge badge-${dist.status === 'active' ? 'success' : 'danger'}`;
        badge.innerText = dist.status;

        document.getElementById('distAdminName').innerText = dist.adminName || 'No Admin Assigned';
        document.getElementById('distAdminEmail').innerText = dist.adminEmail || '';

        // Populate cutoff labels in the Nil Diet request corner
        if (dist.morningCutoff) {
          const morningTime = dist.morningCutoff;
          const [h, m] = morningTime.split(':').map(Number);
          const morningDisplay = h >= 12 ? `${h === 12 ? 12 : h - 12}:${String(m).padStart(2, '0')} PM` : `${h === 0 ? 12 : h}:${String(m).padStart(2, '0')} AM`;
          const cutoffM = document.getElementById('cutoffNoticeMorning');
          if (cutoffM) cutoffM.innerText = morningDisplay;
        }
        if (dist.eveningCutoff) {
          const eveningTime = dist.eveningCutoff;
          const [h, m] = eveningTime.split(':').map(Number);
          const eveningDisplay = h >= 12 ? `${h === 12 ? 12 : h - 12}:${String(m).padStart(2, '0')} PM` : `${h === 0 ? 12 : h}:${String(m).padStart(2, '0')} AM`;
          const cutoffE = document.getElementById('cutoffNoticeEvening');
          if (cutoffE) cutoffE.innerText = eveningDisplay;
        }

        // Configure Flatpickr dynamically based on district morning cutoff settings
        if (dist.morningCutoff && typeof flatpickr !== 'undefined') {
          const earliestDate = getEarliestAllowedNilDietDate(dist.morningCutoff);
          flatpickr("#nilFromDate", {
            dateFormat: "Y-m-d",
            altInput: true,
            altFormat: "d-m-Y",
            minDate: earliestDate,
            placeholder: "Select Start Date"
          });
          flatpickr("#nilToDate", {
            dateFormat: "Y-m-d",
            altInput: true,
            altFormat: "d-m-Y",
            minDate: earliestDate,
            placeholder: "Select End Date"
          });
        }
      }
    }

    // 2. Fetch notice board notices
    const noticesRes = await fetch(`${BACKEND_BASE_URL}/api/notifications`, { headers: getAuthHeaders() });
    const noticesData = await noticesRes.json();
    if (noticesRes.ok) {
      const container = document.getElementById('noticesListContainer');
      container.innerHTML = '';

      if (noticesData.data.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center; margin-top: 1.5rem;">No notices or bulletins published.</p>';
        return;
      }

      noticesData.data.forEach(n => {
        container.innerHTML += `
          <div class="notice-card">
            <!-- Glowing accent decoration inside the card -->
            <div style="position: absolute; top: -50px; right: -50px; width: 120px; height: 120px; background: rgba(255, 74, 90, 0.12); filter: blur(30px); border-radius: 50%; pointer-events: none;"></div>
            
            <div style="display: flex; align-items: flex-start; gap: 1.1rem; position: relative; z-index: 2;">
              <!-- Megaphone Icon with Pulse ring -->
              <div class="notice-icon-pulse">
                <span style="font-size: 1.3rem; line-height: 1; animation: bellShake 2.5s infinite; transform-origin: top center; display: inline-block;">📢</span>
              </div>
              
              <div style="flex: 1;">
                <h4 style="font-family: 'Outfit', sans-serif; font-size: 1.15rem; font-weight: 700; margin-bottom: 0.5rem; color: #0f172a;">${n.title}</h4>
                <p style="font-size: 0.95rem; color: #334155; line-height: 1.6; margin-bottom: 0.85rem; font-family: 'Inter', sans-serif;">${n.content}</p>
                
                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: #64748b; border-top: 1px dashed rgba(29, 78, 216, 0.15); padding-top: 0.6rem; margin-top: 0.5rem;">
                  <span>Posted By: <strong style="color: var(--accent-color);">${n.postedByName}</strong></span>
                  <span>Date: ${new Date(n.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
              </div>
            </div>
          </div>
        `;
      });
    }
  } catch (err) {
    console.error('Failed to load member district summary notices:', err);
  }
}

/* ==========================================================================
   6. Export Reports helper: Generates dynamic CSV file triggers
   ========================================================================== */

function downloadCSV(data, filename, type) {
  if (data.length === 0) return;

  const csvRows = [];

  // Metadata headers for District reports
  const isDistrictReport = type === 'users' || type === 'activity_logs';
  if (isDistrictReport) {
    const districtName = document.getElementById('statDistrictName') ? document.getElementById('statDistrictName').innerText.trim() : 'N/A';
    const reportTitle = type === 'users' ? 'District Mess User Register' : 'District System Security Logs';
    const startDate = document.getElementById('reportStartDate') ? document.getElementById('reportStartDate').value : '';
    const endDate = document.getElementById('reportEndDate') ? document.getElementById('reportEndDate').value : '';

    csvRows.push(`District Name,"${districtName.replace(/"/g, '""')}"`);
    csvRows.push(`Report Name,"${reportTitle}"`);
    csvRows.push(`From Date,"${startDate || 'All'}"`);
    csvRows.push(`Till Date,"${endDate || 'All'}"`);

    if (type === 'users') {
      const rateNormal = document.getElementById('rateNormalDiet') ? document.getElementById('rateNormalDiet').value : '30.00';
      const rateHalf = document.getElementById('rateHalfSpecialDiet') ? document.getElementById('rateHalfSpecialDiet').value : '50.00';
      const rateFull = document.getElementById('rateFullSpecialDiet') ? document.getElementById('rateFullSpecialDiet').value : '50.00';

      csvRows.push(`NormalRate (Rs.),"${rateNormal}"`);
      csvRows.push(`HalfSpecialRate (Rs.),"${rateHalf}"`);
      csvRows.push(`FullSpecialRate (Rs.),"${rateFull}"`);
    }

    csvRows.push(''); // Blank line to separate metadata header from table data
  }

  const headers = Object.keys(data[0]);

  // Headers row
  csvRows.push(headers.join(','));

  // Data rows
  for (const row of data) {
    const values = headers.map(header => {
      const val = row[header];
      const escaped = ('' + (val === null || val === undefined ? '' : val)).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }

  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/* ==========================================================================
   District Admin Dashboard Helpers (Menu, Attendance, Bills)
   ========================================================================== */

async function loadAdminMenuTable() {
  const tbody = document.getElementById('adminMenuTableBody');
  if (!tbody) return;
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/menu`, { headers: getAuthHeaders() });
    const data = await response.json();
    if (response.ok) {
      tbody.innerHTML = '';
      data.forEach(m => {
        tbody.innerHTML += `
          <tr>
            <td><strong>${m.dayOfWeek}</strong></td>
            <td style="text-align: center;">${m.morningNormal}</td>
            <td style="text-align: center;">${m.eveningNormal}</td>
            <td style="text-align: center;">${m.morningHalfSpecial}</td>
            <td style="text-align: center;">${m.eveningHalfSpecial}</td>
            <td style="text-align: center;">${m.morningFullSpecial}</td>
            <td style="text-align: center;">${m.eveningFullSpecial}</td>
            <td>
              <button class="btn btn-accent" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="editMenu(${m.id}, '${m.dayOfWeek}', '${m.morningNormal.replace(/'/g, "\\'")}', '${m.morningHalfSpecial.replace(/'/g, "\\'")}', '${m.morningFullSpecial.replace(/'/g, "\\'")}', '${m.eveningNormal.replace(/'/g, "\\'")}', '${m.eveningHalfSpecial.replace(/'/g, "\\'")}', '${m.eveningFullSpecial.replace(/'/g, "\\'")}')">Edit</button>
            </td>
          </tr>
        `;
      });
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--error);">Error loading menu.</td></tr>';
  }
}

function editMenu(id, day, morningNormal, morningHalfSpecial, morningFullSpecial, eveningNormal, eveningHalfSpecial, eveningFullSpecial) {
  document.getElementById('editMenuDayId').value = id;
  document.getElementById('editMenuDayName').innerText = `Modify Menu for ${day}`;
  document.getElementById('editMenuMorningNormal').value = morningNormal;
  document.getElementById('editMenuMorningHalfSpecial').value = morningHalfSpecial;
  document.getElementById('editMenuMorningFullSpecial').value = morningFullSpecial;
  document.getElementById('editMenuEveningNormal').value = eveningNormal;
  document.getElementById('editMenuEveningHalfSpecial').value = eveningHalfSpecial;
  document.getElementById('editMenuEveningFullSpecial').value = eveningFullSpecial;
  document.getElementById('editMenuOverlay').classList.add('active');
}

function closeEditMenuModal() {
  document.getElementById('editMenuOverlay').classList.remove('active');
}

async function loadAttendanceSummary(date) {
  const tbody = document.getElementById('dailyAttendanceTableBody');
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/attendance/summary?date=${date}`, { headers: getAuthHeaders() });
    const data = await response.json();
    if (response.ok) {
      document.getElementById('countMorningNormal').innerText = data.morningNormal;
      document.getElementById('countMorningHalfSpecial').innerText = data.morningHalfSpecial;
      document.getElementById('countMorningFullSpecial').innerText = data.morningFullSpecial;
      document.getElementById('countEveningNormal').innerText = data.eveningNormal;
      document.getElementById('countEveningHalfSpecial').innerText = data.eveningHalfSpecial;
      document.getElementById('countEveningFullSpecial').innerText = data.eveningFullSpecial;
      document.getElementById('countTotalMeals').innerText = data.grandTotal;

      if (tbody) {
        tbody.innerHTML = '';
        if (!data.membersAttendance || data.membersAttendance.length === 0) {
          tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--text-secondary);">No district members registered.</td></tr>';
          return;
        }
        data.membersAttendance.forEach(m => {
          let colsHtml = '';
          let actionBtnHtml = '';

          const isMorningNil = m.isNilExcluded && m.nilMorning;
          const isEveningNil = m.isNilExcluded && m.nilEvening;

          const nilBadgeHtml = `<span class="badge" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #f87171; font-size: 0.75rem; font-weight: 600; padding: 0.15rem 0.5rem; border-radius: 4px;">NIL</span>`;

          const morningNormalStatus = isMorningNil 
            ? nilBadgeHtml 
            : (m.attendance.morningNormal ? '<span style="color: var(--success); font-weight: 600;">✅ Eaten</span>' : '<span style="color: var(--text-secondary);">❌ No</span>');
          
          const morningHalfSpecialStatus = isMorningNil 
            ? nilBadgeHtml 
            : (m.attendance.morningHalfSpecial ? '<span style="color: var(--success); font-weight: 600;">✅ Eaten</span>' : '<span style="color: var(--text-secondary);">❌ No</span>');
          
          const morningFullSpecialStatus = isMorningNil 
            ? nilBadgeHtml 
            : (m.attendance.morningFullSpecial ? '<span style="color: var(--success); font-weight: 600;">✅ Eaten</span>' : '<span style="color: var(--text-secondary);">❌ No</span>');

          const eveningNormalStatus = isEveningNil 
            ? nilBadgeHtml 
            : (m.attendance.eveningNormal ? '<span style="color: var(--success); font-weight: 600;">✅ Eaten</span>' : '<span style="color: var(--text-secondary);">❌ No</span>');
          
          const eveningHalfSpecialStatus = isEveningNil 
            ? nilBadgeHtml 
            : (m.attendance.eveningHalfSpecial ? '<span style="color: var(--success); font-weight: 600;">✅ Eaten</span>' : '<span style="color: var(--text-secondary);">❌ No</span>');
          
          const eveningFullSpecialStatus = isEveningNil 
            ? nilBadgeHtml 
            : (m.attendance.eveningFullSpecial ? '<span style="color: var(--success); font-weight: 600;">✅ Eaten</span>' : '<span style="color: var(--text-secondary);">❌ No</span>');

          colsHtml = `
            <td style="text-align: center;">${morningNormalStatus}</td>
            <td style="text-align: center;">${eveningNormalStatus}</td>
            <td style="text-align: center;">${morningHalfSpecialStatus}</td>
            <td style="text-align: center;">${eveningHalfSpecialStatus}</td>
            <td style="text-align: center;">${morningFullSpecialStatus}</td>
            <td style="text-align: center;">${eveningFullSpecialStatus}</td>
          `;

          if (isMorningNil && isEveningNil) {
            actionBtnHtml = `<button class="btn btn-accent" disabled style="opacity: 0.5; cursor: not-allowed; padding: 0.3rem 0.6rem; font-size: 0.8rem;">Locked (NIL)</button>`;
          } else {
            actionBtnHtml = `<button class="btn btn-primary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="openMarkAttendanceModalFromSummary(${m.userId}, '${m.fullName.replace(/'/g, "\\'")}', '${date}')">Manage</button>`;
          }

          tbody.innerHTML += `
            <tr ${m.isNilExcluded ? 'style="background: rgba(239, 68, 68, 0.02);"' : ''}>
              <td><strong>${m.fullName}</strong></td>
              <td>${m.email}</td>
              ${colsHtml}
              <td>
                ${actionBtnHtml}
              </td>
            </tr>
          `;
        });
      }
    }
  } catch (err) {
    console.error('Failed to load attendance summary:', err);
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--error);">Error loading attendance details.</td></tr>';
    }
  }
}

function openMarkAttendanceModalFromSummary(userId, fullName, date) {
  document.getElementById('attendanceUserId').value = userId;
  document.getElementById('attendanceModalTitle').innerText = `Mark Attendance - ${fullName}`;

  const dateInput = document.getElementById('adminAttendanceDate');
  if (window.adminAttendancePicker) {
    window.adminAttendancePicker.setDate(date);
  } else {
    dateInput.value = date;
  }

  fetchAndSetAdminAttendance(userId, date);

  document.getElementById('markAttendanceOverlay').classList.add('active');
}

async function loadMealRates() {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/bills/rates`, { headers: getAuthHeaders() });
    const data = await response.json();
    if (response.ok) {
      document.getElementById('rateNormalDiet').value = data.normalDiet;
      document.getElementById('rateHalfSpecialDiet').value = data.halfSpecialDiet;
      document.getElementById('rateFullSpecialDiet').value = data.fullSpecialDiet;
    }
  } catch (err) {
    console.error('Failed to load rates:', err);
  }
}

async function loadBillsTable() {
  const tbody = document.getElementById('billsTableBody');
  if (!tbody) return;
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/bills`, { headers: getAuthHeaders() });
    const data = await response.json();
    if (response.ok) {
      currentBillsList = data; // Store globally for filtering and exporting
      
      // Initialize filters only once
      if (!loadBillsTable.listenersInitialized) {
        const filterMonth = document.getElementById('filterBillMonth');
        const filterYear = document.getElementById('filterBillYear');
        const btnDownloadPdf = document.getElementById('btnDownloadMonthlyPdf');

        if (filterMonth) {
          filterMonth.addEventListener('change', filterAndRenderBillsTable);
        }
        if (filterYear) {
          filterYear.addEventListener('input', filterAndRenderBillsTable);
        }
        if (btnDownloadPdf) {
          btnDownloadPdf.addEventListener('click', downloadMonthlyPdf);
        }
        loadBillsTable.listenersInitialized = true;
      }

      filterAndRenderBillsTable();
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--error);">Error loading bills.</td></tr>';
  }
}

function recordPayment(billId) {
  document.getElementById('paymentBillId').value = billId;
  document.getElementById('paymentTransactionId').value = '';
  document.getElementById('recordPaymentOverlay').classList.add('active');
}

function closeRecordPaymentModal() {
  document.getElementById('recordPaymentOverlay').classList.remove('active');
}

/* ==========================================================================
   Member Portal Helpers (Menu, Attendance, Bills)
   ========================================================================== */

async function loadMemberMenuTable() {
  const tbody = document.getElementById('memberMenuTableBody');
  if (!tbody) return;
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/menu`, { headers: getAuthHeaders() });
    const data = await response.json();
    if (response.ok) {
      tbody.innerHTML = '';
      data.forEach(m => {
        tbody.innerHTML += `
          <tr>
            <td><strong>${m.dayOfWeek}</strong></td>
            <td style="text-align: center;">${m.morningNormal}</td>
            <td style="text-align: center;">${m.eveningNormal}</td>
            <td style="text-align: center;">${m.morningHalfSpecial}</td>
            <td style="text-align: center;">${m.eveningHalfSpecial}</td>
            <td style="text-align: center;">${m.morningFullSpecial}</td>
            <td style="text-align: center;">${m.eveningFullSpecial}</td>
          </tr>
        `;
      });
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--error);">Error loading menu.</td></tr>';
  }
}

async function loadMemberAttendanceHistory() {
  const tbody = document.getElementById('memberAttendanceTableBody');
  if (!tbody) return;

  const selectMonth = document.getElementById('memberHistoryMonth');
  const inputYear = document.getElementById('memberHistoryYear');

  if (selectMonth && !selectMonth.dataset.initialized) {
    const today = new Date();
    selectMonth.value = today.getMonth() + 1;
    inputYear.value = today.getFullYear();
    selectMonth.dataset.initialized = 'true';
  }

  const selectedMonth = parseInt(selectMonth.value);
  const selectedYear = parseInt(inputYear.value);

  try {
    const nilsResponse = await fetch(`${BACKEND_BASE_URL}/api/nildiet`, { headers: getAuthHeaders() });
    const nilsData = await nilsResponse.json();
    const approvedNils = nilsResponse.ok ? nilsData.filter(r => r.status === 'approved') : [];

    const response = await fetch(`${BACKEND_BASE_URL}/api/attendance/history`, { headers: getAuthHeaders() });
    const history = await response.json();
    if (response.ok) {
      tbody.innerHTML = '';

      const todayDate = new Date();
      const todayStr = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;

      const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        // Construct date string YYYY-MM-DD
        const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        // Format date as DD-MM-YYYY
        const displayDate = `${String(day).padStart(2, '0')}-${String(selectedMonth).padStart(2, '0')}-${selectedYear}`;
        const isToday = dateStr === todayStr;

        const dateHtml = isToday 
          ? `<span class="badge" style="background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); color: #fff; font-weight: 700; padding: 0.35rem 0.75rem; border-radius: var(--radius-sm); box-shadow: 0 4px 15px rgba(99, 102, 241, 0.45); border: 1px solid rgba(255, 255, 255, 0.1); letter-spacing: 0.5px; display: inline-block;">${displayDate} <span style="font-size: 0.75rem; margin-left: 0.3rem; opacity: 0.9;">(Today)</span></span>`
          : `<strong>${displayDate}</strong>`;

        // Check if date falls in any approved nil diet range
        const matchedNil = approvedNils.find(r => {
          const start = r.fromDate.split('T')[0];
          const end = r.toDate.split('T')[0];
          return dateStr >= start && dateStr <= end;
        });

        let isMorningNil = false;
        let isEveningNil = false;
        if (matchedNil) {
          const nilStatus = checkNilStatusForDate(dateStr, matchedNil);
          isMorningNil = nilStatus.isMorning;
          isEveningNil = nilStatus.isEvening;
        }

        // Find record
        const record = history.find(r => r.date.split('T')[0] === dateStr);

        const nilBadgeHtml = `<span class="badge" style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.2); color: #f59e0b; font-size: 0.75rem; font-weight: 600; padding: 0.15rem 0.5rem; border-radius: 4px;">NIL</span>`;

        const morningNormalStatus = isMorningNil 
          ? nilBadgeHtml 
          : (record && record.morningNormal ? '<span style="color: var(--success); font-weight: 600;">✅ Eaten</span>' : '<span style="color: var(--text-secondary);">❌ No</span>');
        const morningHalfSpecialStatus = isMorningNil 
          ? nilBadgeHtml 
          : (record && record.morningHalfSpecial ? '<span style="color: var(--success); font-weight: 600;">✅ Eaten</span>' : '<span style="color: var(--text-secondary);">❌ No</span>');
        const morningFullSpecialStatus = isMorningNil 
          ? nilBadgeHtml 
          : (record && record.morningFullSpecial ? '<span style="color: var(--success); font-weight: 600;">✅ Eaten</span>' : '<span style="color: var(--text-secondary);">❌ No</span>');

        const eveningNormalStatus = isEveningNil 
          ? nilBadgeHtml 
          : (record && record.eveningNormal ? '<span style="color: var(--success); font-weight: 600;">✅ Eaten</span>' : '<span style="color: var(--text-secondary);">❌ No</span>');
        const eveningHalfSpecialStatus = isEveningNil 
          ? nilBadgeHtml 
          : (record && record.eveningHalfSpecial ? '<span style="color: var(--success); font-weight: 600;">✅ Eaten</span>' : '<span style="color: var(--text-secondary);">❌ No</span>');
        const eveningFullSpecialStatus = isEveningNil 
          ? nilBadgeHtml 
          : (record && record.eveningFullSpecial ? '<span style="color: var(--success); font-weight: 600;">✅ Eaten</span>' : '<span style="color: var(--text-secondary);">❌ No</span>');

        tbody.innerHTML += `
          <tr ${matchedNil ? 'style="background: rgba(245, 158, 11, 0.02);"' : ''}>
            <td>${dateHtml}</td>
            <td style="text-align: center;">${morningNormalStatus}</td>
            <td style="text-align: center;">${eveningNormalStatus}</td>
            <td style="text-align: center;">${morningHalfSpecialStatus}</td>
            <td style="text-align: center;">${eveningHalfSpecialStatus}</td>
            <td style="text-align: center;">${morningFullSpecialStatus}</td>
            <td style="text-align: center;">${eveningFullSpecialStatus}</td>
          </tr>
        `;
      }
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--error);">Error loading history.</td></tr>';
  }
}

async function loadMemberBillsTable() {
  const tbody = document.getElementById('memberBillsTableBody');
  if (!tbody) return;
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/bills`, { headers: getAuthHeaders() });
    const data = await response.json();
    if (response.ok) {
      memberBillsList = data; // Store globally for printing individual slips
      tbody.innerHTML = '';
      if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-secondary);">No monthly bills generated.</td></tr>';
        return;
      }
      data.forEach(b => {
        const badgeClass = b.status === 'paid' ? 'success' : 'warning';
        tbody.innerHTML += `
          <tr>
            <td><strong>${b.month}/${b.year}</strong></td>
            <td>${b.totalMeals}</td>
            <td>Rs. ${b.totalAmount}</td>
            <td><span class="badge badge-${badgeClass}">${b.status.toUpperCase()}</span></td>
            <td>${new Date(b.createdAt).toLocaleDateString()}</td>
            <td>
              <button class="btn btn-accent" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 0.25rem;" onclick="downloadMemberSlip(${b.id})">
                <span>📄</span> Slip
              </button>
            </td>
          </tr>
        `;
      });
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--error);">Error loading bills.</td></tr>';
  }
}

async function loadMemberNilDietRequests() {
  const tbody = document.getElementById('nilDietHistoryBody');
  if (!tbody) return;
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/nildiet`, { headers: getAuthHeaders() });
    const data = await response.json();
    if (response.ok) {
      tbody.innerHTML = '';
      if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-secondary);">No requests submitted yet.</td></tr>';
        return;
      }
      data.forEach(r => {
        let badgeClass = 'warning';
        if (r.status === 'approved') badgeClass = 'success';
        if (r.status === 'rejected') badgeClass = 'danger';

        const fromParts = r.fromDate.split('-');
        const toParts = r.toDate.split('-');
        const displayFrom = `${fromParts[2]}-${fromParts[1]}-${fromParts[0]}`;
        const displayTo = `${toParts[2]}-${toParts[1]}-${toParts[0]}`;

        let sessionsStr = '';
        if (r.fromMorning !== undefined && r.fromMorning !== null) {
          const fromSess = (r.fromMorning && r.fromEvening) ? 'Morning & Evening' : (r.fromMorning ? 'Morning Only' : (r.fromEvening ? 'Evening Only' : 'None'));
          const toSess = (r.toMorning && r.toEvening) ? 'Morning & Evening' : (r.toMorning ? 'Morning Only' : (r.toEvening ? 'Evening Only' : 'None'));
          if (r.fromDate.split('T')[0] === r.toDate.split('T')[0]) {
            sessionsStr = fromSess;
          } else {
            sessionsStr = `Start: ${fromSess}<br>End: ${toSess}`;
          }
        } else {
          sessionsStr = (r.morningDiet && r.eveningDiet) 
            ? 'Morning & Evening' 
            : (r.morningDiet ? 'Morning Only' : (r.eveningDiet ? 'Evening Only' : 'None'));
        }

        const deleteButtonHtml = r.status === 'pending'
          ? `<button class="btn btn-danger" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="deleteNilDietRequest(${r.id})">Delete</button>`
          : `<span style="color: var(--text-muted); font-size: 0.85rem;">Locked</span>`;

        tbody.innerHTML += `
          <tr>
            <td style="text-align: center;"><strong>${displayFrom}</strong></td>
            <td style="text-align: center;"><strong>${displayTo}</strong></td>
            <td style="text-align: center; font-size: 0.85rem; color: var(--accent-light); font-weight: 600;">${sessionsStr}</td>
            <td style="text-align: center;"><span class="badge badge-${badgeClass}">${r.status.toUpperCase()}</span></td>
            <td style="text-align: center; color: var(--text-secondary); font-size: 0.85rem;">${new Date(r.createdAt).toLocaleString()}</td>
            <td style="text-align: center;">
              ${deleteButtonHtml}
            </td>
          </tr>
        `;
      });
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--error);">Error loading requests.</td></tr>';
  }
}

async function loadNilDietRequestsAdmin() {
  const tbody = document.getElementById('nilDietsAdminTableBody');
  if (!tbody) return;
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/nildiet`, { headers: getAuthHeaders() });
    const data = await response.json();
    if (response.ok) {
      // Calculate pending request count
      const pendingRequests = data.filter(r => r.status === 'pending');
      const pendingCount = pendingRequests.length;

      // Update Tab count badge
      const badge = document.getElementById('nilDietRequestBadge');
      if (badge) {
        if (pendingCount > 0) {
          badge.innerText = pendingCount;
          badge.style.display = 'inline-block';
        } else {
          badge.style.display = 'none';
        }
      }

      // Update Summary Tab alert banner
      const alertBanner = document.getElementById('pendingNilDietAlert');
      const alertCount = document.getElementById('pendingNilDietAlertCount');
      if (alertBanner && alertCount) {
        if (pendingCount > 0) {
          alertCount.innerText = pendingCount;
          alertBanner.style.display = 'block';
        } else {
          alertBanner.style.display = 'none';
        }
      }

      tbody.innerHTML = '';
      if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-secondary);">No nil diet requests found.</td></tr>';
        return;
      }
      data.forEach(r => {
        let badgeClass = 'warning';
        if (r.status === 'approved') badgeClass = 'success';
        if (r.status === 'rejected') badgeClass = 'danger';

        const fromParts = r.fromDate.split('-');
        const toParts = r.toDate.split('-');
        const displayFrom = `${fromParts[2]}-${fromParts[1]}-${fromParts[0]}`;
        const displayTo = `${toParts[2]}-${toParts[1]}-${toParts[0]}`;

        let sessionsStr = '';
        if (r.fromMorning !== undefined && r.fromMorning !== null) {
          const fromSess = (r.fromMorning && r.fromEvening) ? 'Morning & Evening' : (r.fromMorning ? 'Morning Only' : (r.fromEvening ? 'Evening Only' : 'None'));
          const toSess = (r.toMorning && r.toEvening) ? 'Morning & Evening' : (r.toMorning ? 'Morning Only' : (r.toEvening ? 'Evening Only' : 'None'));
          if (r.fromDate.split('T')[0] === r.toDate.split('T')[0]) {
            sessionsStr = fromSess;
          } else {
            sessionsStr = `Start: ${fromSess}<br>End: ${toSess}`;
          }
        } else {
          sessionsStr = (r.morningDiet && r.eveningDiet) 
            ? 'Morning & Evening' 
            : (r.morningDiet ? 'Morning Only' : (r.eveningDiet ? 'Evening Only' : 'None'));
        }

        let actionHtml = '';
        if (r.status === 'pending') {
          actionHtml = `
            <button class="btn btn-success" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; margin-right: 0.25rem;" onclick="manageNilDietRequest(${r.id}, 'approve')">Approve</button>
            <button class="btn btn-danger" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; margin-right: 0.25rem;" onclick="manageNilDietRequest(${r.id}, 'reject')">Reject</button>
          `;
        }
        actionHtml += `
          <button class="btn btn-danger" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="deleteNilDietRequest(${r.id})">Delete</button>
        `;

        tbody.innerHTML += `
          <tr>
            <td style="text-align: center;"><strong>${r.memberName}</strong></td>
            <td style="text-align: center;">${r.memberEmail}</td>
            <td style="text-align: center;"><strong>${displayFrom}</strong></td>
            <td style="text-align: center;"><strong>${displayTo}</strong></td>
            <td style="text-align: center; font-size: 0.85rem; color: var(--accent-light); font-weight: 600;">${sessionsStr}</td>
            <td style="text-align: center;"><span class="badge badge-${badgeClass}">${r.status.toUpperCase()}</span></td>
            <td style="text-align: center; color: var(--text-secondary); font-size: 0.85rem;">${new Date(r.createdAt).toLocaleString()}</td>
            <td style="text-align: center;">${actionHtml}</td>
          </tr>
        `;
      });
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--error);">Error loading requests.</td></tr>';
  }
}

async function manageNilDietRequest(id, action) {
  if (!confirm(`Are you sure you want to ${action} this request?`)) return;
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/nildiet/${id}/${action}`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Failed to ${action} request.`);
    showNotification(`Request successfully ${action}d.`, 'success');
    loadNilDietRequestsAdmin();
    
    // Refresh attendance summaries
    const summaryDate = document.getElementById('attendanceSummaryDate')?.value;
    if (summaryDate) {
      loadAttendanceSummary(summaryDate);
    }
  } catch (err) {
    showNotification(err.message, 'error');
  }
}

async function deleteNilDietRequest(id) {
  if (!confirm('Are you sure you want to delete this Nil Diet request?')) return;
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/nildiet/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to delete request.');
    showNotification('Nil Diet request deleted successfully.', 'success');

    // Refresh whichever dashboard lists are present
    const user = JSON.parse(localStorage.getItem('user'));
    if (user && (user.role === 'district_admin' || user.role === 'super_admin')) {
      loadNilDietRequestsAdmin();
      const summaryDate = document.getElementById('attendanceSummaryDate')?.value;
      if (summaryDate) {
        loadAttendanceSummary(summaryDate);
      }
    } else {
      loadMemberNilDietRequests();
      loadMemberAttendanceHistory();
    }
  } catch (err) {
    showNotification(err.message, 'error');
  }
}

/* ==========================================================================
   Diet Bills PDF slips and Monthly Reports generators
   ========================================================================== */

function filterAndRenderBillsTable() {
  const tbody = document.getElementById('billsTableBody');
  if (!tbody) return;

  const filterMonthVal = document.getElementById('filterBillMonth').value;
  const filterYearEl = document.getElementById('filterBillYear');
  const filterYearVal = filterYearEl ? filterYearEl.value.trim() : '';

  let filtered = currentBillsList;

  if (filterMonthVal !== 'all') {
    const m = parseInt(filterMonthVal);
    filtered = filtered.filter(b => b.month === m);
  }

  if (filterYearVal !== '') {
    const y = parseInt(filterYearVal);
    if (!isNaN(y)) {
      filtered = filtered.filter(b => b.year === y);
    }
  }

  tbody.innerHTML = '';
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-secondary);">No monthly bills found matching the filters.</td></tr>';
    return;
  }

  filtered.forEach(b => {
    const badgeClass = b.status === 'paid' ? 'success' : 'warning';
    const actionBtn = b.status === 'unpaid'
      ? `<button class="btn btn-primary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="recordPayment(${b.id})">Mark Paid</button>`
      : `<span style="font-size: 0.85rem; color: var(--success); font-weight: 600;">Paid</span>`;
    tbody.innerHTML += `
      <tr>
        <td><strong>${b.userName || 'Member'}</strong></td>
        <td>${b.month}/${b.year}</td>
        <td>${b.totalMeals}</td>
        <td>Rs. ${b.totalAmount}</td>
        <td><span class="badge badge-${badgeClass}">${b.status.toUpperCase()}</span></td>
        <td>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            ${actionBtn}
            <button class="btn btn-accent" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 0.25rem;" onclick="downloadIndividualSlip(${b.id})">
              <span>📄</span> Slip
            </button>
          </div>
        </td>
      </tr>
    `;
  });
}

function getLogoBase64() {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = 'up-police-logo.png';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        console.error('Failed to convert logo to base64:', err);
        resolve(null);
      }
    };
    img.onerror = () => {
      resolve(null);
    };
  });
}

async function downloadIndividualSlip(billId) {
  const bill = currentBillsList.find(b => b.id === billId);
  if (!bill) {
    showNotification('Bill not found.', 'error');
    return;
  }
  const logoBase64 = await getLogoBase64();
  generateIndividualPdfSlip(bill, bill.userName || 'Member', bill.email || '', logoBase64);
}

async function downloadMemberSlip(billId) {
  const bill = memberBillsList.find(b => b.id === billId);
  if (!bill) {
    showNotification('Bill not found.', 'error');
    return;
  }
  const user = JSON.parse(localStorage.getItem('user')) || {};
  const memberName = user.fullName || 'Member';
  const memberEmail = user.email || '';
  const logoBase64 = await getLogoBase64();
  generateIndividualPdfSlip(bill, memberName, memberEmail, logoBase64);
}

function generateIndividualPdfSlip(bill, memberName, memberEmail, logoBase64) {
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a5'
    });

    const districtName = (document.getElementById('statDistrictName') ? document.getElementById('statDistrictName').innerText.trim() : null) || 
                         (document.getElementById('distNameText') ? document.getElementById('distNameText').innerText.trim() : null) || 
                         'Uttar Pradesh Police';

    const getMonthName = (monthNum) => {
      const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      return months[monthNum - 1] || "";
    };

    // Card/Receipt border
    doc.setDrawColor(226, 232, 240); // light gray border
    doc.rect(5, 5, 138, 200);

    // Decorative top header bar
    doc.setFillColor(30, 41, 59); // dark slate blue
    doc.rect(5, 5, 138, 4, 'F');

    let titleStartY = 20;

    // Draw logo if available
    if (logoBase64) {
      doc.addImage(logoBase64, 'PNG', 64, 13, 20, 20);
      titleStartY = 39;
    }

    // Header Text
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text("UTTAR PRADESH POLICE MESS", 74, titleStartY, { align: 'center' });

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(`${districtName.toUpperCase()} DISTRICT`, 74, titleStartY + 6, { align: 'center' });

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("MONTHLY DIET BILL RECEIPT / SLIP", 74, titleStartY + 11, { align: 'center' });

    // Separator line
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    const lineY = titleStartY + 16;
    doc.line(10, lineY, 138, lineY);

    // Metadata Details
    doc.setFontSize(9);
    
    // Row 1
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text("Bill Invoice No:", 12, lineY + 8);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(`MMS-${bill.year}${String(bill.month).padStart(2, '0')}-${String(bill.id).padStart(4, '0')}`, 40, lineY + 8);

    doc.setFont("Helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text("Bill Date:", 85, lineY + 8);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(new Date(bill.createdAt).toLocaleDateString('en-IN'), 105, lineY + 8);

    // Row 2
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text("Member Name:", 12, lineY + 15);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(memberName, 40, lineY + 15);

    doc.setFont("Helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text("Period:", 85, lineY + 15);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(`${getMonthName(bill.month)} ${bill.year}`, 105, lineY + 15);

    // Row 3
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text("Member Email:", 12, lineY + 22);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(memberEmail, 40, lineY + 22);

    // Charges Table
    doc.autoTable({
      startY: lineY + 30,
      margin: { left: 10, right: 10 },
      head: [['Description', 'Meals Count', 'Total Amount']],
      body: [
        ['Diet Mess Consumption Charges', `${bill.totalMeals}`, `Rs. ${bill.totalAmount}`]
      ],
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { textColor: [15, 23, 42], fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 60, halign: 'left' },
        1: { cellWidth: 30, halign: 'center' },
        2: { cellWidth: 38, halign: 'right' }
      }
    });

    const finalY = doc.lastAutoTable.finalY;

    // Payment Status badge/block
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text("Payment Status:", 12, finalY + 12);

    const isPaid = bill.status.toLowerCase() === 'paid';
    if (isPaid) {
      doc.setFillColor(220, 252, 231); // light green background
      doc.rect(42, finalY + 8, 20, 6, 'F');
      doc.setTextColor(21, 128, 61); // dark green text
      doc.setFontSize(9);
      doc.setFont("Helvetica", "bold");
      doc.text("PAID", 52, finalY + 12.5, { align: 'center' });
    } else {
      doc.setFillColor(254, 226, 226); // light red background
      doc.rect(42, finalY + 8, 20, 6, 'F');
      doc.setTextColor(185, 28, 28); // dark red text
      doc.setFontSize(9);
      doc.setFont("Helvetica", "bold");
      doc.text("UNPAID", 52, finalY + 12.5, { align: 'center' });
    }

    // Disclaimer
    doc.setFont("Helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("* Diet charges are compiled from daily digital roll attendance logs.", 12, finalY + 22);

    // Signature Block
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text("__________________________", 12, finalY + 44);
    doc.text("Member's Signature", 12, finalY + 49);

    doc.text("__________________________", 85, finalY + 44);
    doc.text("Mess Commander / Admin", 85, finalY + 49);

    // Footer copyright
    doc.setFont("Helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text("Computer Generated Diet Bill Slip. Validated digitally.", 74, 195, { align: 'center' });

    doc.save(`Mess_Bill_Slip_${bill.year}_${String(bill.month).padStart(2, '0')}_${memberName.replace(/\s+/g, '_')}.pdf`);
  } catch (err) {
    console.error("PDF generation failed:", err);
    showNotification("Failed to generate PDF slip.", "error");
  }
}

async function downloadMonthlyPdf() {
  try {
    const filterMonthVal = document.getElementById('filterBillMonth').value;
    const filterYearEl = document.getElementById('filterBillYear');
    const filterYearVal = filterYearEl ? filterYearEl.value.trim() : '';

    let filtered = currentBillsList;
    let selectedMonthName = "ALL PERIODS";
    let selectedYear = "";

    const getMonthName = (monthNum) => {
      const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      return months[monthNum - 1] || "";
    };

    if (filterMonthVal !== 'all') {
      const m = parseInt(filterMonthVal);
      filtered = filtered.filter(b => b.month === m);
      selectedMonthName = getMonthName(m).toUpperCase();
    }

    if (filterYearVal !== '') {
      const y = parseInt(filterYearVal);
      if (!isNaN(y)) {
        filtered = filtered.filter(b => b.year === y);
        selectedYear = y;
      }
    }

    if (filtered.length === 0) {
      showNotification('No bill records found for the selected filters.', 'error');
      return;
    }

    const logoBase64 = await getLogoBase64();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const districtName = (document.getElementById('statDistrictName') ? document.getElementById('statDistrictName').innerText.trim() : null) || 'Uttar Pradesh Police';

    let titleStartY = 26;
    let tableStartY = 74;
    let summaryBoxY = 48;

    if (logoBase64) {
      doc.addImage(logoBase64, 'PNG', 93, 10, 24, 24);
      titleStartY = 41;
      summaryBoxY = 63;
      tableStartY = 89;
    }

    // Header Text
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text("UTTAR PRADESH POLICE MESS", 105, titleStartY, { align: 'center' });

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(71, 85, 105);
    doc.text(`${districtName.toUpperCase()} DISTRICT MESS REPORT`, 105, titleStartY + 7, { align: 'center' });

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    const subTitleStr = selectedYear ? `MONTHLY BILLS STATEMENT - ${selectedMonthName} ${selectedYear}` : `BILLS STATEMENT - ${selectedMonthName}`;
    doc.text(subTitleStr, 105, titleStartY + 13, { align: 'center' });

    // Separator line
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.line(10, titleStartY + 18, 200, titleStartY + 18);

    // Calculate Summary Stats
    const totalMealsSum = filtered.reduce((acc, curr) => acc + curr.totalMeals, 0);
    const totalAmountSum = filtered.reduce((acc, curr) => acc + parseFloat(curr.totalAmount), 0);
    const totalPaidSum = filtered.filter(b => b.status.toLowerCase() === 'paid').reduce((acc, curr) => acc + parseFloat(curr.totalAmount), 0);
    const totalUnpaidSum = totalAmountSum - totalPaidSum;

    // Summary Box
    doc.setFillColor(248, 250, 252);
    doc.rect(10, summaryBoxY, 190, 20, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(10, summaryBoxY, 190, 20);

    doc.setFontSize(9);
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text("Summary Statistics:", 14, summaryBoxY + 5);

    doc.setFont("Helvetica", "normal");
    doc.text(`Total Records: ${filtered.length}`, 14, summaryBoxY + 12);
    doc.text(`Total Meals Eaten: ${totalMealsSum}`, 64, summaryBoxY + 12);
    doc.text(`Total Amount: Rs. ${totalAmountSum.toFixed(2)}`, 124, summaryBoxY + 5);
    doc.text(`Total Paid: Rs. ${totalPaidSum.toFixed(2)}`, 124, summaryBoxY + 12);
    doc.text(`Total Unpaid: Rs. ${totalUnpaidSum.toFixed(2)}`, 124, summaryBoxY + 17);

    // Table of Bills
    doc.autoTable({
      startY: tableStartY,
      margin: { left: 10, right: 10 },
      head: [['S.No.', 'Member Name', 'Period', 'Meals Eaten', 'Total Amount', 'Status']],
      body: filtered.map((b, idx) => [
        idx + 1,
        b.userName || 'Member',
        `${getMonthName(b.month)} / ${b.year}`,
        b.totalMeals,
        `Rs. ${b.totalAmount}`,
        b.status.toUpperCase()
      ]),
      theme: 'striped',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9.5 },
      bodyStyles: { textColor: [51, 65, 85], fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 15, halign: 'center' },
        1: { cellWidth: 55, halign: 'left' },
        2: { cellWidth: 30, halign: 'center' },
        3: { cellWidth: 25, halign: 'center' },
        4: { cellWidth: 35, halign: 'right' },
        5: { cellWidth: 30, halign: 'center' }
      }
    });

    const finalY = doc.lastAutoTable.finalY;

    let sigY = finalY + 20;
    if (sigY > 260) {
      doc.addPage();
      sigY = 30;
    }

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text("__________________________", 15, sigY);
    doc.text("Prepared By (Accountant)", 15, sigY + 5);

    doc.text("__________________________", 135, sigY);
    doc.text("Mess Commander / Admin Approval", 135, sigY + 5);

    doc.setFont("Helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Report generated on ${new Date().toLocaleString('en-IN')}`, 105, 285, { align: 'center' });

    const monthFileStr = filterMonthVal !== 'all' ? `_${getMonthName(parseInt(filterMonthVal))}` : '';
    const yearFileStr = filterYearVal ? `_${filterYearVal}` : '';
    doc.save(`Monthly_Mess_Bills${monthFileStr}${yearFileStr}.pdf`);
  } catch (err) {
    console.error("PDF generation failed:", err);
    showNotification("Failed to generate Monthly PDF Report.", "error");
  }
}

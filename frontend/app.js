/**
 * ==========================================================================
 * UP Police Mess Management - Core Frontend Scripts
 * ==========================================================================
 */

const BACKEND_BASE_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "http://localhost:5000"
  : "https://mess-rjcn.onrender.com";

document.addEventListener('DOMContentLoaded', () => {
  console.log('>>> [INIT] Application initialized. Base URL:', BACKEND_BASE_URL);

  // Setup Global Logout Button
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', logout);
  }

  // Route page actions
  if (document.getElementById('loginForm')) {
    initLoginPage();
  } else if (document.getElementById('registrationForm')) {
    initRegisterPage();
  } else if (document.getElementById('userBrandHeader')) {
    initPersonnelDashboard();
  } else if (document.getElementById('adminBillsTableBody')) {
    initAdminDashboard();
  }
});

/* ==========================================================================
   Helper Functions (Security & Notifications)
   ========================================================================== */

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

function showNotification(message, type = 'info', duration = 4000) {
  const statusMessage = document.getElementById('statusMessage');
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
  console.log('>>> [LOGOUT] Ending session.');
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'login.html';
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
  recognition.lang = 'en-IN'; // Optimized for Indian English
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    if (btn.classList.contains('listening')) {
      recognition.stop();
      return;
    }

    btn.classList.add('listening');
    showNotification('Listening (Speak Name/PNO/Mobile)...', 'info', 2000);
    
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
    
    // Clean spaces for PNO and mobile numbers
    if (inputId === 'inputPNO' || inputId === 'inputMobile') {
      transcript = transcript.replace(/\s+/g, '');
    }
    
    input.value = transcript.toUpperCase();
    showNotification(`Recorded: "${transcript}"`, 'success', 2000);
  };

  recognition.onerror = (event) => {
    console.error(`[Speech API] Error:`, event.error);
    btn.classList.remove('listening');
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
    
    const loginId = document.getElementById('inputLoginId').value.trim();
    const password = document.getElementById('inputPassword').value.trim();
    
    const btn = document.getElementById('btnLogin');
    btn.disabled = true;
    btn.innerText = 'Verifying Credentials...';

    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId, password })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Login verification failed.');
      }

      // Save token and user info
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      showNotification('Success! Opening dashboard...', 'success');
      
      setTimeout(() => {
        if (data.user.roleName === 'Admin') {
          window.location.href = 'admin-dashboard.html';
        } else {
          window.location.href = 'personnel-dashboard.html';
        }
      }, 1000);

    } catch (err) {
      showNotification(err.message, 'error');
      btn.disabled = false;
      btn.innerText = 'Log In securely';
    }
  });
}

/* ==========================================================================
   2. Personnel Registration Page (register.html)
   ========================================================================== */

function initRegisterPage() {
  setupVoiceField('btnMicName', 'inputName');
  setupVoiceField('btnMicPNO', 'inputPNO');
  setupVoiceField('btnMicMobile', 'inputMobile');

  const btnSendOtp = document.getElementById('btnSendOtp');
  const otpSection = document.getElementById('otpSection');
  const form = document.getElementById('registrationForm');

  btnSendOtp.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = document.getElementById('inputEmail').value.trim();

    if (!email) {
      showNotification('Please enter a valid email address first.', 'error');
      return;
    }

    btnSendOtp.disabled = true;
    btnSendOtp.innerText = 'Sending...';

    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to dispatch OTP.');
      }

      showNotification(data.message, 'success', 0);
      otpSection.style.display = 'block';
      document.getElementById('inputOtp').focus();

    } catch (err) {
      showNotification(err.message, 'error');
    } finally {
      btnSendOtp.disabled = false;
      btnSendOtp.innerText = 'Get OTP';
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('inputName').value.trim();
    const pno = document.getElementById('inputPNO').value.trim();
    const rank = document.getElementById('selectRank').value;
    const postingUnit = document.getElementById('inputPostingUnit').value.trim();
    const mobile = document.getElementById('inputMobile').value.trim();
    const email = document.getElementById('inputEmail').value.trim();
    const password = document.getElementById('inputPassword').value.trim();
    const otp = document.getElementById('inputOtp').value.trim();

    if (!name || !pno || !rank || !postingUnit || !mobile || !email || !password || !otp) {
      showNotification('All registration fields are required.', 'error');
      return;
    }

    const btnRegister = document.getElementById('btnRegister');
    btnRegister.disabled = true;
    btnRegister.innerText = 'Registering Officer...';

    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, pno, rank, postingUnit, mobile, email, password, otp })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Registration failed.');
      }

      showNotification(data.message, 'success', 0);
      form.reset();
      otpSection.style.display = 'none';

    } catch (err) {
      showNotification(err.message, 'error');
      btnRegister.disabled = false;
      btnRegister.innerText = 'Verify OTP & Submit Record';
    }
  });
}

/* ==========================================================================
   3. Police Personnel Dashboard (personnel-dashboard.html)
   ========================================================================== */

async function initPersonnelDashboard() {
  const token = localStorage.getItem('token');
  const userJson = localStorage.getItem('user');

  if (!token || !userJson) {
    window.location.href = 'login.html';
    return;
  }

  const user = JSON.parse(userJson);
  
  // Set headers
  document.getElementById('userBrandHeader').innerText = `UP Police Mess | ${user.name}`;
  document.getElementById('welcomeMessage').innerText = `Welcome, ${user.rank} ${user.name}`;

  // 1. Fetch Profile Info & Fill Form
  await loadUserProfile();

  // 2. Fetch Weekly Menu
  await loadWeeklyMenu();

  // 3. Fetch Notices Board
  await loadNoticesFeed('noticesFeed');

  // 4. Fetch Personal Bills list
  await loadPersonalBills();

  // 5. Initialize Attendance form date
  initAttendanceSection();
}

async function loadUserProfile() {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/users/profile`, {
      headers: getAuthHeaders()
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    // Populate header details
    document.getElementById('userRankPno').innerText = `Designation/Rank: ${data.rank} | Personal Number (PNO): ${data.pno} | Unit: ${data.postingUnit}`;
    
    // Also update welcome message to avoid undefined rank display
    const welcomeMessage = document.getElementById('welcomeMessage');
    if (welcomeMessage) {
      welcomeMessage.innerText = `Welcome, ${data.rank} ${data.name}`;
    }
    
    // Fill Profile update form
    document.getElementById('profileName').value = data.name;
    document.getElementById('profileRank').value = data.rank;
    document.getElementById('profilePostingUnit').value = data.postingUnit;
    document.getElementById('profileMobile').value = data.mobile;

    // Attach profile update submit
    const profileForm = document.getElementById('profileForm');
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('profileName').value.trim();
      const rank = document.getElementById('profileRank').value;
      const postingUnit = document.getElementById('profilePostingUnit').value.trim();
      const mobile = document.getElementById('profileMobile').value.trim();

      try {
        const updateRes = await fetch(`${BACKEND_BASE_URL}/api/users/profile`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ name, rank, postingUnit, mobile })
        });
        const updateData = await updateRes.json();
        if (!updateRes.ok) throw new Error(updateData.error);

        showNotification('Profile updated successfully!', 'success');
        // Refresh local cache name
        const cachedUser = JSON.parse(localStorage.getItem('user'));
        cachedUser.name = name;
        cachedUser.rank = rank;
        localStorage.setItem('user', JSON.stringify(cachedUser));
        document.getElementById('userBrandHeader').innerText = `UP Police Mess | ${name}`;
        document.getElementById('welcomeMessage').innerText = `Welcome, ${rank} ${name}`;
      } catch (err) {
        showNotification(err.message, 'error');
      }
    });

  } catch (err) {
    console.error('Failed to load profile:', err);
  }
}

async function loadWeeklyMenu() {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/menu`, {
      headers: getAuthHeaders()
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    const tbody = document.getElementById('menuTableBody');
    if (tbody) {
      const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const todayIndex = new Date().getDay();
      const todayName = daysOfWeek[todayIndex];

      tbody.innerHTML = data.map(day => {
        const isToday = day.dayOfWeek.toLowerCase() === todayName.toLowerCase();
        const rowStyle = isToday ? 'style="background-color: rgba(207, 161, 64, 0.15); font-weight: 600;"' : '';
        const todayIndicator = isToday ? ' <span class="badge badge-warning">Today</span>' : '';
        
        return `
          <tr ${rowStyle}>
            <td>${day.dayOfWeek}${todayIndicator}</td>
            <td>${day.breakfast}</td>
            <td>${day.lunch}</td>
            <td>${day.dinner}</td>
          </tr>
        `;
      }).join('');
    }

    // If we're on the admin dashboard, also load selectMenuDay dropdown
    const selectMenuDay = document.getElementById('selectMenuDay');
    if (selectMenuDay) {
      selectMenuDay.innerHTML = '<option value="" disabled selected>Choose Day</option>' + 
        data.map(day => `<option value="${day.id}">${day.dayOfWeek}</option>`).join('');

      // When day changes, pre-fill inputs
      selectMenuDay.addEventListener('change', () => {
        const selected = data.find(d => d.id == selectMenuDay.value);
        if (selected) {
          document.getElementById('inputMenuBreakfast').value = selected.breakfast;
          document.getElementById('inputMenuLunch').value = selected.lunch;
          document.getElementById('inputMenuDinner').value = selected.dinner;
        }
      });
    }

  } catch (err) {
    console.error('Failed to load weekly menu:', err);
  }
}

async function loadNoticesFeed(feedElementId) {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/notices`, {
      headers: getAuthHeaders()
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    const feed = document.getElementById(feedElementId);
    if (!feed) return;

    if (data.length === 0) {
      feed.innerHTML = '<p style="color: var(--text-secondary); text-align: center; font-size: 0.9rem;">No active notices on board.</p>';
      return;
    }

    feed.innerHTML = data.map(notice => {
      const dateStr = new Date(notice.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
      return `
        <div class="notice-item">
          <div class="notice-title">${escapeHtml(notice.title)}</div>
          <div class="notice-meta">Posted by: ${notice.postedByRank} ${notice.postedByName} on ${dateStr}</div>
          <p class="notice-content">${escapeHtml(notice.content)}</p>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Failed to load notices feed:', err);
  }
}

async function loadPersonalBills() {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/bills`, {
      headers: getAuthHeaders()
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    const tbody = document.getElementById('billsTableBody');
    if (!tbody) return;

    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-secondary);">No generated billing records found.</td></tr>`;
      return;
    }

    const months = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    
    tbody.innerHTML = data.map(bill => {
      const statusBadge = bill.status === 'paid' 
        ? '<span class="badge badge-success">Paid</span>' 
        : '<span class="badge badge-danger">Unpaid</span>';
      
      return `
        <tr>
          <td>${months[bill.month]} ${bill.year}</td>
          <td>${bill.totalMeals}</td>
          <td>₹${bill.totalAmount}</td>
          <td>${statusBadge}</td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error('Failed to load personal bills:', err);
  }
}

function initAttendanceSection() {
  const dateInput = document.getElementById('inputAttendanceDate');
  if (!dateInput) return;

  const todayStr = new Date().toISOString().split('T')[0];
  dateInput.value = todayStr;

  // Load attendance details for default date
  fetchAndPopulateAttendance(todayStr);

  dateInput.addEventListener('change', () => {
    fetchAndPopulateAttendance(dateInput.value);
  });

  // Attach submit handler
  const form = document.getElementById('attendanceForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const date = dateInput.value;
    const breakfast = document.getElementById('checkBreakfast').checked;
    const lunch = document.getElementById('checkLunch').checked;
    const dinner = document.getElementById('checkDinner').checked;

    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/attendance`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ date, breakfast, lunch, dinner })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      showNotification('Meal choice updated successfully!', 'success');
      loadAttendanceHistory(); // Refresh history log
    } catch (err) {
      showNotification(err.message, 'error');
    }
  });

  // Load history log
  loadAttendanceHistory();
}

async function fetchAndPopulateAttendance(date) {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/attendance/history`, {
      headers: getAuthHeaders()
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    const record = data.find(r => r.date === date);
    
    // Clear and set checkboxes
    document.getElementById('checkBreakfast').checked = record ? !!record.breakfast : false;
    document.getElementById('checkLunch').checked = record ? !!record.lunch : false;
    document.getElementById('checkDinner').checked = record ? !!record.dinner : false;
  } catch (err) {
    console.error('Failed to fetch attendance choice:', err);
  }
}

async function loadAttendanceHistory() {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/attendance/history`, {
      headers: getAuthHeaders()
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    const tbody = document.getElementById('attendanceHistoryBody');
    if (!tbody) return;

    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-secondary);">No recent meal logs.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.slice(0, 10).map(r => {
      const bIcon = r.breakfast ? '✅ Yes' : '❌ No';
      const lIcon = r.lunch ? '✅ Yes' : '❌ No';
      const dIcon = r.dinner ? '✅ Yes' : '❌ No';
      return `
        <tr>
          <td>${r.date}</td>
          <td>${bIcon}</td>
          <td>${lIcon}</td>
          <td>${dIcon}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load attendance history log:', err);
  }
}

/* ==========================================================================
   4. Mess Admin Dashboard (admin-dashboard.html)
   ========================================================================== */

async function initAdminDashboard() {
  const token = localStorage.getItem('token');
  const userJson = localStorage.getItem('user');

  if (!token || !userJson) {
    window.location.href = 'login.html';
    return;
  }

  const user = JSON.parse(userJson);
  if (user.roleName !== 'Admin') {
    window.location.href = 'personnel-dashboard.html';
    return;
  }

  // Load stats counters
  await loadAdminStats();

  // Load personnel lists
  await loadPersonnelLists();

  // Load weekly menu details (updates menu dropdown and edit inputs)
  await loadWeeklyMenu();

  // Attach Menu submit form
  const updateMenuForm = document.getElementById('updateMenuForm');
  updateMenuForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('selectMenuDay').value;
    const breakfast = document.getElementById('inputMenuBreakfast').value.trim();
    const lunch = document.getElementById('inputMenuLunch').value.trim();
    const dinner = document.getElementById('inputMenuDinner').value.trim();

    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/menu/update`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id, breakfast, lunch, dinner })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      showNotification('Mess Menu updated successfully!', 'success');
      loadWeeklyMenu(); // refresh cache menu
    } catch (err) {
      showNotification(err.message, 'error');
    }
  });

  // Load Per-Meal Rates & Attach Rates edit form
  await loadMealRates();

  // Load Ledger list & generate billing defaults
  initBillingManagementSection();

  // Load announcements notice list & attach create form
  await loadNoticesFeed('adminNoticesFeed');
  initAnnouncementsForm();

  // Export report attach submit
  initExportsSection();
}

async function loadAdminStats() {
  try {
    // 1. Fetch aggregate users list
    const activeRes = await fetch(`${BACKEND_BASE_URL}/api/users/list?status=active`, { headers: getAuthHeaders() });
    const activeData = await activeRes.json();
    
    const pendingRes = await fetch(`${BACKEND_BASE_URL}/api/users/list?status=pending`, { headers: getAuthHeaders() });
    const pendingData = await pendingRes.json();

    document.getElementById('statTotalUsers').innerText = activeData.length;
    document.getElementById('statPendingApprovals').innerText = pendingData.length;

    // 2. Fetch daily aggregate meals served summary
    const summaryRes = await fetch(`${BACKEND_BASE_URL}/api/attendance/summary`, { headers: getAuthHeaders() });
    const summaryData = await summaryRes.json();
    document.getElementById('statDailyMeals').innerText = summaryData.grandTotal || 0;

  } catch (err) {
    console.error('Failed to load dashboard statistics:', err);
  }
}

async function loadPersonnelLists() {
  try {
    // 1. Load pending users
    const pendingRes = await fetch(`${BACKEND_BASE_URL}/api/users/list?status=pending`, { headers: getAuthHeaders() });
    const pendingData = await pendingRes.json();

    const pendingTbody = document.getElementById('pendingUsersTableBody');
    if (pendingData.length === 0) {
      pendingTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-secondary);">No pending user approvals.</td></tr>`;
    } else {
      pendingTbody.innerHTML = pendingData.map(u => `
        <tr>
          <td>${escapeHtml(u.name)}</td>
          <td>${escapeHtml(u.pno)}</td>
          <td>${escapeHtml(u.rank)}</td>
          <td>${escapeHtml(u.postingUnit)}</td>
          <td>
            <button class="btn btn-primary" style="padding: 0.25rem 0.75rem; font-size: 0.8rem;" onclick="modifyStatus(${u.id}, 'active')">Approve</button>
          </td>
        </tr>
      `).join('');
    }

    // 2. Load active users
    const activeRes = await fetch(`${BACKEND_BASE_URL}/api/users/list?status=active`, { headers: getAuthHeaders() });
    const activeData = await activeRes.json();

    const activeTbody = document.getElementById('activeUsersTableBody');
    if (activeData.length === 0) {
      activeTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary);">No active mess members.</td></tr>`;
    } else {
      activeTbody.innerHTML = activeData.map(u => `
        <tr>
          <td>${escapeHtml(u.name)}</td>
          <td>${escapeHtml(u.pno)}</td>
          <td>${escapeHtml(u.rank)}</td>
          <td>${escapeHtml(u.postingUnit)}</td>
          <td><span class="badge badge-success">${u.status}</span></td>
          <td>
            <button class="btn btn-secondary" style="padding: 0.25rem 0.75rem; font-size: 0.8rem;" onclick="modifyStatus(${u.id}, 'deactivated')">Deactivate</button>
          </td>
        </tr>
      `).join('');
    }

  } catch (err) {
    console.error('Failed to load personnel tables:', err);
  }
}

async function modifyStatus(userId, status) {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/users/status`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ userId, status })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    showNotification(`Status updated successfully!`, 'success');
    await loadAdminStats();
    await loadPersonnelLists();
  } catch (err) {
    showNotification(err.message, 'error');
  }
}

async function loadMealRates() {
  const form = document.getElementById('updateRatesForm');
  if (!form) return;

  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/bills/rates`, {
      headers: getAuthHeaders()
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    document.getElementById('rateBreakfast').value = data.breakfast;
    document.getElementById('rateLunch').value = data.lunch;
    document.getElementById('rateDinner').value = data.dinner;

    // Attach edit rates submit
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const breakfast = document.getElementById('rateBreakfast').value;
      const lunch = document.getElementById('rateLunch').value;
      const dinner = document.getElementById('rateDinner').value;

      try {
        const updateRes = await fetch(`${BACKEND_BASE_URL}/api/bills/rates`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ breakfast, lunch, dinner })
        });
        const updateData = await updateRes.json();
        if (!updateRes.ok) throw new Error(updateData.error);

        showNotification('Meal pricing updated successfully!', 'success');
      } catch (err) {
        showNotification(err.message, 'error');
      }
    });

  } catch (err) {
    console.error('Failed to load meal rates:', err);
  }
}

function initBillingManagementSection() {
  const form = document.getElementById('generateBillsForm');
  if (!form) return;

  // Set default values for billing generator
  const today = new Date();
  document.getElementById('selectBillMonth').value = today.getMonth() + 1;
  document.getElementById('inputBillYear').value = today.getFullYear();

  // Attach calculate submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const month = document.getElementById('selectBillMonth').value;
    const year = document.getElementById('inputBillYear').value;

    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/bills/generate`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ month, year })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      showNotification(data.message, 'success');
      loadAdminBillsLedger(); // Refresh list
    } catch (err) {
      showNotification(err.message, 'error');
    }
  });

  // Load bills list
  loadAdminBillsLedger();

  // Attach Payment modal confirmation handler
  const payForm = document.getElementById('paymentForm');
  payForm.addEventListener('submit', async (e) => {
    const billId = document.getElementById('modalBillId').value;
    const paymentMode = document.getElementById('selectPayMode').value;
    const transactionId = document.getElementById('inputTxnId').value.trim();

    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/bills/pay`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ billId, paymentMode, transactionId })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      showNotification('Bill payment registered successfully!', 'success');
      loadAdminBillsLedger(); // reload list
    } catch (err) {
      showNotification(err.message, 'error');
    }
  });
}

async function loadAdminBillsLedger() {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/bills`, {
      headers: getAuthHeaders()
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    const tbody = document.getElementById('adminBillsTableBody');
    if (!tbody) return;

    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-secondary);">No bills generated.</td></tr>`;
      return;
    }

    const months = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    
    tbody.innerHTML = data.map(bill => {
      const statusBadge = bill.status === 'paid' 
        ? '<span class="badge badge-success">Paid</span>' 
        : '<span class="badge badge-warning">Unpaid</span>';

      const actionButton = bill.status === 'unpaid'
        ? `<button class="btn btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" onclick="openPaymentModal(${bill.id})">Mark Paid</button>`
        : `<span style="color: var(--text-secondary); font-size: 0.75rem;">N/A</span>`;
      
      return `
        <tr>
          <td>${escapeHtml(bill.userName)}</td>
          <td>${escapeHtml(bill.pno)}</td>
          <td>${months[bill.month]} ${bill.year}</td>
          <td>${bill.totalMeals}</td>
          <td>₹${bill.totalAmount}</td>
          <td>${statusBadge}</td>
          <td>${actionButton}</td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error('Failed to load bills ledger:', err);
  }
}

function openPaymentModal(billId) {
  document.getElementById('modalBillId').value = billId;
  document.getElementById('inputTxnId').value = '';
  document.getElementById('paymentDialog').showModal();
}

function initAnnouncementsForm() {
  const form = document.getElementById('createNoticeForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('inputNoticeTitle').value.trim();
    const content = document.getElementById('inputNoticeContent').value.trim();

    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/notices`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ title, content })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      showNotification('Notice announcement published successfully!', 'success');
      form.reset();
      loadNoticesFeed('adminNoticesFeed'); // Refresh feed list
    } catch (err) {
      showNotification(err.message, 'error');
    }
  });
}

function initExportsSection() {
  const form = document.getElementById('exportReportForm');
  if (!form) return;

  // Defaults
  const today = new Date();
  document.getElementById('selectExportMonth').value = today.getMonth() + 1;
  document.getElementById('inputExportYear').value = today.getFullYear();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const month = document.getElementById('selectExportMonth').value;
    const year = document.getElementById('inputExportYear').value;
    const token = localStorage.getItem('token');

    // Trigger standard browser download by navigating to custom CSV endpoint containing query auth token
    const exportUrl = `${BACKEND_BASE_URL}/api/users/export-attendance?month=${month}&year=${year}&token=${token}`;
    window.location.href = exportUrl;
  });

  const btnPdf = document.getElementById('btnExportAttendancePdf');
  if (btnPdf) {
    btnPdf.addEventListener('click', async () => {
      const month = document.getElementById('selectExportMonth').value;
      const year = document.getElementById('inputExportYear').value;
      
      btnPdf.disabled = true;
      const originalText = btnPdf.innerText;
      btnPdf.innerText = 'Generating PDF...';
      try {
        await downloadAttendancePDF(month, year);
      } finally {
        btnPdf.disabled = false;
        btnPdf.innerText = originalText;
      }
    });
  }
}

/* ==========================================================================
   Utilities helpers
   ========================================================================== */

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Export HTML table to PDF using jsPDF and jsPDF-AutoTable
 */
function exportTableToPDF(tableId, filename, titleText) {
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(16);
    doc.setTextColor(11, 34, 64); // --primary-color (Steel Navy Blue)
    doc.text(titleText, 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // --text-secondary
    doc.text(`Generated on: ${new Date().toLocaleString('en-IN')}`, 14, 28);
    
    // Use autotable to render table, ignoring columns containing buttons/actions if present
    doc.autoTable({
      html: `#${tableId}`,
      startY: 32,
      theme: 'grid',
      headStyles: { fillColor: [11, 34, 64] }, // Steel Navy
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { top: 30 },
      didParseCell: function(data) {
        // Remove button elements text from output PDF cells
        if (data.cell.raw && data.cell.raw.innerHTML && data.cell.raw.innerHTML.includes('<button')) {
          data.cell.text = '';
        }
      }
    });
    
    doc.save(filename);
  } catch (err) {
    console.error('Failed to export PDF:', err);
    alert('Failed to generate PDF. Make sure jsPDF script dependencies are loaded.');
  }
}
window.exportTableToPDF = exportTableToPDF; // make it globally accessible

async function downloadAttendancePDF(month, year) {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${BACKEND_BASE_URL}/api/users/export-attendance?month=${month}&year=${year}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!response.ok) throw new Error('Failed to fetch attendance data.');
    const csvText = await response.text();
    
    // Parse CSV into rows and cells
    const rows = csvText.split('\n')
      .map(row => row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(cell => cell.replace(/^"|"$/g, '').trim()))
      .filter(row => row.length > 1 && row[0].toLowerCase() !== 'id'); // skip headers and empty rows
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(16);
    doc.setTextColor(11, 34, 64);
    doc.text(`UP Police Mess - Monthly Attendance Report (${month}/${year})`, 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on: ${new Date().toLocaleString('en-IN')}`, 14, 28);
    
    // AutoTable layout
    doc.autoTable({
      head: [['ID', 'Date', 'Officer Name', 'PNO', 'Rank', 'Posting Unit', 'Breakfast', 'Lunch', 'Dinner']],
      body: rows,
      startY: 32,
      theme: 'grid',
      headStyles: { fillColor: [11, 34, 64] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { top: 30 }
    });
    
    doc.save(`attendance_report_${month}_${year}.pdf`);
  } catch (err) {
    showNotification(`PDF export failed: ${err.message}`, 'error');
  }
}

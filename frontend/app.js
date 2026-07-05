/**
 * ==========================================================================
 * Mess Management Software - Frontend Scripts
 * ==========================================================================
 */

// Toggle backend API base URL for easy switching between Local and Production (Render)
const BACKEND_BASE_URL = "http://localhost:5000";

document.addEventListener('DOMContentLoaded', () => {
  console.log('>>> [INIT] Application initialized. Base URL:', BACKEND_BASE_URL);

  // Initialize page-specific scripts
  if (document.getElementById('registrationForm')) {
    initRegistrationPage();
  }
  
  if (document.getElementById('usersTable')) {
    initDataViewPage();
  }
});

/* ==========================================================================
   Voice Recognition / Speech API Helper
   ========================================================================== */

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const isSpeechSupported = !!SpeechRecognition;

/**
 * Attaches speech recognition to a target input and toggle button
 */
function setupVoiceField(buttonId, inputId) {
  const btn = document.getElementById(buttonId);
  const input = document.getElementById(inputId);
  
  if (!btn || !input) return;

  if (!isSpeechSupported) {
    // Hide mic dictation buttons if browser doesn't support Web Speech API
    btn.style.display = 'none';
    console.warn(`[Speech API] Speech recognition is not supported in this browser for #${inputId}`);
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    
    // Toggle active state
    if (btn.classList.contains('listening')) {
      recognition.stop();
      return;
    }

    // Stop other active listeners
    document.querySelectorAll('.mic-btn').forEach(button => {
      button.classList.remove('listening');
    });

    btn.classList.add('listening');
    showNotification('Listening...', 'info');
    
    try {
      recognition.start();
    } catch (err) {
      console.error('Speech Start Error:', err);
      btn.classList.remove('listening');
    }
  });

  recognition.onresult = (event) => {
    let transcript = event.results[0][0].transcript;
    console.log(`[Speech API] Results received for #${inputId}:`, transcript);
    
    // Clean trailing punctuation
    if (transcript.endsWith('.')) {
      transcript = transcript.slice(0, -1);
    }
    
    input.value = transcript;
    
    // Dispatch input event to notify search queries / filters
    input.dispatchEvent(new Event('input'));
    showNotification(`Recorded: "${transcript}"`, 'success', 2000);
  };

  recognition.onerror = (event) => {
    console.error(`[Speech API] Error on #${inputId}:`, event.error);
    if (event.error !== 'no-speech') {
      showNotification(`Voice error: ${event.error}`, 'error');
    }
    btn.classList.remove('listening');
  };

  recognition.onend = () => {
    btn.classList.remove('listening');
  };
}

/* ==========================================================================
   Page 1: Registration Form Logic (index.html)
   ========================================================================== */

function initRegistrationPage() {
  console.log('>>> [INIT] Setting up Registration page controllers...');

  // Setup voice fields
  setupVoiceField('btnMicName', 'inputName');
  setupVoiceField('btnMicPNO', 'inputPNO');
  setupVoiceField('btnMicMobile', 'inputMobile');

  const btnSendOtp = document.getElementById('btnSendOtp');
  const otpSection = document.getElementById('otpSection');
  const registrationForm = document.getElementById('registrationForm');

  // Trigger Send OTP code to email
  btnSendOtp.addEventListener('click', async (e) => {
    e.preventDefault();
    const emailInput = document.getElementById('inputEmail');
    const email = emailInput.value.trim();

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
        throw new Error(data.error || 'Failed to send OTP.');
      }

      showNotification(data.message || 'OTP successfully sent! Please check your inbox.', 'success');
      
      // Open OTP field section
      otpSection.style.display = 'block';
      document.getElementById('inputOtp').focus();
    } catch (err) {
      showNotification(err.message, 'error');
    } finally {
      btnSendOtp.disabled = false;
      btnSendOtp.innerText = 'Get OTP';
    }
  });

  // Submit entire registration details + OTP validation
  registrationForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // CRUCIAL: Prevent default page refresh on submit

    const name = document.getElementById('inputName').value.trim();
    const pno = document.getElementById('inputPNO').value.trim();
    const mobile = document.getElementById('inputMobile').value.trim();
    const email = document.getElementById('inputEmail').value.trim();
    const otp = document.getElementById('inputOtp').value.trim();

    if (!name || !pno || !mobile || !email || !otp) {
      showNotification('All fields, including the OTP, are required.', 'error');
      return;
    }

    const btnRegister = document.getElementById('btnRegister');
    btnRegister.disabled = true;
    btnRegister.innerText = 'Registering User...';

    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, pno, mobile, email, otp })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed.');
      }

      // Display a persistent success message
      showNotification('Registration successful! The record has been uploaded to database.', 'success', 0);
      
      // CRUCIAL: Do not clear, reset, or empty fields. Let them remain visible.
      console.log('>>> [SUCCESS] Registration completed. Inputs preserved as per request.');
    } catch (err) {
      showNotification(err.message, 'error');
      btnRegister.disabled = false;
      btnRegister.innerText = 'Verify OTP & Submit Record';
    }
  });
}

/* ==========================================================================
   Page 2: Data View & Exports Logic (view.html)
   ========================================================================== */

let allUsers = [];

function initDataViewPage() {
  console.log('>>> [INIT] Setting up Data View page controllers...');

  // Setup Voice search
  setupVoiceField('btnMicSearch', 'inputSearch');

  const searchInput = document.getElementById('inputSearch');
  const btnExportExcel = document.getElementById('btnExportExcel');
  const btnExportPdf = document.getElementById('btnExportPdf');

  // Fetch initial list of records
  fetchUsers();

  // Search input filter listener
  searchInput.addEventListener('input', () => {
    filterTableData(searchInput.value);
  });

  // Export buttons triggers
  btnExportExcel.addEventListener('click', () => exportToExcel());
  btnExportPdf.addEventListener('click', () => exportToPdf());
}

/**
 * Fetch all users list from API
 */
async function fetchUsers() {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/users`);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch users database.');
    }
    
    allUsers = await response.json();
    renderTableData(allUsers);
  } catch (err) {
    showNotification(`Error: ${err.message}`, 'error');
    const tableBody = document.getElementById('usersTableBody');
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--error); padding: 3rem;">
          ❌ Failed to load database: ${err.message}
        </td>
      </tr>
    `;
  }
}

/**
 * Render user rows into table body
 */
function renderTableData(users) {
  const tableBody = document.getElementById('usersTableBody');
  
  if (users.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 3rem;">
          No mess member records found.
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = users.map(user => {
    const regDate = new Date(user.createdAt).toLocaleString();
    return `
      <tr>
        <td data-label="ID">${user.id}</td>
        <td data-label="Name">${escapeHtml(user.name)}</td>
        <td data-label="PNO">${escapeHtml(user.pno)}</td>
        <td data-label="Mobile">${escapeHtml(user.mobile)}</td>
        <td data-label="Email">${escapeHtml(user.email)}</td>
        <td data-label="Registration Date">${regDate}</td>
      </tr>
    `;
  }).join('');
}

/**
 * Filter users based on query matching Name, PNO, Mobile or Email
 */
function filterTableData(query) {
  const cleanQuery = query.toLowerCase().trim();
  if (!cleanQuery) {
    renderTableData(allUsers);
    return;
  }

  const filtered = allUsers.filter(user => {
    return (
      user.name.toLowerCase().includes(cleanQuery) ||
      user.pno.toLowerCase().includes(cleanQuery) ||
      user.mobile.toLowerCase().includes(cleanQuery) ||
      user.email.toLowerCase().includes(cleanQuery)
    );
  });

  renderTableData(filtered);
}

/* ==========================================================================
   Exports Utilities
   ========================================================================== */

/**
 * Generates an Excel Sheet using SheetJS client-side
 */
function exportToExcel() {
  if (allUsers.length === 0) {
    showNotification('No records available to export.', 'error');
    return;
  }

  console.log('>>> [EXPORTS] Exporting to Excel...');
  const table = document.getElementById('usersTable');
  
  try {
    // Generate workbook directly from the rendered HTML table
    const wb = XLSX.utils.table_to_book(table, { sheet: "Mess Members" });
    XLSX.writeFile(wb, "Mess_Members_List.xlsx");
    showNotification('Excel sheet downloaded successfully!', 'success');
  } catch (err) {
    console.error('Excel Export Error:', err);
    showNotification('Failed to generate Excel export.', 'error');
  }
}

/**
 * Generates a PDF Document using jsPDF and AutoTable plugin
 */
function exportToPdf() {
  if (allUsers.length === 0) {
    showNotification('No records available to export.', 'error');
    return;
  }

  console.log('>>> [EXPORTS] Exporting to PDF...');
  
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // Add styling for document headers
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59); // Charcoal Slate
    doc.text("Mess Management System - Members Database", 14, 20);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // Muted Slate
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 27);
    
    // Render autotable structure
    doc.autoTable({
      html: '#usersTable',
      startY: 32,
      theme: 'grid',
      headStyles: {
        fillColor: [79, 70, 229], // Indigo
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252] // light greyish slate alternate rows
      },
      margin: { top: 32, left: 14, right: 14 }
    });
    
    doc.save("Mess_Members_List.pdf");
    showNotification('PDF document downloaded successfully!', 'success');
  } catch (err) {
    console.error('PDF Export Error:', err);
    showNotification('Failed to generate PDF document.', 'error');
  }
}

/* ==========================================================================
   Helper UI Utilities
   ========================================================================== */

/**
 * Display toast status messages
 */
function showNotification(text, type = 'info', duration = 5000) {
  const container = document.getElementById('statusMessage');
  if (!container) return;

  container.className = `message message-${type}`;
  container.innerHTML = `
    <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
    <div>${text}</div>
  `;
  container.style.display = 'flex';

  // Automatically fade out only if duration > 0 (for persistent success)
  if (duration > 0) {
    if (window.toastTimeout) clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(() => {
      container.style.display = 'none';
    }, duration);
  }
}

/**
 * Simple HTML sanitizer
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

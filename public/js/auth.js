/**
 * HostelCare Session & Auth Manager
 */

function getUser() {
  try {
    const raw = localStorage.getItem('hostelcare_user');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function getToken() {
  return localStorage.getItem('hostelcare_token');
}

function isLoggedIn() {
  return Boolean(getToken() && getUser());
}

function isStaff() {
  const user = getUser();
  return user && (user.role === 'staff' || user.role === 'admin');
}

function isTechnician() {
  const user = getUser();
  return user && user.role === 'technician';
}

function logout() {
  localStorage.removeItem('hostelcare_token');
  localStorage.removeItem('hostelcare_user');
  if (typeof showToast === 'function') {
    showToast('Logged out successfully.', 'info');
  }
  setTimeout(() => {
    window.location.href = '/login.html';
  }, 500);
}

function setSession(user, token) {
  localStorage.setItem('hostelcare_user', JSON.stringify(user));
  localStorage.setItem('hostelcare_token', token);
}

/**
 * Dynamically renders the universal navigation bar
 */
function renderNavbar() {
  const navContainer = document.getElementById('navbar-links');
  if (!navContainer) return;

  const currentPath = window.location.pathname;
  const user = getUser();
  const isHindi = localStorage.getItem('hostelcare_lang') === 'hi';

  if (!user) {
    // Guest Links: Show only Login option, Register completely removed
    navContainer.innerHTML = `
      <li><a href="/login.html" class="btn btn-primary btn-sm nav-login">Login</a></li>
    `;
  } else if (user.role === 'student') {
    // Student Links
    navContainer.innerHTML = `
      <li><a href="/student-dashboard.html" class="${currentPath === '/student-dashboard.html' ? 'active' : ''}">My Complaints</a></li>
      <li><a href="/lodge-complaint.html" class="${currentPath === '/lodge-complaint.html' ? 'active' : ''}">Lodge Request</a></li>
      <li><a href="/track.html" class="${currentPath === '/track.html' ? 'active' : ''}">Track Status</a></li>
      <li>
        <div class="user-badge">
          <span>${user.name.split(' ')[0]}</span>
          <span class="role-pill role-student">${user.room_no || 'Student'}</span>
        </div>
      </li>
      <li><button onclick="logout()" class="btn btn-secondary btn-sm">Logout</button></li>
    `;
  } else if (user.role === 'admin') {
    // Admin Links: Executive Overview, Rooms, Complaints, Staff & Techs, Students removed. Only Register Users displayed.
    navContainer.innerHTML = `
      <li><a href="/admin-dashboard.html#register" id="adminNavLinkRegister" class="${window.location.hash === '#register' ? 'active' : ''}">Register Users</a></li>
      <li>
        <div class="user-badge">
          <span>${user.name.split(' ')[0]}</span>
          <span class="role-pill" style="background:#fef3c7; color:#92400e; font-weight:700;">Admin</span>
        </div>
      </li>
      <li><button onclick="logout()" class="btn btn-secondary btn-sm">Logout</button></li>
    `;
  } else if (user.role === 'technician') {
    // Technician Links
    navContainer.innerHTML = `
      <li><a href="/technician-dashboard.html" class="${currentPath === '/technician-dashboard.html' ? 'active' : ''}">${isHindi ? 'असाइन की गई शिकायतें' : 'My Assigned Complaints'}</a></li>
      <li>
        <div class="user-badge">
          <span>${user.name.split(' ')[0]}</span>
          <span class="role-pill" style="background:#e0e7ff; color:#3730a3; font-weight:700;">Technician</span>
        </div>
      </li>
      <li><button onclick="logout()" class="btn btn-secondary btn-sm">Logout</button></li>
    `;
  } else {
    // Staff / Warden Links: Complaints Triage, Technicians, Analytics removed from navigation bar only.
    navContainer.innerHTML = `
      <li>
        <div class="user-badge">
          <span>${user.name.split(' ')[0]}</span>
          <span class="role-pill role-staff">${user.role === 'staff' ? 'Warden' : user.role}</span>
        </div>
      </li>
      <li><button onclick="logout()" class="btn btn-secondary btn-sm">Logout</button></li>
    `;
  }
}

// Ensure navbar is mounted on DOM load
document.addEventListener('DOMContentLoaded', renderNavbar);


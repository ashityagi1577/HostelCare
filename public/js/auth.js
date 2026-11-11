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

  if (!user) {
    // Guest Links
    navContainer.innerHTML = `
      <li><a href="/index.html" class="${currentPath === '/' || currentPath === '/index.html' ? 'active' : ''}">Home</a></li>
      <li><a href="/track.html" class="${currentPath === '/track.html' ? 'active' : ''}">Track Ticket</a></li>
      <li><a href="/login.html" class="btn btn-secondary btn-sm">Sign In</a></li>
      <li><a href="/register.html" class="btn btn-primary btn-sm">Register</a></li>
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
  } else {
    // Staff / Admin Links
    navContainer.innerHTML = `
      <li><a href="/staff-dashboard.html" class="${currentPath === '/staff-dashboard.html' ? 'active' : ''}">Complaints Triage</a></li>
      <li><a href="/staff-dashboard.html#technicians" class="">Technicians</a></li>
      <li><a href="/staff-dashboard.html#analytics" class="">Analytics</a></li>
      <li>
        <div class="user-badge">
          <span>${user.name.split(' ')[0]}</span>
          <span class="role-pill role-staff">${user.role}</span>
        </div>
      </li>
      <li><button onclick="logout()" class="btn btn-secondary btn-sm">Logout</button></li>
    `;
  }
}

// Ensure navbar is mounted on DOM load
document.addEventListener('DOMContentLoaded', renderNavbar);


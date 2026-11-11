/**
 * HostelCare Client API & Toast Notification Utilities
 */

// Global Toast Notification Helper
function showToast(message, type = 'info', duration = 4000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icon = type === 'success' ? '✔' : type === 'error' ? '✖' : type === 'warning' ? '⚠' : 'ℹ';
  toast.innerHTML = `<span style="font-weight: 700; font-size: 1.1rem;">${icon}</span><span>${message}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Client API Helper
async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('hostelcare_token');
  const headers = {
    ...(options.headers || {})
  };

  // Add Authorization header if user is logged in
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // If body is NOT FormData, set JSON Content-Type
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(endpoint, {
      ...options,
      headers
    });

    const data = await response.json().catch(() => ({}));

    // Session expired or unauthenticated
    if (response.status === 401 && !endpoint.includes('/api/auth/login')) {
      localStorage.removeItem('hostelcare_token');
      localStorage.removeItem('hostelcare_user');
      showToast('Session expired. Please log in again.', 'warning');
      setTimeout(() => {
        window.location.href = '/login.html';
      }, 1200);
      return { success: false, error: 'Unauthorized' };
    }

    if (!response.ok) {
      const errorMsg = data.error || data.message || `Request failed with status ${response.status}`;
      return { success: false, error: errorMsg, status: response.status };
    }

    return { success: true, ...data };
  } catch (err) {
    console.error(`[API Network Error] ${endpoint}:`, err);
    showToast('Network error. Unable to reach server.', 'error');
    return { success: false, error: 'Network error. Please check your connection.' };
  }
}


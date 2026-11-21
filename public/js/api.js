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
  const iconElement = document.createElement('span');
  iconElement.style.fontWeight = '700';
  iconElement.style.fontSize = '1.1rem';
  iconElement.textContent = icon;
  const messageElement = document.createElement('span');
  messageElement.textContent = message;
  toast.append(iconElement, messageElement);

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
      showToast(
        localStorage.getItem('hostelcare_lang') === 'hi'
          ? 'सत्र समाप्त हो गया है। कृपया फिर से लॉग इन करें।'
          : 'Session expired. Please log in again.',
        'warning'
      );
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
    const isHindi = localStorage.getItem('hostelcare_lang') === 'hi';
    const message = isHindi
      ? 'नेटवर्क त्रुटि। सर्वर से संपर्क नहीं हो सका।'
      : 'Network error. Unable to reach server.';
    showToast(message, 'error');
    return {
      success: false,
      error: isHindi
        ? 'नेटवर्क त्रुटि। कृपया अपना कनेक्शन जाँचें।'
        : 'Network error. Please check your connection.'
    };
  }
}


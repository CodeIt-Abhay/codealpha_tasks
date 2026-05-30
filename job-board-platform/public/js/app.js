// Global State
let currentUser = null;
let currentToken = localStorage.getItem('token') || null;
let activeView = 'landing';
let currentJobId = null;
let statusChartInstance = null;
let trendChartInstance = null;

// API Headers Helper
function getAuthHeaders(isMultipart = false) {
  const headers = {};
  if (currentToken) {
    headers['Authorization'] = `Bearer ${currentToken}`;
  }
  if (!isMultipart) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

// Toast Notification
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'info';
  if (type === 'success') icon = 'check-circle';
  if (type === 'error') icon = 'alert-triangle';

  toast.innerHTML = `<i data-lucide="${icon}"></i> <span>${message}</span>`;
  container.appendChild(toast);
  lucide.createIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Format Date
function formatDate(dateString) {
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return new Date(dateString).toLocaleDateString(undefined, options);
}

// Document Ready Setup
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

// App Initialization
async function initApp() {
  lucide.createIcons();
  setupEventListeners();
  setupTheme();

  if (currentToken) {
    await fetchCurrentUser();
  } else {
    updateNav();
    loadJobs();
  }
}

// Theme Setup
function setupTheme() {
  const themeToggle = document.getElementById('theme-toggle');
  const themeIconLight = document.getElementById('theme-icon-light');
  const themeIconDark = document.getElementById('theme-icon-dark');
  
  let theme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeIcons(theme);

  themeToggle.addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    updateThemeIcons(theme);
    
    // Refresh charts if visible to align colors
    if (currentUser && currentUser.role === 'employer' && activeView === 'employer-dashboard') {
      loadEmployerStats();
    }
  });
}

function updateThemeIcons(theme) {
  const themeIconLight = document.getElementById('theme-icon-light');
  const themeIconDark = document.getElementById('theme-icon-dark');
  if (theme === 'light') {
    themeIconLight.style.display = 'block';
    themeIconDark.style.display = 'none';
  } else {
    themeIconLight.style.display = 'none';
    themeIconDark.style.display = 'block';
  }
}

// Fetch Logged In User
async function fetchCurrentUser() {
  try {
    const res = await fetch('/api/auth/me', {
      headers: getAuthHeaders(),
    });
    
    if (res.ok) {
      currentUser = await res.json();
      updateNav();
      setupDashboardRouting();
      startNotificationPolling();
    } else {
      // Token invalid or expired
      logout();
    }
  } catch (err) {
    console.error('Error fetching user:', err);
    updateNav();
  }
  loadJobs();
}

// Log out
function logout() {
  currentUser = null;
  currentToken = null;
  localStorage.removeItem('token');
  
  // Hide UI blocks
  document.getElementById('nav-dashboard').style.display = 'none';
  document.getElementById('notif-trigger').style.display = 'none';
  document.getElementById('user-dropdown-container').style.display = 'none';
  document.getElementById('auth-nav-container').style.display = 'block';
  
  showToast('Logged out successfully', 'info');
  switchView('landing');
  loadJobs();
}

// Update Navigation items based on auth
function updateNav() {
  const authNavContainer = document.getElementById('auth-nav-container');
  const userDropdownContainer = document.getElementById('user-dropdown-container');
  const dashboardLink = document.getElementById('nav-dashboard');
  const notifTrigger = document.getElementById('notif-trigger');

  if (currentUser) {
    authNavContainer.style.display = 'none';
    userDropdownContainer.style.display = 'block';
    dashboardLink.style.display = 'block';
    notifTrigger.style.display = 'block';

    // Set Avatar initials & Name
    const name = currentUser.name;
    document.getElementById('user-display-name').textContent = name;
    
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    document.getElementById('user-avatar-initials').textContent = initials;
  } else {
    authNavContainer.style.display = 'block';
    userDropdownContainer.style.display = 'none';
    dashboardLink.style.display = 'none';
    notifTrigger.style.display = 'none';
  }
}

// Routing & View Switcher
function switchView(viewId) {
  activeView = viewId;
  
  // Close notif drawer
  document.getElementById('notifications-drawer').classList.remove('show');

  // Deactivate all views
  const views = ['landing', 'job-detail', 'candidate-dashboard', 'employer-dashboard'];
  views.forEach(v => {
    document.getElementById(`view-${v}`).classList.remove('active');
  });

  // Activate selected view
  const activeSection = document.getElementById(`view-${viewId}`);
  if (activeSection) {
    activeSection.classList.add('active');
  }

  // Update Nav Active Link Styling
  const navHome = document.getElementById('nav-home');
  const navDashboard = document.getElementById('nav-dashboard');

  navHome.classList.remove('active');
  navDashboard.classList.remove('active');

  if (viewId === 'landing') {
    navHome.classList.add('active');
  } else if (viewId.includes('dashboard')) {
    navDashboard.classList.add('active');
  }
}

// Setup Event Listeners
function setupEventListeners() {
  // Navigation Links
  document.getElementById('nav-logo').addEventListener('click', () => switchView('landing'));
  document.getElementById('nav-home').addEventListener('click', () => switchView('landing'));
  
  document.getElementById('nav-dashboard').addEventListener('click', () => {
    if (currentUser) {
      switchView(currentUser.role === 'candidate' ? 'candidate-dashboard' : 'employer-dashboard');
      triggerDashboardMenu(currentUser.role === 'candidate' ? 'profile' : 'overview');
    }
  });

  // Dropdown menus
  const profileTrigger = document.getElementById('user-profile-trigger');
  const dropdownMenu = document.getElementById('user-dropdown-menu');
  profileTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownMenu.classList.toggle('show');
  });

  document.addEventListener('click', () => {
    dropdownMenu.classList.remove('show');
  });

  document.getElementById('dropdown-dashboard-btn').addEventListener('click', () => {
    if (currentUser) {
      switchView(currentUser.role === 'candidate' ? 'candidate-dashboard' : 'employer-dashboard');
      triggerDashboardMenu(currentUser.role === 'candidate' ? 'profile' : 'overview');
    }
  });

  document.getElementById('dropdown-profile-btn').addEventListener('click', () => {
    if (currentUser) {
      switchView(currentUser.role === 'candidate' ? 'candidate-dashboard' : 'employer-dashboard');
      triggerDashboardMenu('profile');
    }
  });

  document.getElementById('dropdown-logout-btn').addEventListener('click', logout);

  // Auth Modal trigger buttons
  document.getElementById('btn-login-trigger').addEventListener('click', () => toggleAuthModal(true));
  document.getElementById('btn-close-auth-modal').addEventListener('click', () => toggleAuthModal(false));
  
  // Auth Modal tabs
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const formLogin = document.getElementById('auth-login-form');
  const formRegister = document.getElementById('auth-register-form');

  tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    formLogin.style.display = 'block';
    formRegister.style.display = 'none';
    document.getElementById('auth-modal-title').textContent = 'Welcome to TalentWave';
  });

  tabRegister.addEventListener('click', () => {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    formLogin.style.display = 'none';
    formRegister.style.display = 'block';
    document.getElementById('auth-modal-title').textContent = 'Create an Account';
  });

  // Submit Forms for Auth
  formLogin.addEventListener('submit', handleLogin);
  formRegister.addEventListener('submit', handleRegister);

  // Search Button
  document.getElementById('btn-search').addEventListener('click', loadJobs);
  document.getElementById('search-q').addEventListener('keyup', (e) => {
    if (e.key === 'Enter') loadJobs();
  });

  // Category Badges Filter
  const badges = document.querySelectorAll('.category-badges .badge');
  badges.forEach(badge => {
    badge.addEventListener('click', () => {
      badges.forEach(b => b.classList.remove('active'));
      badge.classList.add('active');
      const cat = badge.getAttribute('data-category');
      document.getElementById('search-q').value = cat === 'All' ? '' : cat;
      loadJobs();
    });
  });

  // Notification Drawer
  const notifTrigger = document.getElementById('notif-trigger');
  const notifDrawer = document.getElementById('notifications-drawer');
  notifTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    notifDrawer.classList.toggle('show');
    if (notifDrawer.classList.contains('show')) {
      fetchNotifications();
    }
  });

  document.addEventListener('click', (e) => {
    if (!notifDrawer.contains(e.target) && e.target !== notifTrigger && !notifTrigger.contains(e.target)) {
      notifDrawer.classList.remove('show');
    }
  });

  document.getElementById('btn-read-all-notifs').addEventListener('click', markAllNotificationsRead);

  // Back Buttons
  document.getElementById('btn-back-to-jobs').addEventListener('click', () => switchView('landing'));
  document.getElementById('btn-back-to-my-jobs').addEventListener('click', () => {
    document.getElementById('employer-job-applicants-view').style.display = 'none';
    document.getElementById('employer-jobs-overview').style.display = 'block';
  });
}

// Open/Close Auth Modal
function toggleAuthModal(show) {
  const modal = document.getElementById('auth-modal');
  if (show) {
    modal.classList.add('show');
  } else {
    modal.classList.remove('show');
  }
}

// Handle login submission
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (res.ok) {
      currentToken = data.token;
      currentUser = data.user;
      localStorage.setItem('token', data.token);

      showToast(`Welcome back, ${currentUser.name}!`);
      toggleAuthModal(false);
      updateNav();
      setupDashboardRouting();
      startNotificationPolling();

      // Reset form
      document.getElementById('auth-login-form').reset();

      // Switch to dashboard or stay on landing
      if (currentUser.role === 'employer') {
        switchView('employer-dashboard');
        triggerDashboardMenu('overview');
      } else {
        switchView('landing');
      }
    } else {
      showToast(data.error || 'Authentication failed', 'error');
    }
  } catch (err) {
    console.error('Login submit error:', err);
    showToast('Failed to connect to server', 'error');
  }
}

// Handle registration submission
async function handleRegister(e) {
  e.preventDefault();
  const role = document.querySelector('input[name="register-role"]:checked').value;
  const name = document.getElementById('register-name').value;
  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;

  if (password.length < 6) {
    return showToast('Password must be at least 6 characters long', 'error');
  }

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role }),
    });

    const data = await res.json();

    if (res.ok) {
      currentToken = data.token;
      currentUser = data.user;
      localStorage.setItem('token', data.token);

      showToast(`Account created successfully as a ${role}!`);
      toggleAuthModal(false);
      updateNav();
      setupDashboardRouting();
      startNotificationPolling();

      // Reset form
      document.getElementById('auth-register-form').reset();

      if (currentUser.role === 'employer') {
        switchView('employer-dashboard');
        triggerDashboardMenu('profile'); // Let them finish company profile
      } else {
        switchView('candidate-dashboard');
        triggerDashboardMenu('profile');
      }
    } else {
      showToast(data.error || 'Registration failed', 'error');
    }
  } catch (err) {
    console.error('Registration submit error:', err);
    showToast('Failed to connect to server', 'error');
  }
}

// Load jobs and render lists
async function loadJobs() {
  const q = document.getElementById('search-q').value;
  const location = document.getElementById('search-location').value;
  const jobType = document.getElementById('search-type').value;

  let url = `/api/jobs?`;
  if (q) url += `q=${encodeURIComponent(q)}&`;
  if (location && location !== 'All') url += `location=${encodeURIComponent(location)}&`;
  if (jobType && jobType !== 'All') url += `jobType=${encodeURIComponent(jobType)}&`;

  try {
    const res = await fetch(url);
    const jobs = await res.json();

    const jobsContainer = document.getElementById('jobs-list-container');
    if (!res.ok) {
      jobsContainer.innerHTML = `<div class="glass" style="padding: 24px; text-align: center; color: var(--danger);">Error loading job listings.</div>`;
      return;
    }

    if (jobs.length === 0) {
      jobsContainer.innerHTML = `
        <div class="glass" style="padding: 40px; text-align: center;">
          <i data-lucide="info" style="width: 48px; height: 48px; color: var(--text-secondary); margin-bottom: 12px;"></i>
          <p style="color: var(--text-secondary);">No job listings match your query. Try searching something else!</p>
        </div>`;
      lucide.createIcons();
      return;
    }

    jobsContainer.innerHTML = jobs.map(job => {
      const companyName = job.employer?.profile?.companyName || 'Unknown Company';
      const logoText = job.employer?.profile?.companyLogo || companyName.substring(0, 2).toUpperCase();
      
      let logoHTML = '';
      if (logoText.startsWith('http') || logoText.startsWith('/uploads')) {
        logoHTML = `<img src="${logoText}" class="company-logo-img" alt="${companyName}">`;
      } else {
        logoHTML = logoText.substring(0, 4);
      }

      return `
        <div class="job-card glass" onclick="viewJobDetails(${job.id})">
          <div class="job-card-main">
            <div class="company-logo-placeholder">
              ${logoHTML}
            </div>
            <div class="job-details">
              <h3 class="job-title">${escapeHTML(job.title)}</h3>
              <div class="job-company">${escapeHTML(companyName)}</div>
              <div class="job-meta-row">
                <span class="job-meta-item"><i data-lucide="map-pin" style="width: 14px; height: 14px;"></i> ${escapeHTML(job.location)}</span>
                <span class="job-meta-item"><i data-lucide="clock" style="width: 14px; height: 14px;"></i> ${formatDate(job.createdAt)}</span>
              </div>
            </div>
          </div>
          <div class="job-card-actions">
            <div class="job-salary">${escapeHTML(job.salaryRange || 'Competitive')}</div>
            <span class="job-type-pill">${escapeHTML(job.jobType)}</span>
          </div>
        </div>
      `;
    }).join('');

    lucide.createIcons();
  } catch (err) {
    console.error('Error fetching jobs:', err);
  }
}

// View job details by ID
async function viewJobDetails(id) {
  switchView('job-detail');
  const container = document.getElementById('job-detail-content');
  container.innerHTML = `
    <div class="glass" style="padding: 40px; text-align: center;">
      <i data-lucide="loader-2" style="width: 48px; height: 48px; animation: spin 1.5s linear infinite; color: var(--primary); margin-bottom: 12px;"></i>
      <p>Loading position details...</p>
    </div>`;
  lucide.createIcons();

  try {
    const res = await fetch(`/api/jobs/${id}`);
    const job = await res.json();

    if (!res.ok) {
      container.innerHTML = `<div class="glass" style="padding: 30px; text-align: center; color: var(--danger);">${job.error || 'Failed to load details'}</div>`;
      return;
    }

    currentJobId = job.id;
    const company = job.employer?.profile?.companyName || 'Company';
    const logoText = job.employer?.profile?.companyLogo || company.substring(0, 2).toUpperCase();
    
    let logoHTML = '';
    if (logoText.startsWith('http') || logoText.startsWith('/uploads')) {
      logoHTML = `<img src="${logoText}" class="company-logo-img" alt="${company}">`;
    } else {
      logoHTML = logoText.substring(0, 4);
    }

    const reqs = job.requirements ? job.requirements.split('\n').filter(r => r.trim() !== '') : [];

    let actionSectionHTML = '';
    if (!currentUser) {
      actionSectionHTML = `
        <div class="glass job-detail-sidebar">
          <h3 class="detail-section-title">Interested?</h3>
          <p style="color: var(--text-secondary); font-size: 0.92rem; margin-bottom: 16px;">Sign in to your candidate account to apply for this job listing.</p>
          <button class="btn btn-primary" onclick="toggleAuthModal(true)" style="width: 100%;">Sign In to Apply</button>
        </div>`;
    } else if (currentUser.role === 'candidate') {
      actionSectionHTML = `
        <div class="glass job-detail-sidebar">
          <h3 class="detail-section-title">Quick Apply</h3>
          <form id="apply-job-form">
            <div class="form-group">
              <label for="apply-cover-letter">Cover Letter (Optional)</label>
              <textarea class="form-control" id="apply-cover-letter" placeholder="Why are you a good fit for this role?" style="min-height: 80px;"></textarea>
            </div>
            <div class="form-group">
              <label for="apply-resume">Resume File (PDF/Doc, Max 5MB)</label>
              <input type="file" class="form-control" id="apply-resume">
              <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">Leave blank to use the resume in your profile settings.</p>
            </div>
            <button type="submit" class="btn btn-accent" style="width: 100%;">Submit Application</button>
          </form>
        </div>`;
    } else {
      // Employer
      actionSectionHTML = `
        <div class="glass job-detail-sidebar">
          <h3 class="detail-section-title">Employer View</h3>
          <p style="color: var(--text-secondary); font-size: 0.9rem;">You are viewing this listing as an employer.</p>
          ${job.employerId === currentUser.id ? `
            <button class="btn btn-primary" onclick="manageEmployerJobApplicants(${job.id}, '${escapeQuote(job.title)}')" style="width: 100%; margin-top: 12px;">View Candidates</button>
          ` : ''}
        </div>`;
    }

    container.innerHTML = `
      <div class="glass job-detail-header" style="display: flex; justify-content: space-between; align-items: center; gap: 20px; flex-wrap: wrap;">
        <div style="display: flex; gap: 20px; align-items: center;">
          <div class="company-logo-placeholder" style="width: 64px; height: 64px; font-size: 1.5rem;">
            ${logoHTML}
          </div>
          <div>
            <h2 style="font-size: 2rem; margin-bottom: 4px;">${escapeHTML(job.title)}</h2>
            <div style="color: var(--primary); font-weight: 600; font-size: 1.1rem;">${escapeHTML(company)}</div>
          </div>
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
          <div style="font-size: 1.4rem; font-weight: 700; color: var(--accent); font-family: var(--font-display);">${escapeHTML(job.salaryRange || 'Competitive')}</div>
          <div style="display: flex; gap: 10px;">
            <span class="job-type-pill">${escapeHTML(job.jobType)}</span>
            <span class="badge" style="background: rgba(255, 255, 255, 0.05); cursor: default;">${escapeHTML(job.location)}</span>
          </div>
        </div>
      </div>

      <div class="job-detail-body">
        <div class="glass job-detail-main">
          <div>
            <h3 class="detail-section-title">Job Description</h3>
            <p style="white-space: pre-line; color: var(--text-secondary);">${escapeHTML(job.description)}</p>
          </div>

          ${reqs.length > 0 ? `
            <div>
              <h3 class="detail-section-title">Requirements</h3>
              <ul class="requirements-list">
                ${reqs.map(r => `<li style="color: var(--text-secondary);">${escapeHTML(r)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          
          <div>
            <h3 class="detail-section-title">About the Company</h3>
            <p style="color: var(--text-secondary); white-space: pre-line;">${escapeHTML(job.employer?.profile?.bio || 'No details provided.')}</p>
          </div>
        </div>

        ${actionSectionHTML}
      </div>
    `;

    lucide.createIcons();

    // Hook Form Submit
    if (currentUser && currentUser.role === 'candidate') {
      document.getElementById('apply-job-form').addEventListener('submit', submitApplication);
    }
  } catch (err) {
    console.error('Load job details error:', err);
    container.innerHTML = `<div class="glass" style="padding: 30px; text-align: center; color: var(--danger);">Network error loading details</div>`;
  }
}

// Submit Application
async function submitApplication(e) {
  e.preventDefault();
  const coverLetter = document.getElementById('apply-cover-letter').value;
  const fileInput = document.getElementById('apply-resume');

  const formData = new FormData();
  formData.append('jobListingId', currentJobId);
  formData.append('coverLetter', coverLetter);
  
  if (fileInput.files.length > 0) {
    formData.append('resume', fileInput.files[0]);
  }

  try {
    const res = await fetch('/api/applications', {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: formData,
    });

    const data = await res.json();

    if (res.ok) {
      showToast('Application submitted successfully!', 'success');
      viewJobDetails(currentJobId); // Refresh details
    } else {
      showToast(data.error || 'Failed to submit application', 'error');
    }
  } catch (err) {
    console.error('Submit application error:', err);
    showToast('Failed to submit application due to network error', 'error');
  }
}

// Setup Dashboard routing handles
function setupDashboardRouting() {
  if (!currentUser) return;

  if (currentUser.role === 'candidate') {
    // Menu links for candidate
    const tabs = ['profile', 'apps'];
    tabs.forEach(tab => {
      document.getElementById(`c-menu-${tab}`).className = 'sidebar-link';
      document.getElementById(`c-tab-${tab}`).style.display = 'none';
      
      document.getElementById(`c-menu-${tab}`).addEventListener('click', () => triggerDashboardMenu(tab));
    });
  } else {
    // Employer Dashboard
    const tabs = ['overview', 'jobs', 'post', 'profile'];
    tabs.forEach(tab => {
      document.getElementById(`e-menu-${tab}`).className = 'sidebar-link';
      document.getElementById(`e-tab-${tab}`).style.display = 'none';

      document.getElementById(`e-menu-${tab}`).addEventListener('click', () => triggerDashboardMenu(tab));
    });

    // Form submits
    document.getElementById('employer-post-job-form').addEventListener('submit', handlePostJobSubmit);
    document.getElementById('employer-profile-form').addEventListener('submit', handleEmployerProfileSubmit);
  }

  // Profile Form candidate hook
  if (currentUser.role === 'candidate') {
    document.getElementById('candidate-profile-form').addEventListener('submit', handleCandidateProfileSubmit);
  }
}

// Trigger Dashboard Menu Tab
function triggerDashboardMenu(tab) {
  if (!currentUser) return;
  const prefix = currentUser.role === 'candidate' ? 'c' : 'e';

  // Clear active menu items
  const menuLinks = document.querySelectorAll(`.${prefix}-menu .sidebar-link`);
  menuLinks.forEach(l => l.classList.remove('active'));

  // Hide all tab contents
  const tabContents = document.querySelectorAll(`.${prefix}-tab-content`);
  tabContents.forEach(t => t.style.display = 'none');

  // Set active link & visible tab
  document.getElementById(`${prefix}-menu-${tab}`).classList.add('active');
  document.getElementById(`${prefix}-tab-${tab}`).style.display = 'block';

  // Load contextual data
  if (currentUser.role === 'candidate') {
    if (tab === 'profile') {
      populateCandidateProfileFields();
    } else if (tab === 'apps') {
      loadCandidateApplications();
    }
  } else {
    if (tab === 'overview') {
      loadEmployerStats();
    } else if (tab === 'jobs') {
      loadEmployerJobs();
    } else if (tab === 'post') {
      document.getElementById('employer-post-job-form').reset();
    } else if (tab === 'profile') {
      populateEmployerProfileFields();
    }
  }
}

// Populate Candidate Profile Fields
function populateCandidateProfileFields() {
  if (!currentUser) return;
  const profile = currentUser.profile || {};

  document.getElementById('c-profile-name').textContent = currentUser.name;
  document.getElementById('c-profile-title-display').textContent = profile.title || 'Add professional title';
  document.getElementById('c-profile-name-input').value = currentUser.name;
  document.getElementById('c-profile-title-input').value = profile.title || '';
  document.getElementById('c-profile-bio-input').value = profile.bio || '';
  document.getElementById('c-profile-skills-input').value = profile.skills || '';
  
  // Set avatar initials
  const initials = currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  document.getElementById('c-profile-avatar-initials').textContent = initials;

  // Skills tag render
  const skillsContainer = document.getElementById('c-profile-skills-display');
  if (profile.skills) {
    skillsContainer.innerHTML = profile.skills.split(',').map(s => `<span class="skill-tag">${escapeHTML(s.trim())}</span>`).join('');
  } else {
    skillsContainer.innerHTML = '<span style="color: var(--text-muted); font-size: 0.88rem;">No skills added yet</span>';
  }

  // Resume status
  const resumeStatus = document.getElementById('c-profile-resume-status');
  if (profile.resumePath) {
    const filename = profile.resumePath.split('/').pop();
    resumeStatus.innerHTML = `Current Resume: <a href="${profile.resumePath}" target="_blank" class="btn btn-secondary btn-sm" style="display: inline-flex; margin-left: 8px;"><i data-lucide="download" style="width: 14px;"></i> Download (${filename})</a>`;
    lucide.createIcons();
  } else {
    resumeStatus.textContent = 'No resume uploaded yet.';
  }
}

// Submit Candidate Profile Changes
async function handleCandidateProfileSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('c-profile-name-input').value;
  const title = document.getElementById('c-profile-title-input').value;
  const bio = document.getElementById('c-profile-bio-input').value;
  const skills = document.getElementById('c-profile-skills-input').value;
  const fileInput = document.getElementById('c-profile-resume-input');

  const formData = new FormData();
  formData.append('name', name);
  formData.append('title', title);
  formData.append('bio', bio);
  formData.append('skills', skills);

  if (fileInput.files.length > 0) {
    formData.append('resume', fileInput.files[0]);
  }

  try {
    const res = await fetch('/api/profiles', {
      method: 'PUT',
      headers: getAuthHeaders(true),
      body: formData,
    });

    const data = await res.json();

    if (res.ok) {
      currentUser = data; // Update user object
      showToast('Profile updated successfully!', 'success');
      populateCandidateProfileFields();
      updateNav();
      fileInput.value = ''; // Reset file input
    } else {
      showToast(data.error || 'Failed to update profile', 'error');
    }
  } catch (err) {
    console.error('Update profile error:', err);
    showToast('Failed to update profile due to network error', 'error');
  }
}

// Load Candidate Applications Timeline
async function loadCandidateApplications() {
  const container = document.getElementById('candidate-applications-list');
  container.innerHTML = `<div style="text-align: center; padding: 20px;"><i data-lucide="loader-2" style="animation: spin 1s linear infinite;"></i> Loading application list...</div>`;
  lucide.createIcons();

  try {
    const res = await fetch('/api/applications', {
      headers: getAuthHeaders(),
    });
    const apps = await res.json();

    if (!res.ok) {
      container.innerHTML = `<div class="glass" style="padding: 20px; color: var(--danger); text-align: center;">Failed to load applications.</div>`;
      return;
    }

    if (apps.length === 0) {
      container.innerHTML = `
        <div class="glass" style="padding: 30px; text-align: center;">
          <i data-lucide="info" style="width: 44px; color: var(--text-muted); margin-bottom: 12px;"></i>
          <p style="color: var(--text-secondary);">You haven't submitted any job applications yet.</p>
        </div>`;
      lucide.createIcons();
      return;
    }

    container.innerHTML = apps.map(app => {
      const job = app.job || {};
      const company = job.employer?.profile?.companyName || 'Company';
      const statusClass = `status-${app.status.toLowerCase()}`;

      return `
        <div class="glass app-card">
          <div>
            <h3 style="font-size: 1.15rem; margin-bottom: 4px;">${escapeHTML(job.title || 'Unknown Position')}</h3>
            <div style="color: var(--primary); font-weight: 500; margin-bottom: 8px;">${escapeHTML(company)}</div>
            <div style="font-size: 0.85rem; color: var(--text-secondary);">Applied on ${formatDate(app.createdAt)}</div>
          </div>
          <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 10px;">
            <span class="app-status ${statusClass}">${escapeHTML(app.status)}</span>
            <a href="${escapeHTML(app.resumePath)}" target="_blank" class="btn btn-secondary btn-sm" style="display: inline-flex;"><i data-lucide="download" style="width: 14px;"></i> Download PDF</a>
          </div>
        </div>
      `;
    }).join('');

    lucide.createIcons();
  } catch (err) {
    console.error('Load applications error:', err);
  }
}

// Populate Employer Profile Settings
function populateEmployerProfileFields() {
  if (!currentUser) return;
  const profile = currentUser.profile || {};

  document.getElementById('e-profile-name-input').value = currentUser.name;
  document.getElementById('e-profile-company-input').value = profile.companyName || '';
  document.getElementById('e-profile-website-input').value = profile.companyWebsite || '';
  
  // Set logo text input (exclude image path string to keep it clean)
  const logoText = profile.companyLogo || '';
  document.getElementById('e-profile-logo-input').value = logoText.startsWith('/uploads') ? '' : logoText;
  document.getElementById('e-profile-bio-input').value = profile.bio || '';
}

// Handle Employer Profile Submit
async function handleEmployerProfileSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('e-profile-name-input').value;
  const companyName = document.getElementById('e-profile-company-input').value;
  const companyWebsite = document.getElementById('e-profile-website-input').value;
  const companyLogoText = document.getElementById('e-profile-logo-input').value;
  const logoFileInput = document.getElementById('e-profile-logo-file');

  const formData = new FormData();
  formData.append('name', name);
  formData.append('companyName', companyName);
  formData.append('companyWebsite', companyWebsite);
  formData.append('companyLogoText', companyLogoText);

  if (logoFileInput.files.length > 0) {
    formData.append('logo', logoFileInput.files[0]);
  }

  try {
    const res = await fetch('/api/profiles', {
      method: 'PUT',
      headers: getAuthHeaders(true),
      body: formData,
    });

    const data = await res.json();

    if (res.ok) {
      currentUser = data; // Update user object
      showToast('Company profile details saved!', 'success');
      populateEmployerProfileFields();
      updateNav();
      logoFileInput.value = ''; // Reset upload file
    } else {
      showToast(data.error || 'Failed to update details', 'error');
    }
  } catch (err) {
    console.error('Update employer details error:', err);
    showToast('Failed to update company details', 'error');
  }
}

// Handle Post Job Submit
async function handlePostJobSubmit(e) {
  e.preventDefault();
  const title = document.getElementById('job-title-input').value;
  const location = document.getElementById('job-location-input').value;
  const jobType = document.getElementById('job-type-input').value;
  const salaryRange = document.getElementById('job-salary-input').value;
  const description = document.getElementById('job-description-input').value;
  const requirements = document.getElementById('job-requirements-input').value;

  try {
    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ title, location, jobType, salaryRange, description, requirements }),
    });

    const data = await res.json();

    if (res.ok) {
      showToast(`Published job listing "${title}"!`, 'success');
      document.getElementById('employer-post-job-form').reset();
      triggerDashboardMenu('jobs'); // Redirect to manage listings
    } else {
      showToast(data.error || 'Failed to publish job', 'error');
    }
  } catch (err) {
    console.error('Post job submit error:', err);
    showToast('Failed to connect to server', 'error');
  }
}

// Load Employer Listings
async function loadEmployerJobs() {
  const container = document.getElementById('employer-jobs-list');
  container.innerHTML = `<div style="text-align: center; padding: 20px;"><i data-lucide="loader-2" style="animation: spin 1s linear infinite;"></i> Loading listings...</div>`;
  lucide.createIcons();

  try {
    const res = await fetch('/api/jobs/my-listings', {
      headers: getAuthHeaders(),
    });
    const jobs = await res.json();

    if (!res.ok) {
      container.innerHTML = `<div class="glass" style="padding: 20px; color: var(--danger); text-align: center;">Failed to retrieve active job listings.</div>`;
      return;
    }

    if (jobs.length === 0) {
      container.innerHTML = `
        <div class="glass" style="padding: 30px; text-align: center;">
          <i data-lucide="info" style="width: 44px; color: var(--text-muted); margin-bottom: 12px;"></i>
          <p style="color: var(--text-secondary);">You haven't posted any jobs yet. Head over to the 'Post New Job' tab!</p>
        </div>`;
      lucide.createIcons();
      return;
    }

    // Get applicant counts per listing from stat API if possible
    const statsRes = await fetch('/api/stats/employer', { headers: getAuthHeaders() });
    let applicantCounts = {};
    if (statsRes.ok) {
      const stats = await statsRes.json();
      stats.jobsBreakdown.forEach(j => {
        applicantCounts[j.id] = j.applicationCount;
      });
    }

    container.innerHTML = jobs.map(job => {
      const count = applicantCounts[job.id] || 0;
      const statusPillClass = job.status === 'Open' ? 'status-accepted' : 'status-rejected';

      return `
        <div class="glass job-card" onclick="manageEmployerJobApplicants(${job.id}, '${escapeQuote(job.title)}')">
          <div class="job-card-main">
            <div class="job-details">
              <h3 class="job-title">${escapeHTML(job.title)}</h3>
              <div class="job-meta-row">
                <span class="job-meta-item"><i data-lucide="map-pin" style="width: 14px; height: 14px;"></i> ${escapeHTML(job.location)}</span>
                <span class="job-meta-item"><i data-lucide="calendar" style="width: 14px; height: 14px;"></i> Posted on ${formatDate(job.createdAt)}</span>
              </div>
            </div>
          </div>
          <div class="job-card-actions">
            <span class="app-status ${statusPillClass}" style="margin-bottom: 4px;">Status: ${escapeHTML(job.status)}</span>
            <span class="btn btn-primary btn-sm" style="display: inline-flex; gap: 6px;">
              <i data-lucide="users" style="width: 14px;"></i> View Applicants 
              <span class="badge" style="background: rgba(255,255,255,0.25); color: #fff; padding: 2px 6px; border-radius: 50%; font-size: 0.75rem; margin-left: 2px;">${count}</span>
            </span>
          </div>
        </div>
      `;
    }).join('');

    lucide.createIcons();
  } catch (err) {
    console.error('Load employer jobs error:', err);
  }
}

// Show Specific Job Applicants Review Manager
async function manageEmployerJobApplicants(jobId, jobTitle) {
  switchView('employer-dashboard');
  triggerDashboardMenu('jobs');

  document.getElementById('employer-jobs-overview').style.display = 'none';
  const detailView = document.getElementById('employer-job-applicants-view');
  detailView.style.display = 'block';
  
  document.getElementById('applicant-view-job-title').textContent = `Applicants for "${jobTitle}"`;
  
  const container = document.getElementById('applicants-list-container');
  container.innerHTML = `<div style="text-align: center; padding: 20px;"><i data-lucide="loader-2" style="animation: spin 1s linear infinite;"></i> Loading applications...</div>`;
  lucide.createIcons();

  try {
    const res = await fetch('/api/applications', {
      headers: getAuthHeaders(),
    });
    const apps = await res.json();

    if (!res.ok) {
      container.innerHTML = `<div class="glass" style="padding: 20px; color: var(--danger); text-align: center;">Failed to load candidate list.</div>`;
      return;
    }

    // Filter applicants that match this jobId
    const filteredApps = apps.filter(app => app.jobListingId === jobId);

    if (filteredApps.length === 0) {
      container.innerHTML = `
        <div class="glass" style="padding: 40px; text-align: center;">
          <i data-lucide="users-2" style="width: 48px; height: 48px; color: var(--text-muted); margin-bottom: 12px;"></i>
          <p style="color: var(--text-secondary);">No applications received for this job listing yet.</p>
        </div>`;
      lucide.createIcons();
      return;
    }

    container.innerHTML = filteredApps.map(app => {
      const cand = app.candidate || {};
      const profile = cand.profile || {};
      const statusClass = `status-${app.status.toLowerCase()}`;

      const skillsHTML = profile.skills ? profile.skills.split(',').map(s => `<span class="skill-tag">${escapeHTML(s.trim())}</span>`).join('') : '<span style="color: var(--text-muted); font-size: 0.8rem;">No skills specified</span>';

      return `
        <div class="glass" style="padding: 24px; display: flex; flex-direction: column; gap: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap;">
            <div>
              <h3 style="font-size: 1.3rem; margin-bottom: 4px;">${escapeHTML(cand.name)}</h3>
              <div style="color: var(--primary); font-weight: 500; font-size: 0.95rem; margin-bottom: 8px;">${escapeHTML(profile.title || 'Candidate Profile')}</div>
              <div style="margin-top: 4px;">${skillsHTML}</div>
            </div>
            <div style="display: flex; gap: 12px; align-items: center;">
              <span class="app-status ${statusClass}" id="app-status-badge-${app.id}">${escapeHTML(app.status)}</span>
              <div class="form-group" style="margin-bottom: 0;">
                <select class="form-control" style="padding: 6px 12px; font-size: 0.85rem;" onchange="updateApplicationStatus(${app.id}, this.value)">
                  <option value="Applied" ${app.status === 'Applied' ? 'selected' : ''}>Applied</option>
                  <option value="Reviewing" ${app.status === 'Reviewing' ? 'selected' : ''}>Reviewing</option>
                  <option value="Accepted" ${app.status === 'Accepted' ? 'selected' : ''}>Accepted</option>
                  <option value="Rejected" ${app.status === 'Rejected' ? 'selected' : ''}>Rejected</option>
                </select>
              </div>
            </div>
          </div>

          <div style="background: rgba(0, 0, 0, 0.1); border-radius: var(--radius-sm); border: 1px solid var(--border-color); padding: 16px; font-size: 0.92rem; color: var(--text-secondary);">
            <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 6px; font-family: var(--font-display);">Cover Letter:</div>
            <p style="white-space: pre-line;">${escapeHTML(app.coverLetter || 'No cover letter provided.')}</p>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div style="font-size: 0.82rem; color: var(--text-muted);">Applied on ${formatDate(app.createdAt)}</div>
            <a href="${escapeHTML(app.resumePath)}" target="_blank" class="btn btn-secondary btn-sm" style="display: inline-flex;"><i data-lucide="download" style="width: 14px;"></i> Download Resume PDF</a>
          </div>
        </div>
      `;
    }).join('');

    lucide.createIcons();
  } catch (err) {
    console.error('Retrieve applicants error:', err);
  }
}

// Update Application Status (Triggered from dropdown in dashboard)
async function updateApplicationStatus(appId, newStatus) {
  try {
    const res = await fetch(`/api/applications/${appId}/status`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status: newStatus }),
    });

    const data = await res.json();

    if (res.ok) {
      showToast(`Application status updated to "${newStatus}"`, 'success');
      
      // Update badge UI inline immediately
      const badge = document.getElementById(`app-status-badge-${appId}`);
      if (badge) {
        badge.className = `app-status status-${newStatus.toLowerCase()}`;
        badge.textContent = newStatus;
      }
    } else {
      showToast(data.error || 'Failed to update status', 'error');
    }
  } catch (err) {
    console.error('Update status error:', err);
    showToast('Failed to update status due to network error', 'error');
  }
}

// Load Employer Stats & Render Charts
async function loadEmployerStats() {
  try {
    const res = await fetch('/api/stats/employer', {
      headers: getAuthHeaders(),
    });
    const data = await res.json();

    if (!res.ok) {
      showToast('Failed to load reporting stats', 'error');
      return;
    }

    // Populate counts
    document.getElementById('stat-total-jobs').textContent = data.summary.totalJobs;
    document.getElementById('stat-open-jobs').textContent = data.summary.openJobs;
    document.getElementById('stat-total-apps').textContent = data.summary.totalApplications;

    // Theme responsive values
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#f3f4f6' : '#0f172a';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';

    // Render Doughnut Chart (Status Breakdown)
    const statusCtx = document.getElementById('chart-status-pie').getContext('2d');
    
    if (statusChartInstance) {
      statusChartInstance.destroy();
    }

    const statusCounts = data.statusBreakdown;
    const hasData = Object.values(statusCounts).some(v => v > 0);

    statusChartInstance = new Chart(statusCtx, {
      type: 'doughnut',
      data: {
        labels: ['Applied', 'Reviewing', 'Accepted', 'Rejected'],
        datasets: [{
          data: hasData ? [statusCounts.Applied, statusCounts.Reviewing, statusCounts.Accepted, statusCounts.Rejected] : [1, 0, 0, 0],
          backgroundColor: hasData ? ['#6366f1', '#f59e0b', '#10b981', '#ef4444'] : ['rgba(255, 255, 255, 0.08)'],
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: textColor,
              font: { family: 'Outfit', size: 12 },
              padding: 15,
            },
          },
          tooltip: {
            enabled: hasData,
          },
        },
      },
    });

    // Render Line Chart (Trend)
    const trendCtx = document.getElementById('chart-applications-line').getContext('2d');
    
    if (trendChartInstance) {
      trendChartInstance.destroy();
    }

    const dates = data.timelineTrend.map(t => formatDate(t.date));
    const counts = data.timelineTrend.map(t => t.count);

    trendChartInstance = new Chart(trendCtx, {
      type: 'line',
      data: {
        labels: dates.length > 0 ? dates : ['No Data'],
        datasets: [{
          label: 'Applications',
          data: counts.length > 0 ? counts : [0],
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          fill: true,
          tension: 0.4,
          borderWidth: 2,
          pointBackgroundColor: '#6366f1',
          pointRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: { color: textColor, font: { family: 'Inter', size: 10 } },
          },
          y: {
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              font: { family: 'Inter', size: 10 },
              stepSize: 1,
              precision: 0,
            },
            min: 0,
          },
        },
        plugins: {
          legend: { display: false },
        },
      },
    });
  } catch (err) {
    console.error('Error rendering reporting charts:', err);
  }
}

// Notifications Drawer Fetch & Render
async function fetchNotifications() {
  const container = document.getElementById('notifications-list');

  try {
    const res = await fetch('/api/notifications', {
      headers: getAuthHeaders(),
    });
    const notifs = await res.json();

    if (!res.ok) return;

    if (notifs.length === 0) {
      container.innerHTML = `<p style="text-align: center; color: var(--text-muted); font-size: 0.9rem; padding: 20px;">No notifications</p>`;
      updateNotificationBadge(false);
      return;
    }

    // Check if any are unread to display badge
    const hasUnread = notifs.some(n => !n.isRead);
    updateNotificationBadge(hasUnread);

    container.innerHTML = notifs.map(n => {
      return `
        <div class="notification-item ${n.isRead ? '' : 'unread'}" onclick="readNotification(${n.id})">
          <p>${escapeHTML(n.message)}</p>
          <span class="notification-time">${formatDate(n.createdAt)}</span>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Fetch notifications error:', err);
  }
}

// Read single notification
async function readNotification(id) {
  try {
    const res = await fetch(`/api/notifications/${id}/read`, {
      method: 'PUT',
      headers: getAuthHeaders(),
    });

    if (res.ok) {
      fetchNotifications(); // Refresh drawer
    }
  } catch (err) {
    console.error('Read notification error:', err);
  }
}

// Mark all read
async function markAllNotificationsRead() {
  try {
    const res = await fetch('/api/notifications/read-all', {
      method: 'PUT',
      headers: getAuthHeaders(),
    });

    if (res.ok) {
      showToast('All notifications marked as read', 'info');
      fetchNotifications();
    }
  } catch (err) {
    console.error('Mark all read error:', err);
  }
}

function updateNotificationBadge(show) {
  const badge = document.getElementById('notif-badge');
  badge.style.display = show ? 'block' : 'none';
}

// Notifications Polling Loop
let notificationInterval = null;
function startNotificationPolling() {
  if (notificationInterval) clearInterval(notificationInterval);
  
  // Initial check
  fetchNotifications();

  notificationInterval = setInterval(() => {
    if (currentUser) {
      fetchNotifications();
    } else {
      clearInterval(notificationInterval);
    }
  }, 12000); // Poll every 12 seconds
}

// Helpers
function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeQuote(str) {
  if (!str) return '';
  return str.replace(/'/g, "\\'");
}

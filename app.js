const page = document.body.dataset.page;
const params = new URLSearchParams(location.search);
let listings = [];
let chatFilters = {};
let activeGalleryIndex = 0;
let currentModalProperty = null;
let pendingPropertyId = null;

// Metropolis database with regional descriptors
// Bengaluru Metropolis database with micro-market hubs
const METROPOLISES = [
  { id: 'Bengaluru', name: 'Bengaluru', region: 'All Greater Bengaluru' },
  { id: 'Whitefield', name: 'Whitefield', region: 'East IT Corridor' },
  { id: 'Indiranagar', name: 'Indiranagar', region: 'Central Cosmopolitan' },
  { id: 'Koramangala', name: 'Koramangala', region: 'South Innovation Hub' },
  { id: 'HSR Layout', name: 'HSR Layout', region: 'South Residential Corridor' },
  { id: 'Bellandur', name: 'Bellandur', region: 'Outer Ring Road Tech Hub' },
  { id: 'Sarjapur Road', name: 'Sarjapur Road', region: 'South-East Green Enclave' },
  { id: 'Electronic City', name: 'Electronic City', region: 'South Technology Park' },
  { id: 'Hebbal', name: 'Hebbal', region: 'North Aerotropolis' },
  { id: 'Yelahanka', name: 'Yelahanka', region: 'North Enclave' }
];

// Auth Helpers
function getAuthUser() {
  try {
    const data = localStorage.getItem('wonacre_user') || localStorage.getItem('ssr_user');
    if (!data) return null;
    const user = JSON.parse(data);
    if (user && user.name && user.name.startsWith('+91')) {
      user.name = 'Alex Morgan';
    }
    return user;
  } catch {
    return null;
  }
}

function setAuthUser(user) {
  if (user) {
    localStorage.setItem('wonacre_user', JSON.stringify(user));
    localStorage.removeItem('ssr_user');
  } else {
    localStorage.removeItem('wonacre_user');
    localStorage.removeItem('ssr_user');
  }
  updateAuthUI();
}

// Active City State - Only Bengaluru and regions under it
function getActiveCity() {
  const c = localStorage.getItem('wonacre_city') || localStorage.getItem('ssr_city');
  if (c && METROPOLISES.some(m => m.name.toLowerCase() === c.toLowerCase())) {
    return c;
  }
  return 'Bengaluru';
}

function setActiveCity(cityName) {
  localStorage.setItem('wonacre_city', cityName);
  localStorage.setItem('ssr_city', cityName);
  const labelEl = document.querySelector('#active-city-label');
  if (labelEl) labelEl.textContent = cityName;
  renderMetropolisOptions();
  
  // Sync hero select if on home
  const heroCitySelect = document.querySelector('#hero-city-select');
  if (heroCitySelect) heroCitySelect.value = cityName;
  
  // Sync catalogue filter if on listings
  const filterCity = document.querySelector('#filter-city');
  if (filterCity) {
    filterCity.value = cityName;
    filterCity.dispatchEvent(new Event('change'));
  }
}

// Saved / Favorites Helpers
function getSavedIds() {
  try {
    const data = localStorage.getItem('wonacre_saved') || localStorage.getItem('ssr_saved');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function isSaved(id) {
  return getSavedIds().includes(id);
}

function toggleSaved(id) {
  const current = getSavedIds();
  const index = current.indexOf(id);
  if (index >= 0) {
    current.splice(index, 1);
  } else {
    current.push(id);
  }
  localStorage.setItem('wonacre_saved', JSON.stringify(current));
  updateSavedUI();
  return current.includes(id);
}

function updateSavedUI() {
  const count = getSavedIds().length;
  const badge = document.querySelector('#saved-badge');
  if (badge) badge.textContent = count;
  document.querySelectorAll('[data-save-id]').forEach(btn => {
    const id = btn.dataset.saveId;
    const saved = isSaved(id);
    btn.classList.toggle('saved', saved);
    btn.setAttribute('aria-pressed', String(saved));
    btn.innerHTML = saved ? '★' : '☆';
  });
}

const label = value => ({
  buy: 'For sale',
  rent: 'For rent',
  commercial: 'Commercial',
  apartment: 'Apartment',
  villa: 'Villa',
  retail: 'Retail',
  office: 'Office',
  showroom: 'Showroom'
}[value] || value);

const propertyUrl = id => `property.html?id=${encodeURIComponent(id)}`;
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

/* =========================================================
   SHELL RENDERING (Header, Footer, Modals)
   ========================================================= */

function renderShell() {
  const activeCity = getActiveCity();
  const savedCount = getSavedIds().length;

  // Header markup matching user's reference picture
  document.querySelector('#site-header').innerHTML = `
    <header class="site-header">
      <div class="container header-inner">
        <!-- Brand Logo: WONACRE -->
        <a class="brand" href="index.html" aria-label="WONACRE">
          <span class="brand-symbol">W</span>
          <div class="brand-text">
            <span class="brand-name">WONACRE</span>
          </div>
        </a>

        <!-- Main Nav in requested order: 1. Discover, 2. About, 3. Domestic, 4. Commercial -->
        <nav id="main-nav" class="main-nav" aria-label="Primary navigation">
          <a href="index.html" class="nav-link ${page === 'home' ? 'active' : ''}" ${page === 'home' ? 'aria-current="page"' : ''}>Discover</a>
          <a href="about.html" class="nav-link ${page === 'about' ? 'active' : ''}" ${page === 'about' ? 'aria-current="page"' : ''}>About</a>
          <a href="listings.html" class="nav-link ${page === 'listings' && params.get('intent') !== 'commercial' ? 'active' : ''}">
            Domestic
          </a>
          <a href="listings.html?intent=commercial" class="nav-link ${page === 'listings' && params.get('intent') === 'commercial' ? 'active' : ''}">
            Commercial
          </a>
        </nav>

        <!-- Right Side: Saved Collection with Save Symbol, Location Dropdown, User Profile, Consult AI -->
        <div class="header-actions">
          <!-- Saved Pill Button with Save Symbol -->
          <a href="listings.html?saved=true" class="saved-pill-btn ${params.get('saved') === 'true' ? 'active' : ''}" id="header-saved-btn" title="Saved Properties Collection" aria-label="View Saved Properties">
            <span class="save-icon-symbol">🔖</span>
            <span class="save-label">Saved</span>
            <span class="nav-badge" id="saved-badge">${savedCount}</span>
          </a>

          <!-- Location Dropdown Pill for Bengaluru & micro-markets -->
          <div class="location-selector" id="location-selector">
            <button class="location-pill-btn" id="location-pill-btn" type="button" aria-expanded="false" aria-haspopup="true" aria-label="Select Bengaluru Location">
              <span class="loc-dot"></span>
              <span id="active-city-label">${activeCity}</span>
              <span class="loc-arrow">▾</span>
            </button>
            <div class="location-menu" id="location-menu" hidden>
              <div id="location-options-container"></div>
            </div>
          </div>

          <!-- Auth Profile Slot (Sign in button removed from header) -->
          <div id="header-auth-slot"></div>

          <!-- Consult AI CTA Button -->
          <button type="button" class="consult-ai-btn" data-open-chat>
            Consult AI <span>✦</span>
          </button>

          <!-- Mobile Hamburger -->
          <button id="menu-toggle" class="menu-toggle" type="button" aria-controls="main-nav" aria-expanded="false" aria-label="Open menu">
            <span></span><span></span>
          </button>
        </div>
      </div>
    </header>
  `;

  // Footer
  document.querySelector('#site-footer').innerHTML = `
    <footer class="footer">
      <div class="container">
        <div class="footer-top">
          <div>
            <a class="brand" href="index.html">
              <span class="brand-symbol">W</span>
              <div class="brand-text">
                <span class="brand-name">WONACRE</span>
              </div>
            </a>
            <p style="color: var(--ink-secondary); margin-top: 14px; max-width: 380px;">
              A considered way to discover homes and workplaces through conversational architectural intelligence.
            </p>
          </div>
          <div class="footer-links">
            <div>
              <strong>Explore</strong>
              <a href="index.html">Discover</a>
              <a href="listings.html?intent=buy">Buy Portfolio</a>
              <a href="listings.html?intent=rent">Long Leases</a>
              <a href="listings.html?intent=commercial">Commercial Floors</a>
            </div>
            <div>
              <strong>Bengaluru Hubs</strong>
              <button type="button" data-switch-city="Bengaluru">Bengaluru</button>
              <button type="button" data-switch-city="Whitefield">Whitefield</button>
              <button type="button" data-switch-city="Indiranagar">Indiranagar</button>
              <button type="button" data-switch-city="Koramangala">Koramangala</button>
              <button type="button" data-switch-city="HSR Layout">HSR Layout</button>
              <button type="button" data-switch-city="Bellandur">Bellandur</button>
            </div>
            <div>
              <strong>Connect</strong>
              <a href="about.html">About WONACRE</a>
              <a href="contact.html">Schedule Site Visit</a>
              <button type="button" data-open-chat>Consult AI Spatial Model</button>
            </div>
          </div>
        </div>
        <div class="footer-bottom">
          <span>© 2026 WONACRE · All rights reserved</span>
          <span>Property blueprints and dossiers protected for verified users.</span>
        </div>
      </div>
    </footer>
  `;

  // Chat Panel Root
  document.querySelector('#chat-root').innerHTML = `
    <button id="chat-launcher" class="chat-launcher" type="button" aria-label="Open WONACRE AI Spatial Chat" aria-expanded="false" hidden style="display: none;"></button>
    <div id="chat-backdrop" class="chat-backdrop" hidden></div>
    <section id="chat-panel" class="chat-panel" role="dialog" aria-modal="true" aria-labelledby="chat-title" hidden>
      <header class="chat-head">
        <div class="chat-head-titles">
          <strong id="chat-title">WONACRE Spatial AI</strong>
          <span id="chat-mode">Bengaluru Metropolis Spatial Model</span>
        </div>
        <div class="chat-head-tools">
          <button id="chat-expand-toggle" type="button" class="chat-head-btn" title="Toggle Fullscreen" aria-label="Toggle Fullscreen">⛶</button>
          <button id="chat-close" type="button" class="chat-head-btn" aria-label="Close Assistant">✕</button>
        </div>
      </header>
      <div id="chat-messages" class="chat-messages" aria-live="polite">
        <div class="chat-message bot">
          Welcome to Bengaluru Spatial Discovery. Tell me what matters in your next home or workspace—locality, orientation, budget, or architectural layout.
        </div>
        <div class="chat-suggestions">
          <button type="button">A quiet 2 BHK in Koramangala, under ₹80 lakh, with a balcony</button>
          <button type="button">Lakefront penthouse in Hebbal Bengaluru</button>
          <button type="button">Golf view sanctuary in Yelahanka</button>
          <button type="button">3 BHK apartment in Whitefield Bengaluru</button>
        </div>
      </div>
      <form id="chat-form" class="chat-form">
        <label class="sr-only" for="chat-input">Message Assistant</label>
        <input id="chat-input" name="message" maxlength="500" autocomplete="off" placeholder="Ask about Bengaluru spaces, budgets, blueprints…" required>
        <button type="submit" aria-label="Send query">➤</button>
      </form>
      <p class="chat-disclaimer">Conversational Spatial Intelligence · Real-time portfolio search</p>
    </section>
  `;

  // Modals Root (Sign In Modal & Full Property Gallery Modal)
  let modalRoot = document.querySelector('#modal-root');
  if (!modalRoot) {
    modalRoot = document.createElement('div');
    modalRoot.id = 'modal-root';
    document.body.appendChild(modalRoot);
  }

  modalRoot.innerHTML = `
    <!-- Sign In / Unlock Modal: ONLY Mobile Number and OTP as requested -->
    <div id="auth-modal" class="modal-backdrop" hidden role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
      <div class="auth-modal-card">
        <button type="button" class="modal-close-btn" id="auth-modal-close" aria-label="Close dialog">×</button>
        <div class="auth-lock-icon">📱</div>
        <div class="auth-modal-head">
          <h2 id="auth-modal-title">Sign In with Mobile</h2>
          <p id="auth-modal-desc">
            Enter your 10-digit mobile number and OTP to unlock full architectural blueprints and property dossiers.
          </p>
        </div>

        <div id="auth-target-info" class="auth-target-pill" hidden>
          <span>✦</span>
          <span id="auth-target-title">The Linear House at Koramangala</span>
        </div>

        <form id="auth-form" class="auth-form">
          <label for="auth-name">Your Name
            <input type="text" id="auth-name" name="name" required placeholder="Enter your full name" autocomplete="name" value="">
          </label>

          <label for="auth-phone">Mobile Number
            <div class="auth-phone-row">
              <span class="auth-phone-prefix">+91</span>
              <input type="tel" id="auth-phone" name="phone" required placeholder="Enter 10-digit mobile" maxlength="10" pattern="[0-9]{10}" autocomplete="tel" value="">
              <button type="button" class="auth-send-otp-btn" id="auth-send-otp-btn">Send OTP</button>
            </div>
          </label>

          <div id="auth-otp-notice" class="auth-otp-notice" hidden>
            <span class="otp-pulse-dot"></span>
            <span id="auth-otp-notice-text"></span>
          </div>

          <label for="auth-otp">One-Time Password (OTP)
            <input type="text" id="auth-otp" name="otp" required placeholder="Enter 4-digit OTP" maxlength="6" autocomplete="one-time-code" value="">
          </label>

          <button type="submit" class="auth-submit-btn" id="auth-submit-btn">Verify OTP & Unlock</button>
        </form>
      </div>
    </div>

    <!-- Full Property Inspector Modal & Multi-Photo Gallery -->
    <div id="property-modal" class="modal-backdrop" hidden role="dialog" aria-modal="true" aria-labelledby="prop-modal-heading">
      <div class="property-modal-card">
        <!-- Top Bar matching user photo: Return to Discovery (left) | Dedicated View | Save | Close (right) -->
        <div class="prop-modal-top-bar">
          <button type="button" class="prop-modal-back-btn" id="prop-modal-back">
            <span>←</span> Return to Discovery
          </button>
          <div class="prop-modal-top-right">
            <a href="#" id="prop-modal-dedicated-btn" class="prop-modal-dedicated-btn" target="_blank">
              ↗ Dedicated View
            </a>
            <button type="button" id="prop-modal-save-btn" class="prop-modal-save-btn">
              <span id="prop-modal-save-icon">🔖</span>
              <span id="prop-modal-save-text">Save</span>
            </button>
            <button type="button" class="modal-close-btn" id="prop-modal-close" style="position: static;" aria-label="Close dialog">✕</button>
          </div>
        </div>

        <div class="prop-modal-scrollable">
          <!-- Property Title and Key Stats -->
          <div style="padding: 20px 28px 12px;">
            <div class="prop-modal-title-group">
              <h2 id="prop-modal-heading" style="font-size: 1.55rem; margin-bottom: 6px;">The Linear House at Gachibowli</h2>
              <div class="prop-modal-meta" style="flex-wrap: wrap; gap: 8px 12px;">
                <span id="prop-modal-badge" class="eyebrow light" style="margin:0;">BUY // HYDERABAD</span>
                <span>·</span>
                <span id="prop-modal-config">2 BHK · 1,450 sq.ft</span>
                <span>·</span>
                <span id="prop-modal-rera" style="color: var(--cyan);">RERA: P02400004921</span>
                <span>·</span>
                <strong id="prop-modal-price" style="color: var(--gold); font-size: 1.05rem;">₹78 Lakh</strong>
              </div>
            </div>
          </div>

          <!-- Interactive Multi-Photo Gallery Component -->
          <div class="gallery-container">
            <div class="gallery-main-view">
              <img id="gallery-active-img" src="assets/prop-linear-exterior.jpg" alt="Property view">
              <button type="button" class="gallery-nav-btn gallery-prev" id="gallery-prev-btn" aria-label="Previous photo">‹</button>
              <button type="button" class="gallery-nav-btn gallery-next" id="gallery-next-btn" aria-label="Next photo">›</button>
              <div class="gallery-caption-bar">
                <span id="gallery-active-caption">Exterior Architecture at Dusk</span>
                <span class="gallery-counter" id="gallery-counter">PHOTO 1 OF 4</span>
              </div>
            </div>
            <!-- Thumbnails Row -->
            <div class="gallery-thumbs-row" id="gallery-thumbs-row"></div>
          </div>

          <!-- Overview & Highlights -->
          <div style="padding: 24px 28px 30px;">
            <p id="prop-modal-summary" class="lead" style="font-size: 0.95rem; color: #cbd5e1; margin: 0 0 16px;"></p>
            <div class="prop-highlight-tags" id="prop-modal-highlights" style="margin-bottom: 24px;"></div>

            <!-- TECHNICAL SPECIFICATIONS TABLE (Exactly matching user photo) -->
            <div class="dossier-spec-section">
              <span class="dossier-section-title">TECHNICAL SPECIFICATIONS</span>
              <div class="tech-specs-table" id="prop-tech-specs-table"></div>
            </div>

            <!-- RESIDENTIAL AMENITIES (Exactly matching user photo) -->
            <div class="dossier-amenities-section">
              <span class="dossier-section-title">RESIDENTIAL AMENITIES</span>
              <div class="amenities-chips-wrap" id="prop-amenities-chips"></div>
            </div>

            <!-- SCHEDULE A PRIVATE ARCHITECTURAL VIEWING CARD (Exactly matching user photo) -->
            <div class="viewing-brochure-card">
              <h4>Schedule a Private Architectural Viewing</h4>
              <p>Walk through with a WONACRE certified architectural curator. No broker spam.</p>
              
              <form id="prop-viewing-form">
                <div class="viewing-form-grid">
                  <input type="text" class="viewing-input" id="viewing-fullname" placeholder="Your Full Name" required>
                  <input type="tel" class="viewing-input" id="viewing-phone" placeholder="Phone or WhatsApp Number" required>
                </div>
                <button type="submit" class="viewing-submit-btn" id="viewing-submit-btn">
                  Confirm Viewing Appointment
                </button>
              </form>

              <div id="viewing-success-box" class="viewing-success-box" hidden>
                <strong style="color: var(--emerald); font-size: 0.95rem;">✓ Viewing Requested & Brochure Dispatched!</strong>
                <p style="margin: 6px 0 0; color: #cbd5e1; font-size: 0.82rem; line-height: 1.5;">
                  The official architectural brochure and specifications have been sent to your WhatsApp/Phone. A WONACRE curator will coordinate your private walkthrough shortly.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  setupShellEventListeners();
  updateAuthUI();
  updateSavedUI();
}

/* =========================================================
   SHELL EVENT LISTENERS & INTERACTION
   ========================================================= */

function setupShellEventListeners() {
  // Mobile Nav Toggle
  const toggle = document.querySelector('#menu-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      document.querySelector('#main-nav').classList.toggle('open', open);
    });
  }

  // Location Dropdown Toggle
  const locBtn = document.querySelector('#location-pill-btn');
  const locMenu = document.querySelector('#location-menu');
  if (locBtn && locMenu) {
    locBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = locMenu.hidden;
      locMenu.hidden = !open;
      locBtn.setAttribute('aria-expanded', String(open));
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#location-selector')) {
        locMenu.hidden = true;
        locBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  renderMetropolisOptions();

  // Footer city switch buttons
  document.querySelectorAll('[data-switch-city]').forEach(btn => {
    btn.addEventListener('click', () => setActiveCity(btn.dataset.switchCity));
  });

  // Chatbot Open/Close & Controls
  document.querySelectorAll('[data-open-chat], #chat-launcher').forEach(button => {
    button.addEventListener('click', () => setChatOpen(true));
  });
  const chatClose = document.querySelector('#chat-close');
  if (chatClose) chatClose.addEventListener('click', () => setChatOpen(false));

  const chatBackdrop = document.querySelector('#chat-backdrop');
  if (chatBackdrop) chatBackdrop.addEventListener('click', () => setChatOpen(false));

  const chatExpandBtn = document.querySelector('#chat-expand-toggle');
  if (chatExpandBtn) {
    chatExpandBtn.addEventListener('click', () => {
      const panel = document.querySelector('#chat-panel');
      if (panel) {
        panel.classList.toggle('chat-fullscreen');
        chatExpandBtn.textContent = panel.classList.contains('chat-fullscreen') ? '🗗' : '⛶';
      }
    });
  }

  // Escape key closes modals and chat
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      setChatOpen(false);
      closeAuthModal();
      closePropertyModal();
    }
  });

  // Auth Modal Listeners
  const authClose = document.querySelector('#auth-modal-close');
  if (authClose) authClose.addEventListener('click', closeAuthModal);

  const authBackdrop = document.querySelector('#auth-modal');
  if (authBackdrop) {
    authBackdrop.addEventListener('click', e => {
      if (e.target === authBackdrop) closeAuthModal();
    });
  }

  // Auth Modal Listeners: Only Mobile Number and OTP
  const sendOtpBtn = document.querySelector('#auth-send-otp-btn');
  const otpNotice = document.querySelector('#auth-otp-notice');
  const otpNoticeText = document.querySelector('#auth-otp-notice-text');
  const phoneInput = document.querySelector('#auth-phone');
  const otpInput = document.querySelector('#auth-otp');

  if (sendOtpBtn) {
    sendOtpBtn.addEventListener('click', () => {
      const phone = phoneInput ? phoneInput.value.replace(/\D/g, '') : '';
      if (!phone || phone.length < 10) {
        alert('Please enter a valid 10-digit mobile number.');
        if (phoneInput) phoneInput.focus();
        return;
      }
      if (otpNotice && otpNoticeText) {
        otpNotice.hidden = false;
        otpNoticeText.innerHTML = `OTP sent to +91 ${phone}: <strong>1234</strong>`;
      }
      if (otpInput) {
        otpInput.value = '1234';
        otpInput.focus();
      }
    });
  }

  const authForm = document.querySelector('#auth-form');
  if (authForm) {
    authForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const nameInput = document.querySelector('#auth-name');
      const name = nameInput ? nameInput.value.trim() : '';
      const phone = phoneInput ? phoneInput.value.replace(/\D/g, '') : '';
      const otp = otpInput ? otpInput.value.trim() : '';
      if (!name) {
        alert('Please enter your name.');
        if (nameInput) nameInput.focus();
        return;
      }
      if (!phone || phone.length < 10) {
        alert('Please enter a valid 10-digit mobile number.');
        if (phoneInput) phoneInput.focus();
        return;
      }
      if (!otp) {
        alert('Please enter the OTP sent to your mobile.');
        if (otpInput) otpInput.focus();
        return;
      }
      executeLogin({ name, phone, mobile: phone });
    });
  }

  // Property Modal Close Listeners
  const propClose = document.querySelector('#prop-modal-close');
  if (propClose) propClose.addEventListener('click', closePropertyModal);

  const propBackdrop = document.querySelector('#property-modal');
  if (propBackdrop) {
    propBackdrop.addEventListener('click', e => {
      if (e.target === propBackdrop) closePropertyModal();
    });
  }

  // Gallery Navigation Buttons
  const prevBtn = document.querySelector('#gallery-prev-btn');
  const nextBtn = document.querySelector('#gallery-next-btn');
  if (prevBtn) prevBtn.addEventListener('click', () => navigateGallery(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => navigateGallery(1));
}

// Render Metropolis Options Menu
function renderMetropolisOptions() {
  const container = document.querySelector('#location-options-container');
  if (!container) return;
  const active = getActiveCity();

  container.innerHTML = METROPOLISES.map(city => `
    <button type="button" class="location-option ${city.name === active ? 'selected' : ''}" data-city-val="${city.name}">
      <div class="location-option-text">
        <span class="location-option-name">${city.name}</span>
        <span class="location-option-sub">${city.region}</span>
      </div>
      ${city.name === active ? '<span class="location-check">✓</span>' : ''}
    </button>
  `).join('');

  container.querySelectorAll('.location-option').forEach(btn => {
    btn.addEventListener('click', () => {
      setActiveCity(btn.dataset.cityVal);
      const menu = document.querySelector('#location-menu');
      if (menu) menu.hidden = true;
      const pill = document.querySelector('#location-pill-btn');
      if (pill) pill.setAttribute('aria-expanded', 'false');
    });
  });
}

// Update Header Auth Button / User Profile
function updateAuthUI() {
  const slot = document.querySelector('#header-auth-slot');
  if (!slot) return;
  const user = getAuthUser();

  if (user) {
    const displayName = (user.name && user.name.trim() && !user.name.startsWith('+91')) ? user.name.trim() : 'Alex Morgan';
    const initial = displayName.charAt(0).toUpperCase();
    slot.innerHTML = `
      <div class="user-profile-pill" title="Signed in as ${escapeHtml(displayName)}">
        <span class="user-avatar-circle">${escapeHtml(initial)}</span>
        <span>Hello! ${escapeHtml(displayName)}</span>
        <button class="user-logout-btn" id="header-logout-btn" title="Sign out" type="button" aria-label="Sign out">✕</button>
      </div>
    `;
    const logoutBtn = slot.querySelector('#header-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        setAuthUser(null);
        if (page === 'property') setupProperty();
      });
    }
  } else {
    // Requirement 1: remove the signin in the header
    slot.innerHTML = '';
  }
}

/* =========================================================
   AUTH MODAL & LOGIN FLOW (Requirement 3)
   ========================================================= */

function openAuthModal(propertyId = null) {
  pendingPropertyId = propertyId;
  const modal = document.querySelector('#auth-modal');
  const targetInfo = document.querySelector('#auth-target-info');
  const targetTitle = document.querySelector('#auth-target-title');

  if (propertyId && listings.length) {
    const prop = listings.find(p => p.id === propertyId);
    if (prop) {
      targetInfo.hidden = false;
      targetTitle.textContent = `Unlocking Dossier: ${prop.title} (${prop.locality})`;
    }
  } else {
    targetInfo.hidden = true;
  }

  // Ensure modal inputs and notices are completely clean when opening
  const nameIn = document.querySelector('#auth-name');
  const phoneIn = document.querySelector('#auth-phone');
  const otpIn = document.querySelector('#auth-otp');
  const otpNotice = document.querySelector('#auth-otp-notice');
  if (nameIn) nameIn.value = '';
  if (phoneIn) phoneIn.value = '';
  if (otpIn) otpIn.value = '';
  if (otpNotice) {
    otpNotice.hidden = true;
    const otpNoticeText = document.querySelector('#auth-otp-notice-text');
    if (otpNoticeText) otpNoticeText.innerHTML = '';
  }

  modal.hidden = false;
}

function closeAuthModal() {
  const modal = document.querySelector('#auth-modal');
  if (modal) modal.hidden = true;
}

let pendingChatQuery = null;

function executeLogin(userData) {
  setAuthUser(userData);
  closeAuthModal();

  // If user clicked a property before logging in, immediately unlock and show it!
  if (pendingPropertyId) {
    const targetId = pendingPropertyId;
    pendingPropertyId = null;
    openPropertyDetails(targetId);
  }

  // If chat was waiting for login, immediately resume query!
  if (pendingChatQuery && window.sendChatMessage) {
    const q = pendingChatQuery;
    pendingChatQuery = null;
    window.sendChatMessage(q);
  }
}

/* =========================================================
   PROPERTY CLICK & LOGIN GATE (Requirement 3)
   ========================================================= */

function handlePropertyClick(event, propertyId) {
  event.preventDefault();
  const user = getAuthUser();

  if (!user) {
    // If user is not logged in, ask for login first!
    openAuthModal(propertyId);
  } else {
    // Logged in: show full info and more pics!
    openPropertyDetails(propertyId);
  }
}

function openPropertyDetails(propertyId) {
  const item = listings.find(entry => entry.id === propertyId);
  if (!item) return;

  // If user is on property.html with the same ID, just refresh
  if (page === 'property') {
    location.href = propertyUrl(propertyId);
    return;
  }

  showPropertyModal(item);
}

/* =========================================================
   FULL PROPERTY INSPECTOR MODAL & GALLERY
   ========================================================= */

function showPropertyModal(item) {
  currentModalProperty = item;
  activeGalleryIndex = 0;
  const modal = document.querySelector('#property-modal');

  // Fill Header
  document.querySelector('#prop-modal-heading').textContent = item.title;
  document.querySelector('#prop-modal-badge').textContent = `${label(item.intent).toUpperCase()} // ${item.city.toUpperCase()}`;
  document.querySelector('#prop-modal-config').textContent = `${item.config} · ${item.areaSqft.toLocaleString('en-IN')} sq.ft · ${item.locality}`;
  
  const reraVal = item.specs?.rera || 'Authenticated WONACRE ID: P024098';
  document.querySelector('#prop-modal-rera').textContent = `RERA: ${reraVal}`;
  document.querySelector('#prop-modal-price').textContent = item.priceLabel;

  // Dedicated View Link
  const dedicatedBtn = document.querySelector('#prop-modal-dedicated-btn');
  if (dedicatedBtn) dedicatedBtn.href = propertyUrl(item.id);

  // Return to Discovery Back Button
  const backBtn = document.querySelector('#prop-modal-back');
  if (backBtn) backBtn.onclick = () => closePropertyModal();

  // Top Bar Save Button
  const saveBtn = document.querySelector('#prop-modal-save-btn');
  const saveIcon = document.querySelector('#prop-modal-save-icon');
  const saveText = document.querySelector('#prop-modal-save-text');
  const saved = isSaved(item.id);
  if (saveBtn) {
    saveBtn.classList.toggle('saved', saved);
    if (saveIcon) saveIcon.textContent = saved ? '★' : '🔖';
    if (saveText) saveText.textContent = saved ? 'Saved' : 'Save';
    saveBtn.onclick = () => {
      const isNow = toggleSaved(item.id);
      saveBtn.classList.toggle('saved', isNow);
      if (saveIcon) saveIcon.textContent = isNow ? '★' : '🔖';
      if (saveText) saveText.textContent = isNow ? 'Saved' : 'Save';
    };
  }

  // Description & Highlights
  document.querySelector('#prop-modal-summary').textContent = item.summary;
  const highlightsContainer = document.querySelector('#prop-modal-highlights');
  highlightsContainer.innerHTML = item.highlights.map(h => `<span class="prop-highlight-pill">✓ ${escapeHtml(h)}</span>`).join('');

  // Setup Gallery Images
  renderModalGallery(item);

  // TECHNICAL SPECIFICATIONS TABLE (From user photo)
  const defaultSpecs = {
    "Ceiling Height": "10.6 ft clear height",
    "Flooring Material": "Micro-cement & smoked oak hardwood",
    "Acoustic & Thermal Glazing": "Saint-Gobain low-E thermal acoustic glass",
    "Covered Parking": "1 Dedicated Bays",
    "Balconies & Terraces": "2 Private Outdoor Balconies"
  };
  const specs = Object.assign({}, defaultSpecs, item.technicalSpecs || {});
  const specsTable = document.querySelector('#prop-tech-specs-table');
  if (specsTable) {
    specsTable.innerHTML = Object.entries(specs).map(([specKey, specVal]) => `
      <div class="tech-spec-row">
        <div class="tech-spec-label">${escapeHtml(specKey)}</div>
        <div class="tech-spec-value">${escapeHtml(specVal)}</div>
      </div>
    `).join('');
  }

  // RESIDENTIAL AMENITIES CHIPS (From user photo)
  const defaultAmenities = [
    "Lap pool with slate stone perimeter",
    "Residents library & reading pavilion",
    "EV car charging bay",
    "24/7 security with RFID gate access",
    "Rooftop stargazing deck"
  ];
  const amenitiesList = item.amenities && item.amenities.length > 0 ? item.amenities : defaultAmenities;
  const amenitiesWrap = document.querySelector('#prop-amenities-chips');
  if (amenitiesWrap) {
    amenitiesWrap.innerHTML = amenitiesList.map(am => `
      <span class="amenity-chip">${escapeHtml(am)}</span>
    `).join('');
  }

  // SCHEDULE A PRIVATE ARCHITECTURAL VIEWING & SEND BROCHURE FORM
  const user = getAuthUser();
  const nameInput = document.querySelector('#viewing-fullname');
  const phoneInput = document.querySelector('#viewing-phone');
  if (nameInput) nameInput.value = user?.name || '';
  if (phoneInput && user?.phone) phoneInput.value = user.phone;

  const viewingForm = document.querySelector('#prop-viewing-form');
  const successBox = document.querySelector('#viewing-success-box');
  if (viewingForm && successBox) {
    viewingForm.hidden = false;
    successBox.hidden = true;
    viewingForm.onsubmit = (e) => {
      e.preventDefault();
      const clientName = nameInput ? nameInput.value.trim() : (user?.name || 'Valued Client');
      const clientPhone = phoneInput ? phoneInput.value.trim() : '';
      viewingForm.hidden = true;
      successBox.hidden = false;
      successBox.innerHTML = `
        <strong style="color: var(--emerald); font-size: 0.95rem;">✓ Official Brochure & Dossier Dispatched!</strong>
        <p style="margin: 6px 0 0; color: #cbd5e1; font-size: 0.82rem; line-height: 1.5;">
          The full architectural brochure and specifications for <strong>${escapeHtml(item.title)}</strong> have been sent to <strong>${escapeHtml(clientPhone || clientName)}</strong> via WhatsApp. A WONACRE curator will coordinate your private walkthrough shortly.
        </p>
      `;
    };
  }

  const scrollable = modal.querySelector('.prop-modal-scrollable');
  if (scrollable) scrollable.scrollTop = 0;

  modal.hidden = false;
}

function closePropertyModal() {
  const modal = document.querySelector('#property-modal');
  if (modal) modal.hidden = true;
  currentModalProperty = null;
}

function getPropertyGallery(item) {
  if (item.gallery && item.gallery.length > 0) return item.gallery;
  return [item.image, 'assets/prop-luxury-living.jpg', 'assets/prop-master-bedroom.jpg', 'assets/prop-floor-plan.jpg'];
}

const GALLERY_LABELS = [
  'Exterior Architecture',
  'Double-Height Living Salon',
  'Master Suite & Private Terrace',
  '3D Blueprint Floor Plan'
];

function renderModalGallery(item) {
  const gallery = getPropertyGallery(item);
  const thumbsRow = document.querySelector('#gallery-thumbs-row');

  thumbsRow.innerHTML = gallery.map((imgUrl, i) => `
    <div class="gallery-thumb-item ${i === activeGalleryIndex ? 'active' : ''}" data-thumb-idx="${i}">
      <img src="${imgUrl}" alt="Thumbnail ${i + 1}">
      <span class="gallery-thumb-label">${GALLERY_LABELS[i] || `View ${i + 1}`}</span>
    </div>
  `).join('');

  thumbsRow.querySelectorAll('.gallery-thumb-item').forEach(thumb => {
    thumb.addEventListener('click', () => {
      activeGalleryIndex = Number(thumb.dataset.thumbIdx);
      updateActiveGalleryImage();
    });
  });

  updateActiveGalleryImage();
}

function updateActiveGalleryImage() {
  if (!currentModalProperty) return;
  const gallery = getPropertyGallery(currentModalProperty);
  if (activeGalleryIndex < 0) activeGalleryIndex = gallery.length - 1;
  if (activeGalleryIndex >= gallery.length) activeGalleryIndex = 0;

  const mainImg = document.querySelector('#gallery-active-img');
  mainImg.src = gallery[activeGalleryIndex];

  const caption = document.querySelector('#gallery-active-caption');
  caption.textContent = GALLERY_LABELS[activeGalleryIndex] || `Dossier Photograph ${activeGalleryIndex + 1}`;

  const counter = document.querySelector('#gallery-counter');
  counter.textContent = `PHOTO ${activeGalleryIndex + 1} OF ${gallery.length}`;

  document.querySelectorAll('#gallery-thumbs-row .gallery-thumb-item').forEach((thumb, i) => {
    thumb.classList.toggle('active', i === activeGalleryIndex);
  });
}

function navigateGallery(delta) {
  activeGalleryIndex += delta;
  updateActiveGalleryImage();
}

/* =========================================================
   CARD COMPONENT
   ========================================================= */

function card(item) {
  const saved = isSaved(item.id);
  const galleryCount = (item.gallery?.length) || 4;

  return `
    <article class="property-card" data-card-id="${escapeHtml(item.id)}">
      <div class="card-media">
        <img src="${item.image}" alt="Architectural view of ${escapeHtml(item.title)}" loading="lazy">
        <span class="card-badge">${label(item.intent)} // ${escapeHtml(item.city)}</span>
        <button type="button" class="card-save-btn ${saved ? 'saved' : ''}" data-save-id="${escapeHtml(item.id)}" aria-label="Save ${escapeHtml(item.title)}">
          ${saved ? '★' : '☆'}
        </button>
      </div>
      <div class="card-content">
        <div class="card-eyebrow">
          <span>${escapeHtml(item.locality)}</span>
          <span>${galleryCount} PHOTOS · SPEC DOSSIER</span>
        </div>
        <h3>${escapeHtml(item.title)}</h3>
        <p class="card-summary">
          ${escapeHtml(item.config)} <span>·</span> ${item.areaSqft.toLocaleString('en-IN')} sq.ft <span>·</span> ${label(item.type)}
        </p>
        <div class="card-bottom">
          <div>
            <strong>${escapeHtml(item.priceLabel)}</strong>
            <small>${escapeHtml(item.priceNote)}</small>
          </div>
          <span class="card-view-btn">
            Unlock Full Info ↗
          </span>
        </div>
      </div>
    </article>
  `;
}

function attachCardClickListeners(container) {
  container.querySelectorAll('.property-card').forEach(cardEl => {
    const id = cardEl.dataset.cardId;
    cardEl.addEventListener('click', (e) => {
      // Don't trigger property modal if user clicked the save button
      if (e.target.closest('.card-save-btn')) {
        e.stopPropagation();
        toggleSaved(id);
        return;
      }
      handlePropertyClick(e, id);
    });
  });
}

function addOptions(select, values, placeholder, selected = '') {
  select.innerHTML = `<option value="">${placeholder}</option>` + values.map(value => `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(label(value))}</option>`).join('');
}

/* =========================================================
   HOME PAGE (index.html)
   ========================================================= */

function setupHome() {
  const activeCity = getActiveCity();

  // Attach click to the featured monograph card (The Linear House at Gachibowli)
  const monograph = document.querySelector('[data-open-property]');
  if (monograph) {
    monograph.addEventListener('click', (e) => {
      const propId = monograph.dataset.openProperty;
      handlePropertyClick(e, propId);
    });
  }

  // Hero Spatial Search Console Interactions
  const heroCitySelect = document.querySelector('#hero-city-select');
  const heroBudgetSelect = document.querySelector('#hero-budget-select');
  const heroTabs = document.querySelectorAll('[data-hero-intent]');
  const heroForm = document.querySelector('#hero-spatial-form');
  const heroInput = document.querySelector('#hero-spatial-input');
  const heroConsultBtn = document.querySelector('#hero-consult-btn');

  let heroIntent = 'buy';

  if (heroCitySelect) {
    if (activeCity && [...heroCitySelect.options].some(o => o.value === activeCity)) {
      heroCitySelect.value = activeCity;
    }
    heroCitySelect.addEventListener('change', () => {
      if (heroCitySelect.value !== 'Bengaluru') {
        setActiveCity(heroCitySelect.value);
      }
    });
  }

  const buyBudgets = `
    <option value="8000000">Under ₹80 Lakh</option>
    <option value="15000000" selected>Under ₹1.5 Cr</option>
    <option value="35000000">Under ₹3.5 Cr</option>
    <option value="">Any budget</option>
  `;

  const rentBudgets = `
    <option value="40000">Under ₹40,000 / mo</option>
    <option value="75000" selected>Under ₹75,000 / mo</option>
    <option value="150000">Under ₹1.5 Lakh / mo</option>
    <option value="">Any budget</option>
  `;

  heroTabs.forEach(btn => {
    btn.addEventListener('click', () => {
      heroTabs.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      heroIntent = btn.dataset.heroIntent;
      if (heroBudgetSelect) {
        heroBudgetSelect.innerHTML = heroIntent === 'rent' ? rentBudgets : buyBudgets;
      }
    });
  });

  function performSpatialSearch() {
    const rawQuery = heroInput ? heroInput.value.trim() : '';
    const activeCityName = heroCitySelect && heroCitySelect.value ? heroCitySelect.value : 'Bengaluru';
    const query = rawQuery || `${heroIntent === 'rent' ? 'Rental' : 'Residential'} properties in ${activeCityName}`;

    const localityVal = heroCitySelect && heroCitySelect.value !== 'Bengaluru' ? heroCitySelect.value : null;
    const budgetVal = heroBudgetSelect && heroBudgetSelect.value ? Number(heroBudgetSelect.value) : null;

    // Client-side spatial filtering for immediate display on Discover page
    const textLower = query.toLowerCase();
    const bhkMatch = textLower.match(/\b([1-6])\s*bhk\b/);
    const targetBhk = bhkMatch ? Number(bhkMatch[1]) : null;

    let parsedMaxPrice = budgetVal;
    const priceMatch = textLower.match(/(?:under|below|up to|less than)\s*₹?\s*([\d.]+)\s*(crore|cr|lakh|lac|l|k|thousand)?/);
    if (priceMatch) {
      const units = { crore: 1e7, cr: 1e7, lakh: 1e5, lac: 1e5, l: 1e5, k: 1e3, thousand: 1e3 };
      parsedMaxPrice = Math.round(Number(priceMatch[1]) * (units[priceMatch[2]] || 1));
    }

    let searchLocality = localityVal;
    if (!searchLocality) {
      if (textLower.includes('gachibowli')) searchLocality = 'Koramangala';
      else {
        const found = METROPOLISES.find(m => textLower.includes(m.name.toLowerCase()));
        if (found) searchLocality = found.name;
      }
    }

    let matches = listings.filter(item => {
      if (heroIntent && item.intent !== heroIntent) return false;
      if (searchLocality && !item.locality.toLowerCase().includes(searchLocality.toLowerCase()) && item.locality.toLowerCase() !== searchLocality.toLowerCase()) return false;
      if (targetBhk && !item.config.startsWith(`${targetBhk} BHK`)) return false;
      if (parsedMaxPrice && item.price > parsedMaxPrice) return false;
      return true;
    });

    // Fallback if strictly filtered
    if (!matches.length) {
      matches = listings.filter(item => {
        if (heroIntent && item.intent !== heroIntent) return false;
        if (parsedMaxPrice && item.price > parsedMaxPrice * 1.3) return false;
        return true;
      }).slice(0, 3);
    }

    // Render into Discover page #spatial-results-section
    const resultsSec = document.querySelector('#spatial-results-section');
    const resultsGrid = document.querySelector('#spatial-results-grid');
    const resultsSummary = document.querySelector('#spatial-results-summary');

    if (resultsSec && resultsGrid) {
      resultsSec.hidden = false;
      if (resultsSummary) {
        resultsSummary.innerHTML = `Showing <strong>${matches.length}</strong> architectural spaces matching <em>"${escapeHtml(query)}"</em> (${heroIntent === 'buy' ? 'Acquisition' : 'Long Lease'}${searchLocality ? ' · ' + escapeHtml(searchLocality) : ''}${parsedMaxPrice ? ' · Under ' + (parsedMaxPrice >= 1e7 ? '₹' + (parsedMaxPrice / 1e7) + ' Cr' : '₹' + (parsedMaxPrice / 1e5) + ' Lakh') : ''}):`;
      }
      resultsGrid.innerHTML = matches.map(item => card(item)).join('');
      attachCardClickListeners(resultsGrid);
      resultsSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    const clearBtn = document.querySelector('#clear-spatial-results-btn');
    if (clearBtn) {
      clearBtn.onclick = () => {
        if (resultsSec) resultsSec.hidden = true;
      };
    }

    // Open WONACRE AI assistant and pass query + filters
    setChatOpen(true);
    if (window.sendChatMessage) {
      chatFilters = {
        intent: heroIntent,
        locality: searchLocality,
        maxPrice: parsedMaxPrice,
        bhk: targetBhk
      };
      window.sendChatMessage(query);
    }
  }

  if (heroForm) heroForm.addEventListener('submit', (e) => { e.preventDefault(); performSpatialSearch(); });
  if (heroConsultBtn) heroConsultBtn.addEventListener('click', performSpatialSearch);

  // Render Featured Grid
  renderFeaturedGrid();

  // Secondary Filter Form (if present)
  const homeSearchForm = document.querySelector('#home-search');
  if (homeSearchForm) {
    let intent = 'buy';
    const buttons = [...document.querySelectorAll('#home-search [data-intent]')];
    const typeSelect = document.querySelector('#home-type');
    const localitySelect = document.querySelector('#home-locality');

    const refresh = () => {
      buttons.forEach(button => button.classList.toggle('selected', button.dataset.intent === intent));
      const group = listings.filter(item => item.intent === intent);
      if (localitySelect) addOptions(localitySelect, [...new Set(group.map(item => item.locality))].sort(), 'All locations', localitySelect.value);
      if (typeSelect) addOptions(typeSelect, [...new Set(group.map(item => item.type))].sort(), 'All types', typeSelect.value);
    };

    buttons.forEach(button => button.addEventListener('click', () => {
      intent = button.dataset.intent;
      if (localitySelect) localitySelect.value = '';
      if (typeSelect) typeSelect.value = '';
      refresh();
    }));

    homeSearchForm.addEventListener('submit', event => {
      event.preventDefault();
      const query = new URLSearchParams({ intent });
      if (localitySelect && localitySelect.value) query.set('locality', localitySelect.value);
      if (typeSelect && typeSelect.value) query.set('type', typeSelect.value);
      location.href = `listings.html?${query}`;
    });

    refresh();
  }
}

function renderFeaturedGrid() {
  const grid = document.querySelector('#featured-grid');
  if (!grid) return;
  const featured = listings.filter(item => item.featured);
  grid.innerHTML = featured.map(item => card(item)).join('');
  attachCardClickListeners(grid);
}

/* =========================================================
   LISTINGS PAGE (listings.html)
   ========================================================= */

function setupListings() {
  let intent = params.get('intent') || 'all';
  if (!['all', 'buy', 'rent', 'commercial'].includes(intent)) intent = 'all';

  const isSavedOnly = params.get('saved') === 'true';
  const citySelect = document.querySelector('#filter-city');
  const locality = document.querySelector('#filter-locality');
  const type = document.querySelector('#filter-type');
  const budget = document.querySelector('#filter-budget');
  const sort = document.querySelector('#filter-sort');
  const buttons = [...document.querySelectorAll('[data-filter-intent]')];

  const initialCity = params.get('city') || '';
  const initialLocality = params.get('locality') || '';
  const initialType = params.get('type') || '';

  if (citySelect && initialCity) citySelect.value = initialCity;

  function renderOptions() {
    const selectedCity = citySelect ? citySelect.value : '';
    const group = listings.filter(item => {
      if (selectedCity && selectedCity !== 'Bengaluru') {
        if (item.city !== selectedCity && item.locality !== selectedCity) return false;
      }
      if (intent !== 'all' && item.intent !== intent) return false;
      return true;
    });

    addOptions(locality, [...new Set(group.map(item => item.locality))].sort(), 'All locations', locality.value);
    addOptions(type, [...new Set(group.map(item => item.type))].sort(), 'All types', type.value);

    const ranges = intent === 'all'
      ? [['', 'Any budget'], ['10000000', 'Up to ₹1 Cr'], ['20000000', 'Up to ₹2 Cr'], ['50000000', 'Up to ₹5 Cr']]
      : intent === 'buy'
      ? [['', 'Any budget'], ['8000000', 'Up to ₹80 Lakh'], ['15000000', 'Up to ₹1.5 Cr'], ['25000000', 'Up to ₹2.5 Cr'], ['50000000', 'Up to ₹5 Cr']]
      : [['', 'Any budget'], ['50000', 'Up to ₹50,000 / mo'], ['100000', 'Up to ₹1 L / mo'], ['200000', 'Up to ₹2 L / mo'], ['300000', 'Up to ₹3 L / mo']];

    budget.innerHTML = ranges.map(([val, text]) => `<option value="${val}">${text}</option>`).join('');
    buttons.forEach(button => button.classList.toggle('selected', button.dataset.filterIntent === intent));
  }

  function update() {
    const maximum = Number(budget.value) || Infinity;
    const selectedCity = citySelect ? citySelect.value : '';
    const savedIds = getSavedIds();

    let found = listings.filter(item => {
      if (isSavedOnly && !savedIds.includes(item.id)) return false;
      if (selectedCity && selectedCity !== 'Bengaluru') {
        if (item.city !== selectedCity && item.locality !== selectedCity) return false;
      }
      if (intent !== 'all' && item.intent !== intent) return false;
      if (locality.value && item.locality !== locality.value) return false;
      if (type.value && item.type !== type.value) return false;
      if (item.price > maximum) return false;
      return true;
    });

    if (sort.value === 'price-asc') found.sort((a, b) => a.price - b.price);
    if (sort.value === 'price-desc') found.sort((a, b) => b.price - a.price);

    const grid = document.querySelector('#listing-grid');
    grid.innerHTML = found.map(item => card(item)).join('');
    attachCardClickListeners(grid);

    document.querySelector('#listing-empty').hidden = found.length > 0;
    document.querySelector('#results-count').textContent = `${found.length} architectural ${found.length === 1 ? 'property' : 'properties'} found`;
    document.querySelector('#results-title').textContent = isSavedOnly ? 'Saved Properties' : intent === 'all' ? 'Explore portfolio' : `${label(intent)} portfolio`;
  }

  function reset() {
    intent = 'all';
    if (citySelect) citySelect.value = '';
    locality.value = '';
    type.value = '';
    budget.value = '';
    sort.value = 'default';
    renderOptions();
    update();
    history.replaceState(null, '', 'listings.html');
  }

  buttons.forEach(button => button.addEventListener('click', () => {
    intent = button.dataset.filterIntent;
    locality.value = '';
    type.value = '';
    renderOptions();
    update();
  }));

  if (citySelect) citySelect.addEventListener('change', () => { renderOptions(); update(); });
  [locality, type, budget, sort].forEach(control => control.addEventListener('change', update));

  const resetBtn = document.querySelector('#reset-filters');
  if (resetBtn) resetBtn.addEventListener('click', reset);

  const emptyReset = document.querySelector('#empty-reset');
  if (emptyReset) emptyReset.addEventListener('click', reset);

  renderOptions();
  update();
}

/* =========================================================
   PROPERTY DETAILS PAGE (property.html) (Requirement 3)
   ========================================================= */

function setupProperty() {
  const item = listings.find(entry => entry.id === params.get('id'));
  const main = document.querySelector('#property-main');
  if (!item) {
    main.innerHTML = `
      <div class="empty-state" style="margin-top: 50px;">
        <span class="eyebrow">Property not found</span>
        <h1>Let's find another space.</h1>
        <p class="lead">This property may have been relocated.</p>
        <a class="button button-gold" href="listings.html">Browse properties →</a>
      </div>
    `;
    return;
  }

  document.title = `${item.title} — WONACRE Architectural Dossier`;

  const user = getAuthUser();
  const saved = isSaved(item.id);
  const gallery = getPropertyGallery(item);

  // If user is NOT logged in, show lock gate!
  if (!user) {
    main.innerHTML = `
      <nav class="breadcrumbs" aria-label="Breadcrumb">
        <a href="index.html">Discover</a><span>/</span>
        <a href="listings.html">Portfolio</a><span>/</span>
        <span>${escapeHtml(item.title)}</span>
      </nav>

      <div class="property-heading">
        <div>
          <span class="eyebrow">${label(item.intent).toUpperCase()} // ${escapeHtml(item.city).toUpperCase()} · ${escapeHtml(item.locality)}</span>
          <h1>${escapeHtml(item.title)}</h1>
          <p class="lead">${escapeHtml(item.city)} · ${escapeHtml(item.status)} · ${escapeHtml(item.config)}</p>
        </div>
        <div class="property-price">
          <strong>${escapeHtml(item.priceLabel)}</strong>
          <span>${escapeHtml(item.priceNote)}</span>
        </div>
      </div>

      <div class="property-visual" style="filter: brightness(0.7);">
        <img src="${item.image}" alt="Preview image for ${escapeHtml(item.title)}">
        <span style="background: rgba(224, 186, 123, 0.2); color: var(--gold); border: 1px solid var(--border-gold);">
          🔒 Dossier Locked
        </span>
      </div>

      <div class="property-locked-banner">
        <div class="auth-lock-icon" style="margin: 0 auto 16px;">🔒</div>
        <h2>Sign in to Unlock Full Dossier & Photography</h2>
        <p>
          Architectural blueprints, 4K multi-photo gallery, acoustic ratings, and floor plans for <strong>${escapeHtml(item.title)}</strong> are reserved for authenticated members.
        </p>
        <div style="display: flex; justify-content: center; gap: 14px; flex-wrap: wrap;">
          <button type="button" class="button button-gold" id="page-unlock-btn">
            Sign In & View Full Info →
          </button>
          <button type="button" class="button button-ghost-light" id="page-demo-unlock-btn">
            ⚡ Quick 1-Click Guest Unlock
          </button>
        </div>
      </div>
    `;

    document.querySelector('#page-unlock-btn').addEventListener('click', () => openAuthModal(item.id));
    document.querySelector('#page-demo-unlock-btn').addEventListener('click', () => {
      executeLogin({ name: 'Alex Morgan', email: 'alex.morgan@example.com' });
      setupProperty();
    });
    return;
  }

  // User IS logged in: Render complete unlocked dossier with multi-photo gallery & specs!
  main.innerHTML = `
    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="index.html">Discover</a><span>/</span>
      <a href="listings.html">Portfolio</a><span>/</span>
      <span>${escapeHtml(item.title)}</span>
    </nav>

    <div class="property-heading">
      <div>
        <span class="eyebrow">${label(item.intent).toUpperCase()} // ${escapeHtml(item.city).toUpperCase()} · ${escapeHtml(item.locality)}</span>
        <h1>${escapeHtml(item.title)}</h1>
        <p class="lead">${escapeHtml(item.city)} · ${escapeHtml(item.status)} · Authenticated Member Dossier</p>
      </div>
      <div class="property-price">
        <strong>${escapeHtml(item.priceLabel)}</strong>
        <span>${escapeHtml(item.priceNote)}</span>
      </div>
    </div>

    <!-- Multi-Photo Gallery -->
    <div class="gallery-container" style="margin-bottom: 40px;">
      <div class="gallery-main-view">
        <img id="page-gallery-img" src="${gallery[0]}" alt="${escapeHtml(item.title)} primary view">
        <button type="button" class="gallery-nav-btn gallery-prev" id="page-gallery-prev">‹</button>
        <button type="button" class="gallery-nav-btn gallery-next" id="page-gallery-next">›</button>
        <div class="gallery-caption-bar">
          <span id="page-gallery-caption">${GALLERY_LABELS[0]}</span>
          <span class="gallery-counter" id="page-gallery-counter">PHOTO 1 OF ${gallery.length}</span>
        </div>
      </div>
      <div class="gallery-thumbs-row" id="page-gallery-thumbs">
        ${gallery.map((imgUrl, i) => `
          <div class="gallery-thumb-item ${i === 0 ? 'active' : ''}" data-idx="${i}">
            <img src="${imgUrl}" alt="Photo ${i + 1}">
            <span class="gallery-thumb-label">${GALLERY_LABELS[i] || `View ${i + 1}`}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="property-layout">
      <div class="property-detail">
        <div class="fact-row">
          <div><small>Property type</small><strong>${label(item.type)}</strong></div>
          <div><small>Configuration</small><strong>${escapeHtml(item.config)}</strong></div>
          <div><small>Super Built-Up Area</small><strong>${item.areaSqft.toLocaleString('en-IN')} sq.ft</strong></div>
        </div>

        <span class="eyebrow">Architectural Concept</span>
        <h2>Considered living space.</h2>
        <p class="lead">${escapeHtml(item.summary)}</p>

        <h3 style="margin-top: 36px;">Verified Spatial Highlights</h3>
        <ul class="highlight-list">
          ${item.highlights.map(h => `<li>${escapeHtml(h)}</li>`).join('')}
        </ul>

        <!-- TECHNICAL SPECIFICATIONS TABLE (From user photo) -->
        <div class="dossier-spec-section" style="margin-top: 36px;">
          <span class="dossier-section-title">TECHNICAL SPECIFICATIONS</span>
          <div class="tech-specs-table">
            ${Object.entries(Object.assign({
              "Ceiling Height": "10.6 ft clear height",
              "Flooring Material": "Micro-cement & smoked oak hardwood",
              "Acoustic & Thermal Glazing": "Saint-Gobain low-E thermal acoustic glass",
              "Covered Parking": "1 Dedicated Bays",
              "Balconies & Terraces": "2 Private Outdoor Balconies"
            }, item.technicalSpecs || {})).map(([k, v]) => `
              <div class="tech-spec-row">
                <div class="tech-spec-label">${escapeHtml(k)}</div>
                <div class="tech-spec-value">${escapeHtml(v)}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- RESIDENTIAL AMENITIES CHIPS (From user photo) -->
        <div class="dossier-amenities-section" style="margin-top: 24px;">
          <span class="dossier-section-title">RESIDENTIAL AMENITIES</span>
          <div class="amenities-chips-wrap">
            ${(item.amenities || [
              "Lap pool with slate stone perimeter",
              "Residents library & reading pavilion",
              "EV car charging bay",
              "24/7 security with RFID gate access",
              "Rooftop stargazing deck"
            ]).map(a => `<span class="amenity-chip">${escapeHtml(a)}</span>`).join('')}
          </div>
        </div>

        <!-- SCHEDULE A PRIVATE ARCHITECTURAL VIEWING & SEND BROCHURE -->
        <div class="viewing-brochure-card" style="margin-top: 36px; margin-bottom: 24px;">
          <h4>Schedule a Private Architectural Viewing</h4>
          <p>Walk through with a WONACRE certified architectural curator. No broker spam.</p>
          <form id="page-viewing-form">
            <div class="viewing-form-grid">
              <input type="text" class="viewing-input" id="page-viewing-name" placeholder="Your Full Name" value="${escapeHtml(user?.name || '')}" required>
              <input type="tel" class="viewing-input" id="page-viewing-phone" placeholder="Phone or WhatsApp Number" value="${escapeHtml(user?.phone || '')}" required>
            </div>
            <button type="submit" class="viewing-submit-btn">
              Confirm Viewing Appointment & Send Brochure
            </button>
          </form>
          <div id="page-viewing-success" class="viewing-success-box" hidden>
            <strong style="color: var(--emerald); font-size: 0.95rem;">✓ Official Brochure & Dossier Dispatched!</strong>
            <p style="margin: 6px 0 0; color: #cbd5e1; font-size: 0.82rem; line-height: 1.5;">
              The full architectural brochure and specifications for <strong>${escapeHtml(item.title)}</strong> have been sent to WhatsApp. A WONACRE curator will coordinate your private walkthrough shortly.
            </p>
          </div>
        </div>

        <div class="property-honesty">
          <strong>Verified Architectural Dossier</strong>
          <p>This dossier contains authenticated spatial blueprints and photography for ${escapeHtml(item.title)}. All specifications have been indexed for spatial intelligence searches.</p>
        </div>
      </div>

      <aside class="property-side">
        <span class="eyebrow">Interested in this space?</span>
        <h2>Connect with an Advisor</h2>
        <p class="lead" style="font-size: 0.95rem;">
          Coordinate a private site walkthrough or request custom spatial blueprints.
        </p>
        <button class="button button-gold" type="button" id="page-save-btn">
          ${saved ? '★ Saved to My Portfolio' : '☆ Save to My Portfolio'}
        </button>
        <a class="button button-dark" href="contact.html?listing=${encodeURIComponent(item.id)}">
          Schedule Private Tour →
        </a>
        <button class="button button-ghost-light" type="button" data-open-chat>
          Ask WONACRE AI About This ✦
        </button>
      </aside>
    </div>

    <div class="related-heading">
      <span class="eyebrow">Keep exploring</span>
      <h2>More spaces to consider</h2>
    </div>
    <div class="card-grid related-grid">
      ${listings.filter(entry => entry.id !== item.id).slice(0, 3).map(entry => card(entry)).join('')}
    </div>
  `;

  // Gallery slider logic for page
  let pageGalleryIdx = 0;
  const pageMainImg = document.querySelector('#page-gallery-img');
  const pageCaption = document.querySelector('#page-gallery-caption');
  const pageCounter = document.querySelector('#page-gallery-counter');
  const thumbs = document.querySelectorAll('#page-gallery-thumbs .gallery-thumb-item');

  function updatePageGallery() {
    if (pageGalleryIdx < 0) pageGalleryIdx = gallery.length - 1;
    if (pageGalleryIdx >= gallery.length) pageGalleryIdx = 0;
    pageMainImg.src = gallery[pageGalleryIdx];
    pageCaption.textContent = GALLERY_LABELS[pageGalleryIdx] || `Photograph ${pageGalleryIdx + 1}`;
    pageCounter.textContent = `PHOTO ${pageGalleryIdx + 1} OF ${gallery.length}`;
    thumbs.forEach((t, i) => t.classList.toggle('active', i === pageGalleryIdx));
  }

  document.querySelector('#page-gallery-prev').addEventListener('click', () => { pageGalleryIdx--; updatePageGallery(); });
  document.querySelector('#page-gallery-next').addEventListener('click', () => { pageGalleryIdx++; updatePageGallery(); });
  thumbs.forEach(t => t.addEventListener('click', () => { pageGalleryIdx = Number(t.dataset.idx); updatePageGallery(); }));

  // Page save button
  const pageSaveBtn = document.querySelector('#page-save-btn');
  if (pageSaveBtn) {
    pageSaveBtn.addEventListener('click', () => {
      const isNow = toggleSaved(item.id);
      pageSaveBtn.textContent = isNow ? '★ Saved to My Portfolio' : '☆ Save to My Portfolio';
    });
  }

  // Page viewing & brochure form
  const pageForm = document.querySelector('#page-viewing-form');
  const pageSuccess = document.querySelector('#page-viewing-success');
  if (pageForm && pageSuccess) {
    pageForm.addEventListener('submit', (e) => {
      e.preventDefault();
      pageForm.style.display = 'none';
      pageSuccess.hidden = false;
    });
  }

  // Attach card click listeners to related grid
  attachCardClickListeners(main.querySelector('.related-grid'));
}

/* =========================================================
   CONTACT PAGE (contact.html)
   ========================================================= */

function setupContact() {
  const item = listings.find(entry => entry.id === params.get('listing'));
  if (item) {
    document.querySelector('#enquiry-requirement').value = `I am interested in scheduling a tour of ${item.title} (${item.locality}, ${item.city}) - ${item.priceLabel}.`;
  }
  const form = document.querySelector('#enquiry-form');
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    form.hidden = true;
    document.querySelector('#enquiry-success').hidden = false;
  });
  document.querySelector('#enquiry-again').addEventListener('click', () => {
    form.reset();
    form.hidden = false;
    document.querySelector('#enquiry-success').hidden = true;
  });
}

/* =========================================================
   CHATBOT LOGIC
   ========================================================= */

function setChatOpen(open) {
  const panel = document.querySelector('#chat-panel');
  const backdrop = document.querySelector('#chat-backdrop');
  if (!panel) return;
  panel.hidden = !open;
  if (backdrop) backdrop.hidden = !open;
  const launcher = document.querySelector('#chat-launcher');
  if (launcher) launcher.setAttribute('aria-expanded', String(open));
  if (open) {
    document.body.classList.add('chat-modal-open');
    const input = document.querySelector('#chat-input');
    if (input) input.focus();
  } else {
    document.body.classList.remove('chat-modal-open');
  }
}

function addChatMessage(text, who) {
  const el = document.createElement('div');
  el.className = `chat-message ${who}`;
  el.textContent = text;
  document.querySelector('#chat-messages').append(el);
  el.scrollIntoView({ block: 'end', behavior: 'smooth' });
  return el;
}

function setupChat() {
  const form = document.querySelector('#chat-form');
  const input = document.querySelector('#chat-input');
  if (!form || !input) return;

  fetch('/api/status').then(r => r.json()).then(data => {
    const modeEl = document.querySelector('#chat-mode');
    if (modeEl) {
      modeEl.textContent = data.geminiConfigured ? 'Gemini Architectural Intelligence' : 'Active Metropolis Spatial Model';
    }
  }).catch(() => {
    const modeEl = document.querySelector('#chat-mode');
    if (modeEl) modeEl.textContent = 'Active Metropolis Spatial Model';
  });

  async function sendMessage(message) {
    const clean = message.trim();
    if (!clean) return;
    addChatMessage(clean, 'user');
    input.value = '';

    const user = getAuthUser();

    input.disabled = true;
    form.querySelector('button').disabled = true;

    const pending = addChatMessage('Analyzing architectural database…', 'bot');
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: clean, filters: chatFilters })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Chat is unavailable.');
      chatFilters = data.filters || {};

      // Requirement: Minimal info first!
      pending.textContent = data.reply;

      const found = (data.listingIds || []).map(id => listings.find(item => item.id === id)).filter(Boolean).slice(0, 3);
      if (found.length) {
        // Minimal clickable list
        const group = document.createElement('div');
        group.className = 'chat-result-list';
        group.innerHTML = found.map(item => `
          <a href="${propertyUrl(item.id)}" data-chat-property-id="${escapeHtml(item.id)}">
            <strong>${escapeHtml(item.title)}</strong>
            <span>${escapeHtml(item.locality)}, ${escapeHtml(item.city)} · ${escapeHtml(item.priceLabel)}</span>
            <i>↗</i>
          </a>
        `).join('');

        group.querySelectorAll('a').forEach(a => {
          a.addEventListener('click', (e) => {
            handlePropertyClick(e, a.dataset.chatPropertyId);
          });
        });
        document.querySelector('#chat-messages').append(group);

        // Interactive Brochure & Private Viewing Card for the top match (matching user photo)
        const topItem = found[0];
        const cardEl = document.createElement('div');
        cardEl.className = 'chat-brochure-viewing-card';

        const defaultSpecs = {
          "Ceiling Height": "10.6 ft clear height",
          "Acoustic & Thermal Glazing": "Saint-Gobain low-E thermal acoustic glass",
          "Covered Parking": "1 Dedicated Bays"
        };
        const specs = Object.assign({}, defaultSpecs, topItem.technicalSpecs || {});
        const amenities = topItem.amenities || [
          "Lap pool with slate stone perimeter",
          "Residents library & reading pavilion",
          "EV car charging bay",
          "24/7 security with RFID gate access"
        ];

        cardEl.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <div>
              <span class="eyebrow light" style="font-size: 0.65rem; margin-bottom: 2px;">ARCHITECTURAL DOSSIER</span>
              <h4 style="margin: 0; font-size: 0.95rem; color: #ffffff;">${escapeHtml(topItem.title)}</h4>
              <span style="font-size: 0.78rem; color: var(--gold); font-weight: 600;">${escapeHtml(topItem.priceLabel)} · ${escapeHtml(topItem.config)}</span>
            </div>
            <button type="button" class="button button-ghost-light" style="padding: 4px 10px; font-size: 0.72rem;" id="chat-open-dossier-btn">
              Full Dossier ↗
            </button>
          </div>

          <div style="font-size: 0.68rem; font-weight: 700; color: #8493a5; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 6px;">
            TECHNICAL SPECIFICATIONS
          </div>
          <div class="chat-mini-specs">
            <span>📐 Ceiling: ${escapeHtml(specs['Ceiling Height'] || '10.6 ft')}</span>
            <span>🪟 Glazing: ${escapeHtml(specs['Acoustic & Thermal Glazing'] || 'Saint-Gobain')}</span>
            <span>🚗 Parking: ${escapeHtml(specs['Covered Parking'] || '1 Dedicated Bay')}</span>
          </div>

          <div style="font-size: 0.68rem; font-weight: 700; color: #8493a5; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 6px;">
            RESIDENTIAL AMENITIES
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px;">
            ${amenities.slice(0, 3).map(a => `<span class="amenity-chip" style="font-size: 0.7rem; padding: 4px 8px;">${escapeHtml(a)}</span>`).join('')}
          </div>

          <!-- Schedule a Private Architectural Viewing Card matching user photo -->
          <div style="background: rgba(10, 13, 18, 0.7); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 6px; padding: 12px;">
            <strong style="font-size: 0.85rem; color: #fff; display: block; margin-bottom: 2px;">
              Schedule a Private Architectural Viewing
            </strong>
            <p style="font-size: 0.72rem; color: var(--ink-secondary); margin: 0 0 10px;">
              Walk through with a WONACRE certified architectural curator. No broker spam.
            </p>

            <form class="chat-viewing-form">
              <div class="chat-brochure-inputs">
                <input type="text" name="name" placeholder="Your Full Name" value="${escapeHtml(user?.name || '')}" required>
                <input type="tel" name="phone" placeholder="Phone or WhatsApp Number" value="${escapeHtml(user?.phone || '')}" required>
                <button type="submit" class="viewing-submit-btn" style="height: 38px; font-size: 0.78rem;">
                  Confirm Viewing & Send Brochure
                </button>
              </div>
            </form>
            <div class="chat-viewing-success" style="display: none; font-size: 0.78rem; color: var(--emerald); padding-top: 8px;">
              ✓ Official brochure dispatched to WhatsApp! A WONACRE curator will coordinate your private viewing.
            </div>
          </div>
        `;

        cardEl.querySelector('#chat-open-dossier-btn').addEventListener('click', (e) => {
          handlePropertyClick(e, topItem.id);
        });

        const vForm = cardEl.querySelector('.chat-viewing-form');
        const vSuccess = cardEl.querySelector('.chat-viewing-success');
        vForm.addEventListener('submit', (e) => {
          e.preventDefault();
          vForm.style.display = 'none';
          vSuccess.style.display = 'block';
        });

        document.querySelector('#chat-messages').append(cardEl);
      }
      pending.scrollIntoView({ block: 'end', behavior: 'smooth' });
    } catch (error) {
      pending.textContent = error.message;
    } finally {
      input.disabled = false;
      form.querySelector('button').disabled = false;
      input.focus();
    }
  }

  window.sendChatMessage = sendMessage;

  form.addEventListener('submit', event => {
    event.preventDefault();
    sendMessage(input.value);
  });

  document.querySelectorAll('.chat-suggestions button').forEach(button => {
    button.addEventListener('click', () => sendMessage(button.textContent));
  });
}

/* =========================================================
   APPLICATION BOOTSTRAP
   ========================================================= */

async function init() {
  renderShell();

  try {
    const response = await fetch('data/listings.json');
    if (!response.ok) throw new Error('Could not load portfolio');
    listings = await response.json();
  } catch {
    document.querySelector('main').insertAdjacentHTML('afterbegin', '<p class="data-error" style="color: #ef4444; padding: 20px;">Could not load listings. Please run local server.</p>');
  }

  if (page === 'home') setupHome();
  if (page === 'listings') setupListings();
  if (page === 'property') setupProperty();
  if (page === 'contact') setupContact();

  setupChat();
}

init();

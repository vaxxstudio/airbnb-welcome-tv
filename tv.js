/**
 * Aura TV — Apple TV Welcome Experience
 * Exact Match to User Reference Layout & Apple TV Typography
 * Liquid Glassmorphism, Live SSE Sync, D-Pad Navigation, Ambient Screensaver
 */

let currentData = null;
let qrInstance = null;
let screensaverTimer = null;
const SCREENSAVER_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

// URL parameters: /?tv=living-room&room=Living+Room
const urlParams = new URLSearchParams(window.location.search);
const tvId = urlParams.get('tv') || 'living-room';
const rawRoom = urlParams.get('room') || 'Living Room';
const roomName = rawRoom.replace(/\+/g, ' ').trim();

// Themes: Apple TV Scenic Wallpaper (Auto-rotates) vs Dark Obsidian Studio
const THEMES = ['apple_scenic', 'dark_obsidian'];
let currentThemeIndex = 0;

// High-Definition Wallpapers from Previous Edits (Rotates every 15s)
let WALLPAPERS = [
  'assets/backdrop-landscape.jpg',
  'assets/pine-sunbeams.jpg',
  'assets/pine-forest-2.jpg',
  'assets/pine-forest-3.jpg',
  'assets/backdrop-living-room.jpg'
];
let currentWallpaperIdx = 0;
let activeBackdrop = 'A';
let wallpaperInterval = null;

document.addEventListener('DOMContentLoaded', () => {
  initClock();
  generateWifiQr('Comfort Stay Guest', 'GuestWiFi@123', 'WPA');
  setupWallpaperRotator();
  setupCardsAndAmenities();
  setupModals();
  setupDpadNavigation();
  setupScreensaver();
  startHeartbeat();
  connectLiveSync();
});

// -------------------------------------------------------------
// Auto Wallpaper Rotation (Cycles every 15 seconds)
// -------------------------------------------------------------
function setupWallpaperRotator() {
  const backdropA = document.getElementById('tvBackdropA');
  const backdropB = document.getElementById('tvBackdropB');
  if (!backdropA || !backdropB) return;

  // Preload images into memory for instant transitions
  WALLPAPERS.forEach(src => {
    const img = new Image();
    img.src = src;
  });

  function rotateWallpaper() {
    currentWallpaperIdx = (currentWallpaperIdx + 1) % WALLPAPERS.length;
    const nextSrc = WALLPAPERS[currentWallpaperIdx];

    if (activeBackdrop === 'A') {
      backdropB.src = nextSrc;
      backdropB.classList.add('active');
      backdropA.classList.remove('active');
      activeBackdrop = 'B';
    } else {
      backdropA.src = nextSrc;
      backdropA.classList.add('active');
      backdropB.classList.remove('active');
      activeBackdrop = 'A';
    }
  }

  if (wallpaperInterval) clearInterval(wallpaperInterval);
  wallpaperInterval = setInterval(rotateWallpaper, 15000);
}

// -------------------------------------------------------------
// TV Heartbeat ("Every TV, by Name")
// -------------------------------------------------------------
function startHeartbeat() {
  function sendBeat() {
    fetch(`/api/heartbeat?tv=${encodeURIComponent(tvId)}&room=${encodeURIComponent(roomName)}`)
      .catch(() => {});
  }
  sendBeat();
  setInterval(sendBeat, 30000);
}

// -------------------------------------------------------------
// Synthesized tvOS Audio Click Feedback
// -------------------------------------------------------------
function playTvClick() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(280, ctx.currentTime + 0.045);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.045);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.045);
  } catch (e) {}
}

// -------------------------------------------------------------
// Live Clock Engine
// -------------------------------------------------------------
function initClock() {
  const topClock = document.getElementById('topClock');
  const ssClock = document.getElementById('ssClock');

  function update() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    if (topClock) topClock.textContent = timeStr;
    if (ssClock) ssClock.textContent = timeStr;
  }
  update();
  setInterval(update, 1000);
}

// -------------------------------------------------------------
// Interactive Cards & Amenities Setup
// -------------------------------------------------------------
function setupCardsAndAmenities() {
  // Wi-Fi Card click -> Fullscreen QR
  const wifiCard = document.getElementById('cardWifi');
  if (wifiCard) {
    wifiCard.addEventListener('click', () => {
      playTvClick();
      openWifiModal();
    });
  }

  // Stay Capsule click -> Stay info / Checkout modal
  const stayCapsule = document.getElementById('cardStayCheckout');
  if (stayCapsule) {
    stayCapsule.addEventListener('click', () => {
      playTvClick();
      openStayModal();
    });
  }

  // Amenities Click Handlers
  const amenityItems = document.querySelectorAll('.apple-amenity-item');
  amenityItems.forEach(item => {
    item.addEventListener('click', () => {
      playTvClick();
      const type = item.getAttribute('data-amenity');
      openAmenityModal(type);
    });
  });

  // Top Bar Controls
  const btnTheme = document.getElementById('btnThemeToggle');
  if (btnTheme) {
    btnTheme.addEventListener('click', () => {
      playTvClick();
      toggleTheme();
    });
  }

  const btnCheckout = document.getElementById('btnCheckoutToggle');
  if (btnCheckout) {
    btnCheckout.addEventListener('click', () => {
      playTvClick();
      toggleCheckoutMode();
    });
  }
}

function toggleTheme() {
  currentThemeIndex = (currentThemeIndex + 1) % THEMES.length;
  const theme = THEMES[currentThemeIndex];
  document.body.setAttribute('data-theme', theme);
}

function toggleCheckoutMode() {
  if (!currentData) return;
  currentData.guest = currentData.guest || {};
  currentData.guest.overrideMode = (currentData.guest.overrideMode === 'checkout') ? 'welcome' : 'checkout';
  renderScreen(currentData);
}

// -------------------------------------------------------------
// Wi-Fi QR Code Generator (RFC Spec Escaping)
// -------------------------------------------------------------
function generateWifiQr(ssid, password, security = 'WPA') {
  const container = document.getElementById('wifiQrCode');
  if (!container) return;

  if (typeof QRCode === 'undefined') {
    setTimeout(() => generateWifiQr(ssid, password, security), 150);
    return;
  }

  const safeSsid = (ssid || 'Comfort Stay Guest').replace(/([\\;,:"])/g, '\\$1');
  const safePass = (password || 'GuestWiFi@123').replace(/([\\;,:"])/g, '\\$1');
  const safeSec = security || 'WPA';

  const wifiString = `WIFI:S:${safeSsid};T:${safeSec};P:${safePass};;`;

  container.innerHTML = '';
  try {
    qrInstance = new QRCode(container, {
      text: wifiString,
      width: 144,
      height: 144,
      colorDark: "#111827",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M
    });
  } catch (err) {
    console.error('Error rendering QR code:', err);
  }
}

// -------------------------------------------------------------
// Weather Engine (MET Norway / Open-Meteo)
// -------------------------------------------------------------
async function fetchWeather(lat, lon, cityName = 'Gurugram') {
  const tempNowEl = document.getElementById('weatherTempNow');
  const cityNowEl = document.getElementById('weatherCityNow');

  try {
    let useLat = lat || 28.4595;
    let useLon = lon || 77.0266;

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${useLat}&longitude=${useLon}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Weather fetch failed');
    const data = await res.json();

    const currentTemp = Math.round(data.current.temperature_2m);
    if (tempNowEl) tempNowEl.textContent = `${currentTemp}°`;
    if (cityNowEl) cityNowEl.textContent = `Now · ${cityName || 'Gurugram'}`;

    if (data.daily && data.daily.time) {
      for (let i = 0; i < 3; i++) {
        const dayLabelEl = document.getElementById(`day${i+1}Label`);
        const dayIconEl = document.getElementById(`day${i+1}Icon`);
        const dayRangeEl = document.getElementById(`day${i+1}Range`);

        if (dayLabelEl) {
          if (i === 0) dayLabelEl.textContent = 'Today';
          else {
            const d = new Date(data.daily.time[i]);
            dayLabelEl.textContent = d.toLocaleDateString([], { weekday: 'short' });
          }
        }
        if (dayIconEl) {
          const code = data.daily.weather_code[i];
          dayIconEl.textContent = (code === 0) ? '☀️' : (code <= 3) ? '⛅' : '🌧️';
        }
        if (dayRangeEl) {
          const max = Math.round(data.daily.temperature_2m_max[i]);
          const min = Math.round(data.daily.temperature_2m_min[i]);
          dayRangeEl.textContent = `${max}° ${min}°`;
        }
      }
    }
  } catch (err) {
    if (tempNowEl) tempNowEl.textContent = `26°`;
    if (cityNowEl) cityNowEl.textContent = `Now · Gurugram`;
  }
}

// -------------------------------------------------------------
// Render Screen Data
// -------------------------------------------------------------
function renderScreen(data) {
  if (!data) return;
  currentData = data;

  const prop = data.property || {};
  const guest = data.guest || {};
  const wifi = data.wifi || {};

  // Dynamically update wallpaper rotation list if host has custom wallpapers
  if (prop.wallpapers && Array.isArray(prop.wallpapers) && prop.wallpapers.length > 0) {
    WALLPAPERS = prop.wallpapers;
  }

  // 1. Property Identity & Header
  const propNameTitle = document.getElementById('propNameTitle');
  const propMetaLine = document.getElementById('propMetaLine');
  const propCityTag = document.getElementById('propCityTag');
  const brandBadge = document.getElementById('brandHouseBadge') || document.querySelector('.brand-house-badge');

  if (brandBadge) {
    if (prop.logoUrl && prop.logoUrl.trim()) {
      brandBadge.classList.add('has-custom-logo');
      const size = prop.logoSize || 'medium';
      if (size === 'large') {
        brandBadge.style.height = '54px';
        brandBadge.style.maxWidth = '180px';
      } else if (size === 'small') {
        brandBadge.style.height = '34px';
        brandBadge.style.maxWidth = '110px';
      } else {
        brandBadge.style.height = '44px';
        brandBadge.style.maxWidth = '140px';
      }
      brandBadge.innerHTML = `<img src="${escapeAttr(prop.logoUrl.trim())}" alt="${escapeAttr(prop.name || 'Brand Logo')}" onerror="this.onerror=null; this.parentElement.classList.remove('has-custom-logo'); this.parentElement.innerHTML='<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2.2\\'><path d=\\'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\\'></path><polyline points=\\'9 22 9 12 15 12 15 22\\'></polyline></svg>';">`;
    } else {
      brandBadge.classList.remove('has-custom-logo');
      brandBadge.style.width = '42px';
      brandBadge.style.height = '42px';
      brandBadge.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
      `;
    }
  }

  if (propNameTitle) propNameTitle.textContent = prop.name || 'Comfort Stay near CyberHub';
  if (propMetaLine) {
    const rawMeta = prop.metaSubtitle || '1BHK · 300 MBPS WI-FI';
    propMetaLine.textContent = rawMeta.replace(/·\s*GURUGRAM/gi, '').trim();
  }
  if (propCityTag) propCityTag.textContent = (prop.location || 'GURUGRAM').toUpperCase();

  // 2. Main Greeting & Mode (Welcome vs Checkout)
  const grandHeadline = document.getElementById('grandHeadline');
  const sublineText = document.getElementById('heroSublineText');
  const hostSignoff = document.getElementById('hostSignoff');

  const rawMode = guest.overrideMode || 'auto';
  let activeMode = rawMode;
  if (rawMode === 'auto') {
    const todayStr = new Date().toDateString();
    if (guest.checkOut && new Date(guest.checkOut).toDateString() === todayStr) {
      activeMode = 'checkout';
    } else {
      activeMode = 'welcome';
    }
  }

  const guestName = guest.names || 'Rahul';

  if (activeMode === 'checkout') {
    if (grandHeadline) {
      grandHeadline.innerHTML = `Safe Travels, <span class="guest-amber-name">${escapeHtml(guestName)}!</span>`;
    }
    if (sublineText) {
      sublineText.textContent = `Checkout is today at ${guest.checkoutTime || '11:00 AM'}. Thank you for staying with us at ${prop.name || 'Comfort Stay'}.`;
    }
  } else {
    if (grandHeadline) {
      grandHeadline.innerHTML = `Welcome, <span class="guest-amber-name">${escapeHtml(guestName)}!</span>`;
    }
    if (sublineText) {
      sublineText.textContent = guest.welcomeNote || 'Make yourself at home. If you need anything, message me on Airbnb.';
    }
  }

  if (hostSignoff) {
    const rawSignoff = (guest.hostSignoff || '').trim();
    const activeHost = (prop.hostName || '').trim();
    if (rawSignoff && !rawSignoff.toLowerCase().includes('wasim')) {
      hostSignoff.textContent = rawSignoff.startsWith('–') || rawSignoff.startsWith('-') ? rawSignoff : `– ${rawSignoff}`;
    } else if (activeHost) {
      hostSignoff.textContent = `– ${activeHost}`;
    } else {
      hostSignoff.textContent = '– Gautham';
    }
  }

  // 3. Stay & Checkout Capsule Values
  const stayDatesText = document.getElementById('stayDatesText');
  const stayNightsText = document.getElementById('stayNightsText');
  const checkoutTimeText = document.getElementById('checkoutTimeText');

  if (stayDatesText) {
    const cin = guest.checkIn || 'Sat 7 Nov';
    const cout = guest.checkOut || 'Tue 10 Nov';
    stayDatesText.textContent = `${cin} → ${cout}`;
  }
  if (stayNightsText) {
    stayNightsText.textContent = guest.stayNights || '3 nights';
  }
  if (checkoutTimeText) {
    checkoutTimeText.textContent = guest.checkoutTime || 'Tue 10 Nov, 11:00 AM';
  }

  // 3b. Render Dynamic Stay Amenities
  renderAmenities(data.amenities);

  // 4. Wi-Fi Card
  const ssidVal = document.getElementById('wifiSsidVal');
  const passVal = document.getElementById('wifiPassVal');
  if (ssidVal) ssidVal.textContent = wifi.ssid || 'Comfort Stay Guest';
  if (passVal) passVal.textContent = wifi.password || 'GuestWiFi@123';

  generateWifiQr(wifi.ssid, wifi.password, wifi.security);

  // 5. Weather
  fetchWeather(data.weather?.latitude, data.weather?.longitude, data.weather?.city || prop.location || 'Gurugram');

  // 6. Host Contact Support
  const hostContactText = document.getElementById('hostContactText');
  if (hostContactText) {
    hostContactText.textContent = prop.hostContact || "Message Wasim on the Airbnb app";
  }

  // 7. Screensaver
  const ssGreeting = document.getElementById('ssGreeting');
  if (ssGreeting) {
    ssGreeting.textContent = `${prop.name || 'Comfort Stay'} • Welcome, ${guestName}`;
  }
}

// -------------------------------------------------------------
// Modals (Wi-Fi Fullscreen, Amenity Details, Stay Details)
// -------------------------------------------------------------
function setupModals() {
  const scrim = document.getElementById('landscapeModal');
  const closeBtn = document.getElementById('modalCloseBtn');

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (scrim) {
    scrim.addEventListener('click', (e) => {
      if (e.target === scrim) closeModal();
    });
  }
}

function openModal(htmlContent) {
  const scrim = document.getElementById('landscapeModal');
  const inner = document.getElementById('modalContentInner');
  if (inner) inner.innerHTML = htmlContent;
  if (scrim) scrim.classList.add('modal-open');
}

function closeModal() {
  const scrim = document.getElementById('landscapeModal');
  if (scrim) scrim.classList.remove('modal-open');
}

function openWifiModal() {
  const wifi = currentData?.wifi || { ssid: "Comfort Stay Guest", password: "GuestWiFi@123" };
  const safeSsid = (wifi.ssid || 'Comfort Stay Guest').replace(/([\\;,:"])/g, '\\$1');
  const safePass = (wifi.password || 'GuestWiFi@123').replace(/([\\;,:"])/g, '\\$1');
  const wifiString = `WIFI:S:${safeSsid};T:WPA;P:${safePass};;`;

  openModal(`
    <div style="display:flex; flex-direction:column; align-items:center; text-align:center; gap:20px;">
      <h2 style="font-family:var(--font-display); font-size:26px; font-weight:700;">Connect to Stay Wi-Fi</h2>
      <p style="font-size:15px; color:rgba(255,255,255,0.72); max-width:440px;">
        Scan with your phone camera to join instantly without typing credentials.
      </p>
      <div style="background:#ffffff; padding:18px; border-radius:20px; box-shadow:0 20px 50px rgba(0,0,0,0.6);" id="modalQrBox"></div>
      <div style="background:rgba(255,255,255,0.08); padding:16px 28px; border-radius:18px; display:flex; gap:36px; font-size:16px; border:1px solid rgba(255,255,255,0.12);">
        <div><span style="color:rgba(255,255,255,0.5); font-size:11px; display:block; text-transform:uppercase; letter-spacing:0.06em;">Network</span> <strong style="color:#ffffff;">${escapeHtml(wifi.ssid)}</strong></div>
        <div style="width:1px; background:rgba(255,255,255,0.15);"></div>
        <div><span style="color:rgba(255,255,255,0.5); font-size:11px; display:block; text-transform:uppercase; letter-spacing:0.06em;">Password</span> <strong style="color:#ffffff;">${escapeHtml(wifi.password)}</strong></div>
      </div>
    </div>
  `);

  setTimeout(() => {
    const box = document.getElementById('modalQrBox');
    if (box && typeof QRCode !== 'undefined') {
      new QRCode(box, {
        text: wifiString,
        width: 220,
        height: 220,
        colorDark: "#111827",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
      });
    }
  }, 40);
}

function openStayModal() {
  const guest = currentData?.guest || {};
  const prop = currentData?.property || {};

  openModal(`
    <div style="display:flex; flex-direction:column; gap:22px;">
      <div style="display:flex; align-items:center; gap:14px;">
        <div style="width:40px; height:40px; border-radius:10px; background:linear-gradient(145deg, #2b1f16, #1c1511); display:flex; align-items:center; justify-content:center; color:var(--accent-amber);">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        </div>
        <div>
          <h2 style="font-family:var(--font-display); font-size:22px; font-weight:700;">Stay & Departure Schedule</h2>
          <p style="font-size:13px; color:rgba(255,255,255,0.6);">${escapeHtml(prop.name || 'Comfort Stay')}</p>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
        <div style="background:rgba(255,255,255,0.06); padding:16px; border-radius:16px; border:1px solid rgba(255,255,255,0.08);">
          <span style="font-size:11px; text-transform:uppercase; color:rgba(255,255,255,0.5); letter-spacing:0.06em;">Check-in</span>
          <div style="font-size:17px; font-weight:600; margin-top:4px;">${escapeHtml(guest.checkIn || 'Sat 7 Nov')}</div>
          <span style="font-size:12px; color:rgba(255,255,255,0.5);">After 02:00 PM</span>
        </div>
        <div style="background:rgba(255,255,255,0.06); padding:16px; border-radius:16px; border:1px solid rgba(255,255,255,0.08);">
          <span style="font-size:11px; text-transform:uppercase; color:rgba(255,255,255,0.5); letter-spacing:0.06em;">Checkout</span>
          <div style="font-size:17px; font-weight:600; margin-top:4px;">${escapeHtml(guest.checkoutTime || 'Tue 10 Nov, 11:00 AM')}</div>
          <span style="font-size:12px; color:var(--accent-amber);">${escapeHtml(guest.stayNights || '3 nights')} stay</span>
        </div>
      </div>

      <div style="background:rgba(255,255,255,0.04); padding:18px; border-radius:16px; border:1px solid rgba(255,255,255,0.08);">
        <h4 style="font-size:14px; font-weight:600; color:#ffffff; margin-bottom:10px;">Checkout Steps:</h4>
        <ul style="font-size:13.5px; color:rgba(255,255,255,0.8); line-height:1.7; padding-left:18px;">
          <li>Turn off all air conditioning and geysers</li>
          <li>Leave apartment keys on the main dining table</li>
          <li>Pull the entrance door firmly shut until locked</li>
        </ul>
      </div>
    </div>
  `);
}

function getAmenitySvg(icon) {
  const ico = (icon || 'wifi').toLowerCase();
  switch (ico) {
    case 'wifi':
      return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4C7.31 4 3.07 5.9 0 8.98L12 21 24 8.98C20.93 5.9 16.69 4 12 4zm0 3.32c3.78 0 7.21 1.48 9.77 3.92L12 18.99 2.23 11.24C4.79 8.8 8.22 7.32 12 7.32z"/></svg>`;
    case 'tv':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect><polyline points="17 2 12 7 7 2"></polyline></svg>`;
    case 'ac':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="2" x2="12" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line><line x1="4.93" y1="19.07" x2="19.07" y2="4.93"></line></svg>`;
    case 'wash':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="2" width="16" height="20" rx="2"></rect><circle cx="12" cy="14" r="4"></circle><line x1="8" y1="6" x2="8.01" y2="6"></line></svg>`;
    case 'kitchen':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2v20"></path><path d="M21 2v6a3 3 0 0 1-3 3 3 3 0 0 1-3-3V2"></path><path d="M6 2v6a3 3 0 0 0 3 3 3 3 0 0 0 3-3V2"></path><path d="M9 11v11"></path></svg>`;
    case 'pool':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 12c2 1 4 1 6 0s4-1 6 0 4 1 6 0M2 18c2 1 4 1 6 0s4-1 6 0 4 1 6 0M10 4a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm4 4l-3-3-3 3"></path></svg>`;
    case 'work':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>`;
    case 'parking':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="4"></rect><path d="M9 17V7h4a3 3 0 0 1 0 6H9"></path></svg>`;
    case 'coffee':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 1v3M10 1v3M14 1v3"></path></svg>`;
    case 'balcony':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 21h18M4 10l8-6 8 6M6 14v7M18 14v7M10 14v7M14 14v7"></path></svg>`;
    case 'gym':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 4v16M18 4v16M2 8v8M22 8v8M6 12h12"></path></svg>`;
    case 'pets':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="4.5" cy="9.5" r="2.5"></circle><circle cx="9" cy="5.5" r="2.5"></circle><circle cx="15" cy="5.5" r="2.5"></circle><circle cx="19.5" cy="9.5" r="2.5"></circle><path d="M12 11c-3 0-5 2.5-5 5.5 0 2 1.5 3.5 5 3.5s5-1.5 5-3.5c0-3-2-5.5-5-5.5z"></path></svg>`;
    default:
      return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
  }
}

function renderAmenities(amenitiesList) {
  const shelf = document.getElementById('amenitiesShelf');
  if (!shelf) return;

  const defaultList = [
    { title: "High-speed Wi-Fi", sub: "Fast and free", icon: "wifi" },
    { title: "Smart TV", sub: "Apps & streaming", icon: "tv" },
    { title: "AC", sub: "Stay cool", icon: "ac" },
    { title: "Washing machine", sub: "Available", icon: "wash" },
    { title: "Kitchen", sub: "Cook with ease", icon: "kitchen" }
  ];

  const items = (amenitiesList && Array.isArray(amenitiesList) && amenitiesList.length > 0)
    ? amenitiesList
    : defaultList;

  shelf.innerHTML = items.map(item => `
    <div class="apple-amenity-item" tabindex="0" data-amenity="${escapeAttr(item.icon || 'wifi')}" title="${escapeAttr(item.title)} details">
      <div class="amenity-svg-box">
        ${getAmenitySvg(item.icon)}
      </div>
      <strong class="amenity-item-title">${escapeHtml(item.title)}</strong>
      <span class="amenity-item-sub">${escapeHtml(item.sub || '')}</span>
    </div>
  `).join('');

  shelf.querySelectorAll('.apple-amenity-item').forEach(el => {
    el.addEventListener('click', () => {
      playTvClick();
      const type = el.getAttribute('data-amenity');
      const title = el.querySelector('.amenity-item-title')?.textContent || '';
      const sub = el.querySelector('.amenity-item-sub')?.textContent || '';
      openAmenityModal(type, title, sub);
    });
  });
}

function openAmenityModal(type, title, sub) {
  const descriptions = {
    wifi: "Fiber optic connection with high-speed mesh routers. Ideal for 4K streaming, remote work, and gaming.",
    tv: "Equipped with Netflix, YouTube, Prime Video, and Apple AirPlay. Use guest mode or your own subscriptions securely.",
    ac: "Individual climate control remotes in each room. Recommended temperature: 24°C for optimum comfort.",
    wash: "Fully automatic front-load washer in the utility area. Detergent pods provided.",
    kitchen: "Includes microwave, induction cooktop, refrigerator, cookware, dinnerware, RO water, and kettle.",
    pool: "Private swimming pool. Available for guest use 07:00 to 22:00. Pool towels provided.",
    work: "Dedicated ergonomic desk, high-speed Wi-Fi, and multiple universal power sockets.",
    parking: "Complimentary reserved parking spot on property premises.",
    coffee: "Fresh coffee beans, French press, and electric kettle available in the kitchen.",
    balcony: "Private scenic balcony with outdoor lounge seating.",
    gym: "Fitness equipment available on property.",
    pets: "Pet-friendly accommodation. Please ensure pets stay off fine fabric furniture."
  };

  const modalTitle = title || "Property Amenity";
  const modalDesc = descriptions[type] || sub || "Available for your comfort throughout your stay.";

  openModal(`
    <div style="display:flex; flex-direction:column; gap:16px; text-align:left;">
      <h2 style="font-family:var(--font-display); font-size:22px; font-weight:700; color:var(--accent-amber);">${escapeHtml(modalTitle)}</h2>
      <p style="font-size:15px; color:rgba(255,255,255,0.85); line-height:1.6;">${escapeHtml(modalDesc)}</p>
      <div style="margin-top:12px; font-size:12.5px; color:rgba(255,255,255,0.5);">Press ESC or remote Back button to dismiss.</div>
    </div>
  `);
}

// -------------------------------------------------------------
// D-Pad Remote & Keyboard Navigation
// -------------------------------------------------------------
function setupDpadNavigation() {
  window.addEventListener('keydown', (e) => {
    resetScreensaver();

    if (e.key === 'Escape' || e.key === 'Backspace') {
      closeModal();
      return;
    }

    // Hotkey 'T': Toggle Theme (Obsidian vs Scenic Wallpaper)
    if (e.key === 't' || e.key === 'T') {
      toggleTheme();
      return;
    }

    // Hotkey 'W': Zoom Wi-Fi QR
    if (e.key === 'w' || e.key === 'W') {
      openWifiModal();
      return;
    }

    // Hotkey 'C': Toggle Checkout Mode
    if (e.key === 'c' || e.key === 'C') {
      toggleCheckoutMode();
      return;
    }
  });
}

// -------------------------------------------------------------
// Ambient Screensaver
// -------------------------------------------------------------
function setupScreensaver() {
  const overlay = document.getElementById('screensaverOverlay');

  function showScreensaver() {
    if (overlay) overlay.style.display = 'flex';
  }

  window.resetScreensaver = function() {
    if (overlay && overlay.style.display === 'flex') {
      overlay.style.display = 'none';
    }
    clearTimeout(screensaverTimer);
    screensaverTimer = setTimeout(showScreensaver, SCREENSAVER_TIMEOUT_MS);
  };

  ['mousemove', 'mousedown', 'keydown', 'touchstart'].forEach(evt => {
    window.addEventListener(evt, resetScreensaver, { passive: true });
  });

  if (overlay) overlay.addEventListener('click', resetScreensaver);
  resetScreensaver();
}

// -------------------------------------------------------------
// Live SSE Sync with Host Studio
// -------------------------------------------------------------
function connectLiveSync() {
  fetch('/api/data')
    .then(r => r.json())
    .then(data => renderScreen(data))
    .catch(err => console.error('Initial data fetch error:', err));

  if (typeof EventSource !== 'undefined') {
    const sse = new EventSource('/api/events');
    sse.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const data = (payload && (payload.property || payload.guest || payload.wifi)) ? payload : (payload.data || payload);
        renderScreen(data);
      } catch (e) {
        console.error('SSE message error:', e);
      }
    };
    sse.onerror = () => {
      setTimeout(connectLiveSync, 8000);
    };
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(str) {
  if (!str) return '';
  return String(str).replace(/"/g, '&quot;');
}

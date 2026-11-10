/**
 * Aura TV 2.0 — Host Studio Pro Engine (Glitches Fixed)
 * iCal Calendar Sync, Multi-TV Manager, 8 Color Palettes, 5 Layouts, and Live Push
 */

let state = null;
let currentPalette = 'apple_gold';
let currentHostPin = sessionStorage.getItem('host_pin') || '';

document.addEventListener('DOMContentLoaded', () => {
  verifyPinOnLoad();
  initDashboard();
  setupEventListeners();
  setupSecurityListeners();
});

async function verifyPinOnLoad() {
  const urlParams = new URLSearchParams(window.location.search);
  const queryPin = urlParams.get('pin');
  if (queryPin) {
    currentHostPin = queryPin.trim();
    sessionStorage.setItem('host_pin', currentHostPin);
  }

  const overlay = document.getElementById('pinLockOverlay');
  const errorMsg = document.getElementById('pinErrorMsg');
  const unlockInput = document.getElementById('unlockPinInput');

  if (!currentHostPin) {
    if (overlay) overlay.classList.remove('hidden');
    if (unlockInput) setTimeout(() => unlockInput.focus(), 150);
    return;
  }

  try {
    const res = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: currentHostPin })
    });
    if (res.ok) {
      if (overlay) overlay.classList.add('hidden');
    } else {
      sessionStorage.removeItem('host_pin');
      currentHostPin = '';
      if (overlay) overlay.classList.remove('hidden');
      if (errorMsg) errorMsg.textContent = 'Session locked. Please enter your PIN.';
      if (unlockInput) setTimeout(() => unlockInput.focus(), 150);
    }
  } catch (e) {
    if (overlay) overlay.classList.add('hidden');
  }
}

async function initDashboard() {
  updateDisplayUrls();
  initStayCalendar();

  try {
    const res = await fetch('/api/data');
    if (!res.ok) throw new Error('API fetch error');
    state = await res.json();
  } catch (e) {
    const local = localStorage.getItem('aura_tv_state');
    state = local ? JSON.parse(local) : null;
  }

  populateForm(state);
}

function updateDisplayUrls() {
  const host = window.location.host;
  const protocol = window.location.protocol;
  const tvUrl = `${protocol}//${host}/`;

  const urlEl = document.getElementById('tvDisplayUrl');
  const codeEl = document.getElementById('tvIpCode');
  if (urlEl) urlEl.textContent = tvUrl;
  if (codeEl) codeEl.textContent = tvUrl;

  const btnCopy = document.getElementById('btnCopyUrl');
  if (btnCopy) {
    btnCopy.addEventListener('click', () => {
      navigator.clipboard.writeText(tvUrl);
      showToast('TV Web Address copied to clipboard!');
    });
  }

  updateDirectHostLink();
}

function updateDirectHostLink(pin) {
  const host = window.location.host;
  const protocol = window.location.protocol;
  const usePin = pin || (state?.security?.pin) || currentHostPin || '8899';
  const directUrl = `${protocol}//${host}/dashboard?pin=${usePin}`;
  const inputEl = document.getElementById('inputDirectHostUrl');
  if (inputEl) inputEl.value = directUrl;
}

function populateForm(data) {
  if (!data) return;

  const prop = data.property || {};
  const guest = data.guest || {};
  const wifi = data.wifi || {};
  const photos = prop.photos || {};

  // Security & Host PIN
  const pin = data.security?.pin || '8899';
  setValue('inputHostPin', pin);
  updateDirectHostLink(pin);

  // 1. Guest & Screen Mode
  setValue('selectOverrideMode', guest.overrideMode || 'welcome');
  setValue('inputGuestNames', guest.names);
  setValue('inputCheckIn', guest.checkIn);
  setValue('inputCheckOut', guest.checkOut);
  setValue('inputCheckoutTime', guest.checkoutTime || '11:00 AM');
  setValue('inputWelcomeNote', guest.welcomeNote);
  syncStayCalendarFromInputs();

  // 2. Property & Host Profile
  setValue('inputPropName', prop.name || 'The Glasshouse Villa');
  setValue('inputPropLoc', prop.location || 'Malibu, California');
  setValue('inputHostName', prop.hostName || 'Marcus & Elena');
  setValue('inputHostContact', prop.hostContact || '+1 (310) 555-0192');

  // 3. Wi-Fi & Weather City
  setValue('inputWifiSsid', wifi.ssid);
  setValue('inputWifiPass', wifi.password);
  setValue('selectWifiSecurity', wifi.security || 'WPA');
  setValue('inputWeatherCity', data.weather?.city || 'Malibu');

  // 4. Design & Layouts
  setValue('selectLayout', prop.layout || 'shelf');
  currentPalette = prop.colorPalette || 'apple_gold';
  updatePaletteSelection(currentPalette);

  // 5. Logo & 3-State Photos
  setValue('inputLogoUrl', prop.logoUrl || '');
  setValue('selectLogoPosition', prop.logoPosition || 'header');
  setValue('selectLogoSize', prop.logoSize || 'medium');
  setValue('inputPhotoStay', photos.stay || '');
  setValue('inputPhotoCheckout', photos.checkout || '');
  setValue('inputPhotoIdle', photos.idle || '');

  // Initialize Custom Wallpapers for TV Rotation
  if (prop.wallpapers && Array.isArray(prop.wallpapers) && prop.wallpapers.length > 0) {
    customWallpapers = [...prop.wallpapers];
  }
  renderWallpapersGrid();

  // Setup Upload Buttons & Previews
  setupImageUploader('btnUploadLogo', 'fileLogo', 'inputLogoUrl', 'previewBoxLogo', 'thumbLogo', 'metaLogo');
  setupImageUploader('btnUploadPhotoStay', 'filePhotoStay', 'inputPhotoStay', 'previewBoxPhotoStay', 'thumbPhotoStay', 'metaPhotoStay');
  setupImageUploader('btnUploadPhotoCheckout', 'filePhotoCheckout', 'inputPhotoCheckout', 'previewBoxPhotoCheckout', 'thumbPhotoCheckout', 'metaPhotoCheckout');
  setupImageUploader('btnUploadPhotoIdle', 'filePhotoIdle', 'inputPhotoIdle', 'previewBoxPhotoIdle', 'thumbPhotoIdle', 'metaPhotoIdle');
  setupWallpaperUpload();

  // 6. Multi-OTA Calendar Links & Bookings
  renderCalendarsList(data.calendars || []);
  renderBookingsList(data.bookings || []);

  // 7. Multi-TV Device Manager
  renderTvList(data.tvs || []);

  // 8. Repeaters: Rules, Checkout, Local Guide, Amenities
  renderRulesRepeater(data.rules || []);
  renderCheckoutRepeater(data.checkout || []);
  renderGuideRepeater(data.recommendations || []);
  renderAmenitiesRepeater(data.amenities || []);
}

function updatePaletteSelection(palette) {
  document.querySelectorAll('#paletteGrid .theme-card').forEach(card => {
    if (card.dataset.palette === palette) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
  });
}

const DEFAULT_CALENDAR_CHANNELS = [
  {
    id: "cal_airbnb",
    name: "Airbnb",
    type: "airbnb",
    url: "https://www.airbnb.co.in/calendar/ical/1608518019172162450.ics?t=d0c9317592234ce0baf9bf0a136d0a49",
    status: "idle",
    lastSynced: null
  },
  {
    id: "cal_booking",
    name: "Booking.com",
    type: "booking",
    url: "https://ical.booking.com/v1/export?t=cd2f7888-34fa-410a-b06b-c11bc831d79c",
    status: "idle",
    lastSynced: null
  },
  {
    id: "cal_mmt",
    name: "MakeMyTrip / Goibibo",
    type: "mmt",
    url: "https://ingo-content-clientbackend.goibibo.com/public/ecs/downloadCalendar/45002010708?bid=b57f0e8adcad2f049b7b94f5fb70bb42&otherBrandName=zen",
    status: "idle",
    lastSynced: null
  }
];

function renderCalendarsList(configuredCalendars) {
  const container = document.getElementById('calendarsListContainer');
  if (!container) return;

  let list = Array.isArray(configuredCalendars) && configuredCalendars.length > 0
    ? [...configuredCalendars]
    : [...DEFAULT_CALENDAR_CHANNELS];

  // If previous single calendar was saved as 'cal_1', map it to Booking.com or Airbnb properly
  if (list.length === 1 && list[0].id === 'cal_1') {
    const singleUrl = list[0].url || '';
    list = DEFAULT_CALENDAR_CHANNELS.map(ch => {
      if (singleUrl.includes('booking.com') && ch.type === 'booking') {
        return { ...ch, url: singleUrl, status: list[0].status || 'active', lastSynced: list[0].lastSynced };
      }
      if (singleUrl.includes('airbnb') && ch.type === 'airbnb') {
        return { ...ch, url: singleUrl, status: list[0].status || 'active', lastSynced: list[0].lastSynced };
      }
      return ch;
    });
  }

  container.innerHTML = list.map((cal, idx) => createCalendarRowHtml(cal, idx)).join('');
}

function createCalendarRowHtml(cal, idx) {
  const statusClass = cal.status === 'active' ? 'status-active' : (cal.status === 'error' ? 'status-error' : 'status-idle');
  const statusLabel = cal.status === 'active' ? '● Synced' : (cal.status === 'error' ? '▲ Error' : '○ Ready');
  const lastSyncTime = cal.lastSynced ? `Last synced: ${new Date(cal.lastSynced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not yet synced';

  return `
    <div class="calendar-channel-row" data-id="${escapeAttr(cal.id || 'cal_' + idx)}">
      <div class="cal-channel-content">
        <div class="cal-channel-type-wrap">
          <select class="select cal-channel-type" style="width:100%; padding:8px 10px; font-size:0.84rem; font-weight:600;">
            <option value="airbnb" ${cal.type === 'airbnb' ? 'selected' : ''}>🔴 Airbnb</option>
            <option value="booking" ${cal.type === 'booking' ? 'selected' : ''}>🔵 Booking.com</option>
            <option value="mmt" ${cal.type === 'mmt' ? 'selected' : ''}>🟠 MakeMyTrip / Goibibo</option>
            <option value="vrbo" ${cal.type === 'vrbo' ? 'selected' : ''}>🟣 Vrbo / HomeAway</option>
            <option value="agoda" ${cal.type === 'agoda' ? 'selected' : ''}>🟡 Agoda</option>
            <option value="other" ${cal.type === 'other' ? 'selected' : ''}>📅 Custom iCal</option>
          </select>
        </div>

        <div class="cal-channel-url-wrap">
          <input class="input cal-channel-url" type="url" value="${escapeAttr(cal.url || '')}" placeholder="Paste iCal (.ics / webcal) export link..." style="width:100%; padding:8px 12px; font-size:0.84rem;">
        </div>

        <div class="cal-channel-status-wrap">
          <span class="status-pill ${statusClass}" title="${lastSyncTime}">
            ${statusLabel}
          </span>
        </div>

        <button type="button" class="btn-icon btn-del-cal" title="Remove this calendar" style="width:32px; height:32px; font-size:13px;">✕</button>
      </div>
    </div>
  `;
}

function renderBookingsList(bookings) {
  const container = document.getElementById('calendarBookingsList');
  const countBadge = document.getElementById('bookingsCountBadge');
  if (countBadge) {
    countBadge.textContent = `${bookings ? bookings.length : 0} reservation${bookings && bookings.length === 1 ? '' : 's'}`;
  }
  if (!container) return;

  if (!bookings || bookings.length === 0) {
    container.innerHTML = `<div style="font-size:0.78rem; color:var(--text-muted); font-style:italic;">No upcoming reservations found. Add calendar links above and click Sync All Now.</div>`;
    return;
  }

  container.innerHTML = bookings.slice(0, 8).map((b, idx) => {
    const sDate = new Date(b.start);
    const eDate = new Date(b.end);
    const s = sDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
    const e = eDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
    const nights = Math.max(1, Math.round((eDate - sDate) / (1000 * 60 * 60 * 24)));

    // Choose color for source badge
    let badgeColor = 'rgba(212,175,55,0.15)';
    let badgeTextColor = 'var(--accent)';
    const srcLower = (b.source || '').toLowerCase();
    if (srcLower.includes('airbnb')) {
      badgeColor = 'rgba(255, 90, 95, 0.15)';
      badgeTextColor = '#ff5a5f';
    } else if (srcLower.includes('booking')) {
      badgeColor = 'rgba(0, 108, 228, 0.15)';
      badgeTextColor = '#38bdf8';
    } else if (srcLower.includes('makemytrip') || srcLower.includes('mmt') || srcLower.includes('goibibo')) {
      badgeColor = 'rgba(249, 115, 22, 0.15)';
      badgeTextColor = '#fb923c';
    }

    return `
      <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:8px 12px; border-radius:8px; border:1px solid var(--border); font-size:0.82rem; gap:10px;">
        <div style="flex:1; min-width:0;">
          <strong>${escapeHtml(b.guestName || 'Guest')}</strong>
          <span style="color:var(--text-sub); margin-left:6px;">(${s} – ${e} · ${nights}nt)</span>
          <span style="color:${badgeTextColor}; font-size:0.72rem; background:${badgeColor}; padding:2px 7px; border-radius:9999px; margin-left:6px; font-weight:600;">${escapeHtml(b.source || 'iCal')}</span>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" onclick="applyReservationToStay(${idx})" style="padding:4px 9px; font-size:0.74rem; white-space:nowrap;" title="Load this guest and stay dates onto the TV screen">
          ✨ Use for Stay
        </button>
      </div>
    `;
  }).join('');
}

function renderTvList(tvs) {
  const container = document.getElementById('tvDeviceList');
  if (!container) return;

  const host = window.location.host;
  const protocol = window.location.protocol;

  container.innerHTML = tvs.map(tv => {
    const isOnline = tv.lastSeen && (Date.now() - new Date(tv.lastSeen).getTime()) < 2 * 60 * 1000;
    const tvUrl = `${protocol}//${host}/?tv=${encodeURIComponent(tv.id)}&room=${encodeURIComponent(tv.room || tv.name)}`;

    return `
      <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:12px 14px; border-radius:10px; border:1px solid var(--border);">
        <div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="width:8px; height:8px; border-radius:50%; background:${isOnline ? '#10b981' : '#64748b'}; box-shadow:${isOnline ? '0 0 8px #10b981' : 'none'};"></span>
            <strong>${escapeHtml(tv.name)}</strong>
          </div>
          <div style="font-size:0.75rem; color:var(--text-sub); margin-top:2px;">
            Room: ${escapeHtml(tv.room || 'General')} • ${isOnline ? 'Active on screen' : 'Last seen ' + timeAgo(tv.lastSeen)}
          </div>
        </div>
        <div style="display:flex; gap:8px;">
          <a href="${tvUrl}" target="_blank" class="btn btn-secondary btn-sm" title="Open this TV screen">Open</a>
          <button class="btn btn-secondary btn-sm" onclick="copyTvLink('${tvUrl}')" title="Copy URL for TV Browser">Copy URL</button>
        </div>
      </div>
    `;
  }).join('');
}

window.copyTvLink = function(url) {
  navigator.clipboard.writeText(url);
  showToast('Link copied for TV browser!');
};

function renderRulesRepeater(rules) {
  const container = document.getElementById('rulesRepeater');
  if (!container) return;
  container.innerHTML = rules.map((r, i) => `
    <div class="repeater-item" data-index="${i}">
      <input class="input rule-title" type="text" value="${escapeAttr(r.title)}" placeholder="Rule Title" style="flex:0.6;">
      <input class="input rule-desc" type="text" value="${escapeAttr(r.desc)}" placeholder="Description" style="flex:1;">
      <button class="btn-icon btn-del-rule" title="Remove Rule">✕</button>
    </div>
  `).join('');
}

function renderCheckoutRepeater(checkout) {
  const container = document.getElementById('checkoutRepeater');
  if (!container) return;
  container.innerHTML = checkout.map((c, i) => `
    <div class="repeater-item" data-index="${i}">
      <input class="input checkout-title" type="text" value="${escapeAttr(c.title)}" placeholder="Step Title" style="flex:0.6;">
      <input class="input checkout-desc" type="text" value="${escapeAttr(c.desc)}" placeholder="Description" style="flex:1;">
      <button class="btn-icon btn-del-checkout" title="Remove Step">✕</button>
    </div>
  `).join('');
}

function renderGuideRepeater(guide) {
  const container = document.getElementById('guideRepeater');
  if (!container) return;
  container.innerHTML = guide.map((g, i) => `
    <div class="repeater-item" data-index="${i}">
      <input class="input guide-name" type="text" value="${escapeAttr(g.name)}" placeholder="Place Name" style="flex:0.8;">
      <input class="input guide-cat" type="text" value="${escapeAttr(g.category)}" placeholder="Category" style="flex:0.6;">
      <input class="input guide-dist" type="text" value="${escapeAttr(g.distance)}" placeholder="Dist" style="flex:0.4;">
      <input class="input guide-tip" type="text" value="${escapeAttr(g.tip || '')}" placeholder="Insider tip" style="flex:1;">
      <button class="btn-icon btn-del-guide" title="Remove Place">✕</button>
    </div>
  `).join('');
}

const AMENITY_ICONS = [
  { id: 'wifi', label: '📶 High-speed Wi-Fi' },
  { id: 'tv', label: '📺 Smart TV' },
  { id: 'ac', label: '❄️ Air Conditioning' },
  { id: 'wash', label: '🧺 Washing Machine' },
  { id: 'kitchen', label: '🍴 Kitchen' },
  { id: 'pool', label: '🏊 Swimming Pool' },
  { id: 'work', label: '💻 Workspace' },
  { id: 'parking', label: '🚗 Free Parking' },
  { id: 'coffee', label: '☕ Coffee Maker' },
  { id: 'balcony', label: '🌄 Balcony / View' },
  { id: 'gym', label: '🏋️ Gym / Fitness' },
  { id: 'pets', label: '🐾 Pet Friendly' }
];

function renderAmenitiesRepeater(amenities) {
  const container = document.getElementById('amenitiesRepeater');
  if (!container) return;

  const defaultList = [
    { title: "High-speed Wi-Fi", sub: "Fast and free", icon: "wifi" },
    { title: "Smart TV", sub: "Apps & streaming", icon: "tv" },
    { title: "AC", sub: "Stay cool", icon: "ac" },
    { title: "Washing machine", sub: "Available", icon: "wash" },
    { title: "Kitchen", sub: "Cook with ease", icon: "kitchen" }
  ];

  const list = (amenities && amenities.length > 0) ? amenities : defaultList;

  container.innerHTML = list.map((a, i) => `
    <div class="repeater-item" data-index="${i}">
      <select class="select amenity-icon" style="flex:0.35;">
        ${AMENITY_ICONS.map(ico => `<option value="${ico.id}" ${ico.id === (a.icon || 'wifi') ? 'selected' : ''}>${ico.label}</option>`).join('')}
      </select>
      <input class="input amenity-title" type="text" value="${escapeAttr(a.title || '')}" placeholder="Title (e.g. Smart TV)" style="flex:0.35;">
      <input class="input amenity-sub" type="text" value="${escapeAttr(a.sub || '')}" placeholder="Subtitle (e.g. Apps & streaming)" style="flex:0.3;">
      <button class="btn-icon btn-del-amenity" title="Remove Amenity">✕</button>
    </div>
  `).join('');
}

function collectFormData() {
  const rules = [];
  document.querySelectorAll('#rulesRepeater .repeater-item').forEach(item => {
    const title = item.querySelector('.rule-title').value.trim();
    const desc = item.querySelector('.rule-desc').value.trim();
    if (title || desc) rules.push({ title, desc });
  });

  const amenities = [];
  document.querySelectorAll('#amenitiesRepeater .repeater-item').forEach(item => {
    const icon = item.querySelector('.amenity-icon')?.value || 'wifi';
    const title = item.querySelector('.amenity-title')?.value.trim() || '';
    const sub = item.querySelector('.amenity-sub')?.value.trim() || '';
    if (title) amenities.push({ icon, title, sub });
  });

  const checkout = [];
  document.querySelectorAll('#checkoutRepeater .repeater-item').forEach(item => {
    const title = item.querySelector('.checkout-title').value.trim();
    const desc = item.querySelector('.checkout-desc').value.trim();
    if (title || desc) checkout.push({ title, desc });
  });

  const recommendations = [];
  document.querySelectorAll('#guideRepeater .repeater-item').forEach(item => {
    const name = item.querySelector('.guide-name').value.trim();
    const category = item.querySelector('.guide-cat').value.trim();
    const distance = item.querySelector('.guide-dist').value.trim();
    const tip = item.querySelector('.guide-tip').value.trim();
    if (name) recommendations.push({ name, category, distance, tip });
  });

  const calendars = [];
  document.querySelectorAll('#calendarsListContainer .calendar-channel-row').forEach((row, i) => {
    const typeSelect = row.querySelector('.cal-channel-type');
    const type = typeSelect ? typeSelect.value : 'other';
    const typeName = typeSelect ? typeSelect.options[typeSelect.selectedIndex].text.replace(/^[^\s]+\s+/, '') : 'iCal';
    const url = row.querySelector('.cal-channel-url')?.value.trim() || '';
    const id = row.dataset.id || `cal_${i + 1}`;
    const prev = (state?.calendars || []).find(c => c.id === id);

    calendars.push({
      id,
      name: typeName,
      type,
      url,
      lastSynced: prev?.lastSynced || null,
      status: url ? (prev?.status || 'idle') : 'idle'
    });
  });

  return {
    property: {
      name: getValue('inputPropName') || "The Glasshouse Villa",
      location: getValue('inputPropLoc') || "Malibu, California",
      hostName: getValue('inputHostName') || "Marcus & Elena",
      hostContact: getValue('inputHostContact') || "+1 (310) 555-0192",
      logoUrl: getValue('inputLogoUrl'),
      logoPosition: getValue('selectLogoPosition') || 'header',
      logoSize: getValue('selectLogoSize') || 'medium',
      colorPalette: currentPalette,
      customAccentColor: "",
      layout: getValue('selectLayout') || 'shelf',
      photos: {
        stay: getValue('inputPhotoStay') || state?.property?.photos?.stay || "assets/backdrop-living-room.jpg",
        checkout: getValue('inputPhotoCheckout') || state?.property?.photos?.checkout || "assets/backdrop-checkout.jpg",
        idle: getValue('inputPhotoIdle') || state?.property?.photos?.idle || "assets/backdrop-idle.jpg"
      },
      wallpapers: customWallpapers
    },
    guest: {
      names: getValue('inputGuestNames'),
      checkIn: getValue('inputCheckIn'),
      checkOut: getValue('inputCheckOut'),
      stayNights: calculateStayNights(getValue('inputCheckIn'), getValue('inputCheckOut')) || state?.guest?.stayNights || '3 nights',
      checkoutTime: getValue('inputCheckoutTime') || '11:00 AM',
      welcomeNote: getValue('inputWelcomeNote'),
      overrideMode: getValue('selectOverrideMode') || 'welcome'
    },
    wifi: {
      ssid: getValue('inputWifiSsid'),
      password: getValue('inputWifiPass'),
      security: getValue('selectWifiSecurity')
    },
    rules,
    checkout,
    amenities: amenities.length > 0 ? amenities : (state?.amenities || []),
    recommendations: recommendations.length > 0 ? recommendations : (state?.recommendations || []),
    weather: {
      city: getValue('inputWeatherCity') || 'Malibu',
      latitude: state?.weather?.latitude || 34.0259,
      longitude: state?.weather?.longitude || -118.7798
    },
    calendars,
    bookings: state?.bookings || [],
    security: {
      pin: getValue('inputHostPin') || state?.security?.pin || '8899'
    },
    tvs: state?.tvs || []
  };
}

function setupEventListeners() {
  // Palette card click
  document.querySelectorAll('#paletteGrid .theme-card').forEach(card => {
    card.addEventListener('click', () => {
      currentPalette = card.dataset.palette;
      updatePaletteSelection(currentPalette);
      pushLiveUpdate(true);
    });
  });

  // Layout change
  document.getElementById('selectLayout')?.addEventListener('change', () => {
    pushLiveUpdate(true);
  });

  // Screen mode change
  document.getElementById('selectOverrideMode')?.addEventListener('change', () => {
    pushLiveUpdate(true);
  });

  // Logo position and size change
  document.getElementById('selectLogoPosition')?.addEventListener('change', () => pushLiveUpdate(true));
  document.getElementById('selectLogoSize')?.addEventListener('change', () => pushLiveUpdate(true));

  // Repeater additions
  document.getElementById('btnAddRule')?.addEventListener('click', () => {
    const container = document.getElementById('rulesRepeater');
    const div = document.createElement('div');
    div.className = 'repeater-item';
    div.innerHTML = `
      <input class="input rule-title" type="text" placeholder="Rule Title" style="flex:0.6;">
      <input class="input rule-desc" type="text" placeholder="Description" style="flex:1;">
      <button class="btn-icon btn-del-rule" title="Remove">✕</button>
    `;
    container.appendChild(div);
  });

  document.getElementById('btnAddCheckout')?.addEventListener('click', () => {
    const container = document.getElementById('checkoutRepeater');
    const div = document.createElement('div');
    div.className = 'repeater-item';
    div.innerHTML = `
      <input class="input checkout-title" type="text" placeholder="Step Title" style="flex:0.6;">
      <input class="input checkout-desc" type="text" placeholder="Description" style="flex:1;">
      <button class="btn-icon btn-del-checkout" title="Remove">✕</button>
    `;
    container.appendChild(div);
  });

  document.getElementById('btnAddGuide')?.addEventListener('click', () => {
    const container = document.getElementById('guideRepeater');
    const div = document.createElement('div');
    div.className = 'repeater-item';
    div.innerHTML = `
      <input class="input guide-name" type="text" placeholder="Place Name" style="flex:0.8;">
      <input class="input guide-cat" type="text" placeholder="Category" style="flex:0.6;">
      <input class="input guide-dist" type="text" placeholder="Dist" style="flex:0.4;">
      <input class="input guide-tip" type="text" placeholder="Insider tip" style="flex:1;">
      <button class="btn-icon btn-del-guide" title="Remove">✕</button>
    `;
    container.appendChild(div);
  });

  document.getElementById('btnAddAmenity')?.addEventListener('click', () => {
    const container = document.getElementById('amenitiesRepeater');
    const div = document.createElement('div');
    div.className = 'repeater-item';
    div.innerHTML = `
      <select class="select amenity-icon" style="flex:0.35;">
        ${AMENITY_ICONS.map(ico => `<option value="${ico.id}">${ico.label}</option>`).join('')}
      </select>
      <input class="input amenity-title" type="text" placeholder="Title (e.g. Swimming Pool)" style="flex:0.35;">
      <input class="input amenity-sub" type="text" placeholder="Subtitle (e.g. Private & heated)" style="flex:0.3;">
      <button class="btn-icon btn-del-amenity" title="Remove">✕</button>
    `;
    container.appendChild(div);
    pushLiveUpdate(true);
  });

  // Repeater item deletes (delegated)
  document.addEventListener('click', (e) => {
    if (e.target.matches('.btn-del-rule, .btn-del-checkout, .btn-del-guide, .btn-del-amenity')) {
      e.target.closest('.repeater-item')?.remove();
      pushLiveUpdate(true);
    }
  });

  // Add Calendar Channel Row
  document.getElementById('btnAddCalendarRow')?.addEventListener('click', () => {
    const container = document.getElementById('calendarsListContainer');
    if (!container) return;
    const newCal = {
      id: `cal_custom_${Date.now()}`,
      name: 'Custom iCal',
      type: 'other',
      url: '',
      status: 'idle',
      lastSynced: null
    };
    const div = document.createElement('div');
    div.innerHTML = createCalendarRowHtml(newCal, Date.now());
    container.appendChild(div.firstElementChild);
    pushLiveUpdate(true);
  });

  // Calendar Row Deletion & Changes (delegated)
  document.getElementById('calendarsListContainer')?.addEventListener('click', (e) => {
    if (e.target.closest('.btn-del-cal')) {
      const row = e.target.closest('.calendar-channel-row');
      if (row) {
        row.remove();
        pushLiveUpdate(true);
      }
    }
  });

  document.getElementById('calendarsListContainer')?.addEventListener('change', (e) => {
    if (e.target.matches('.cal-channel-type, .cal-channel-url')) {
      pushLiveUpdate(true);
    }
  });

  // Copy Master iCal link
  document.getElementById('btnCopyMasterIcal')?.addEventListener('click', () => {
    navigator.clipboard.writeText('http://localhost:3001/api/ical');
    showToast('✨ Master All-in-One iCal link copied!');
  });

  // Save / Push button
  document.getElementById('btnSavePush')?.addEventListener('click', () => {
    pushLiveUpdate(false);
  });

  // Sync All Calendars Now button
  document.getElementById('btnSyncCalendarNow')?.addEventListener('click', async () => {
    const btn = document.getElementById('btnSyncCalendarNow');
    const oldHtml = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '⏳ Syncing All OTAs...';
    }
    showToast('Syncing all OTA calendars (Airbnb, Booking.com, MMT)...');
    await pushLiveUpdate(true);
    try {
      const res = await fetch('/api/sync-calendar', { method: 'POST' });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast(`✨ Synced ${json.bookings?.length || 0} reservations across all OTAs!`);
        await initDashboard();
      } else {
        showToast('Sync failed: ' + (json.error || 'check calendar URLs'));
      }
    } catch (err) {
      showToast('Error connecting to calendar server.');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = oldHtml;
      }
    }
  });

  // Auto debounced push on typing
  let debounceTimer = null;
  document.querySelector('.form-column')?.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      pushLiveUpdate(true);
    }, 450);
  });

  // Reset demo
  document.getElementById('btnResetDefault')?.addEventListener('click', async () => {
    if (!confirm('Reset all values to luxury Airbnb demo template?')) return;
    const pinToSend = currentHostPin || getValue('inputHostPin') || state?.security?.pin || '8899';
    try {
      const res = await fetch('/api/reset', {
        method: 'POST',
        headers: { 'X-Host-PIN': pinToSend }
      });
      if (res.ok) {
        initDashboard();
        showToast('Reset to demo template!');
      } else if (res.status === 401) {
        showToast('⚠️ PIN required to reset.');
      }
    } catch (e) {
      showToast('Reset completed.');
    }
  });
}

async function pushLiveUpdate(silent = false) {
  const payload = collectFormData();
  state = payload;

  localStorage.setItem('aura_tv_state', JSON.stringify(payload));

  if (typeof BroadcastChannel !== 'undefined') {
    const bc = new BroadcastChannel('aura_tv_channel');
    bc.postMessage(payload);
  }

  const pinToSend = currentHostPin || getValue('inputHostPin') || state?.security?.pin || '8899';

  try {
    const res = await fetch('/api/data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Host-PIN': pinToSend
      },
      body: JSON.stringify(payload)
    });

    if (res.status === 401) {
      sessionStorage.removeItem('host_pin');
      currentHostPin = '';
      const overlay = document.getElementById('pinLockOverlay');
      if (overlay) overlay.classList.remove('hidden');
      const errEl = document.getElementById('pinErrorMsg');
      if (errEl) errEl.textContent = 'Unauthorized. Please enter your Host PIN to save.';
      return;
    }

    if (res.ok && !silent) {
      showToast('✨ Pushed live to connected TVs!');
    }
  } catch (err) {
    if (!silent) showToast('Saved locally.');
  }

  const iframe = document.getElementById('tvSimulatorFrame');
  if (iframe && iframe.contentWindow && iframe.contentWindow.renderScreen) {
    iframe.contentWindow.renderScreen(payload);
  }
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

function timeAgo(dateStr) {
  if (!dateStr) return 'never';
  const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  return `${diffHours}h ago`;
}

function getValue(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}

function setValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val || '';
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  if (!str) return '';
  return String(str).replace(/"/g, '&quot;');
}

// -------------------------------------------------------------
// Image Upload System & Live Previews
// -------------------------------------------------------------
let customWallpapers = [
  'assets/backdrop-landscape.jpg',
  'assets/pine-sunbeams.jpg',
  'assets/pine-forest-2.jpg',
  'assets/pine-forest-3.jpg',
  'assets/backdrop-living-room.jpg'
];

function setupImageUploader(btnId, fileInputId, textInputId, previewBoxId, thumbId, metaId) {
  const btn = document.getElementById(btnId);
  const fileInput = document.getElementById(fileInputId);
  const textInput = document.getElementById(textInputId);
  const previewBox = document.getElementById(previewBoxId);
  const thumb = document.getElementById(thumbId);
  const meta = document.getElementById(metaId);

  if (!btn || !fileInput || !textInput) return;

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    fileInput.click();
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;

    btn.textContent = '⏳ Uploading...';
    btn.disabled = true;

    try {
      const base64Data = await readFileAsDataURL(file);
      const pinToSend = currentHostPin || getValue('inputHostPin') || state?.security?.pin || '8899';
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Host-PIN': pinToSend
        },
        body: JSON.stringify({
          filename: file.name,
          data: base64Data
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Upload failed');

      textInput.value = json.url;
      updatePreview(json.url, file.name);
      btn.textContent = '✓ Done';
      showToast('Image uploaded successfully!');
      pushLiveUpdate(true);
      setTimeout(() => { btn.textContent = '📁 Upload'; btn.disabled = false; }, 2000);
    } catch (err) {
      console.error('Upload error:', err);
      btn.textContent = '❌ Error';
      showToast('Upload failed: ' + err.message);
      setTimeout(() => { btn.textContent = '📁 Upload'; btn.disabled = false; }, 2500);
    }
  });

  textInput.addEventListener('input', () => {
    updatePreview(textInput.value, textInput.value.split('/').pop());
  });

  function updatePreview(url, name) {
    if (url && previewBox && thumb && meta) {
      previewBox.style.display = 'flex';
      thumb.src = url;
      meta.textContent = name || url.split('/').pop();
    } else if (previewBox) {
      previewBox.style.display = 'none';
    }
  }

  if (textInput.value) {
    updatePreview(textInput.value, textInput.value.split('/').pop());
  }
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function renderWallpapersGrid() {
  const grid = document.getElementById('wallpapersGrid');
  if (!grid) return;
  grid.innerHTML = '';

  customWallpapers.forEach((wp, idx) => {
    const tile = document.createElement('div');
    tile.className = 'wallpaper-tile-item';
    tile.innerHTML = `
      <img src="${wp}" alt="Wallpaper ${idx+1}">
      <button type="button" class="wallpaper-remove-btn" data-index="${idx}" title="Remove this wallpaper">✕</button>
    `;
    grid.appendChild(tile);
  });

  grid.querySelectorAll('.wallpaper-remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.index, 10);
      if (customWallpapers.length <= 1) {
        showToast('Keep at least one wallpaper for rotation.');
        return;
      }
      customWallpapers.splice(idx, 1);
      renderWallpapersGrid();
      pushLiveUpdate(true);
    });
  });
}

function setupWallpaperUpload() {
  const btn = document.getElementById('btnUploadWallpaper');
  const fileInput = document.getElementById('fileWallpaper');
  if (!btn || !fileInput) return;

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    fileInput.click();
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;

    btn.textContent = '⏳ Uploading...';
    btn.disabled = true;

    try {
      const base64Data = await readFileAsDataURL(file);
      const pinToSend = currentHostPin || getValue('inputHostPin') || state?.security?.pin || '8899';
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Host-PIN': pinToSend
        },
        body: JSON.stringify({
          filename: file.name,
          data: base64Data
        })
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Upload failed');

      customWallpapers.push(json.url);
      renderWallpapersGrid();
      btn.textContent = '+ Upload Wallpaper';
      btn.disabled = false;
      showToast('Wallpaper added to TV rotation!');
      pushLiveUpdate(true);
    } catch (err) {
      btn.textContent = '+ Upload Wallpaper';
      btn.disabled = false;
      showToast('Upload failed: ' + err.message);
    }
  });
}

// =============================================================
// Stay Dates Interactive Calendar Component
// =============================================================
let calViewDate = new Date();
let calCheckIn = null;
let calCheckOut = null;
let calPickingStep = 'checkin';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseDateString(str) {
  if (!str) return null;
  const direct = new Date(str);
  if (!isNaN(direct.getTime()) && direct.getFullYear() > 2000) {
    return new Date(direct.getFullYear(), direct.getMonth(), direct.getDate());
  }

  // Handle patterns like "Sat 7 Nov", "Tue 10 Nov", "Nov 10", "7 Nov 2026"
  const tokens = str.trim().split(/\s+/);
  const months = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
  };
  let d = null;
  let m = null;
  let y = new Date().getFullYear();

  for (const t of tokens) {
    const clean = t.toLowerCase().replace(/[^a-z0-9]/g, '');
    const prefix = clean.slice(0, 3);
    if (months[prefix] !== undefined) {
      m = months[prefix];
    } else if (/^\d{1,2}$/.test(clean)) {
      d = parseInt(clean, 10);
    } else if (/^\d{4}$/.test(clean)) {
      y = parseInt(clean, 10);
    }
  }

  if (d !== null && m !== null) {
    return new Date(y, m, d);
  }
  return null;
}

function formatFriendlyDate(dateObj) {
  if (!dateObj) return '';
  const dayName = DAY_NAMES[dateObj.getDay()];
  const dayNum = dateObj.getDate();
  const monthName = MONTH_NAMES[dateObj.getMonth()].slice(0, 3);
  return `${dayName} ${dayNum} ${monthName}`;
}

function calculateStayNights(inStr, outStr) {
  const dIn = parseDateString(inStr);
  const dOut = parseDateString(outStr);
  if (dIn && dOut && dOut > dIn) {
    const diff = Math.round((dOut.getTime() - dIn.getTime()) / (1000 * 60 * 60 * 24));
    return `${diff} night${diff > 1 ? 's' : ''}`;
  }
  return '';
}

function isSameDay(d1, d2) {
  if (!d1 || !d2) return false;
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

function isDateInRange(target, start, end) {
  if (!target || !start || !end) return false;
  const t = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  return t > s && t < e;
}

function isDateBookedByIcal(d) {
  if (!state || !state.bookings || !Array.isArray(state.bookings)) return false;
  const targetTime = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return state.bookings.some(b => {
    if (!b.start || !b.end) return false;
    const s = new Date(b.start);
    const e = new Date(b.end);
    const sTime = new Date(s.getFullYear(), s.getMonth(), s.getDate()).getTime();
    const eTime = new Date(e.getFullYear(), e.getMonth(), e.getDate()).getTime();
    return targetTime >= sTime && targetTime < eTime;
  });
}

function initStayCalendar() {
  const btnToggle = document.getElementById('btnToggleCalendar');
  const widget = document.getElementById('stayCalendarWidget');
  const btnPrev = document.getElementById('calPrevMonth');
  const btnNext = document.getElementById('calNextMonth');
  const btnToday = document.getElementById('calGoToday');
  const inputCheckIn = document.getElementById('inputCheckIn');
  const inputCheckOut = document.getElementById('inputCheckOut');

  if (btnToggle && widget) {
    btnToggle.addEventListener('click', () => {
      widget.classList.toggle('collapsed');
      const isCollapsed = widget.classList.contains('collapsed');
      const label = document.getElementById('calToggleLabel');
      if (label) label.textContent = isCollapsed ? 'Show Calendar' : 'Interactive Calendar';
    });
  }

  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      calViewDate.setMonth(calViewDate.getMonth() - 1);
      renderCalendarDays();
    });
  }

  if (btnNext) {
    btnNext.addEventListener('click', () => {
      calViewDate.setMonth(calViewDate.getMonth() + 1);
      renderCalendarDays();
    });
  }

  if (btnToday) {
    btnToday.addEventListener('click', () => {
      calViewDate = new Date();
      renderCalendarDays();
    });
  }

  // When clicking into text fields, set picking mode
  if (inputCheckIn) {
    inputCheckIn.addEventListener('focus', () => {
      calPickingStep = 'checkin';
      if (widget && widget.classList.contains('collapsed')) {
        widget.classList.remove('collapsed');
      }
    });
    inputCheckIn.addEventListener('input', () => {
      const d = parseDateString(inputCheckIn.value);
      if (d) {
        calCheckIn = d;
        calViewDate = new Date(d);
        renderCalendarDays();
        updateNightsBadge();
      }
    });
  }

  if (inputCheckOut) {
    inputCheckOut.addEventListener('focus', () => {
      calPickingStep = 'checkout';
      if (widget && widget.classList.contains('collapsed')) {
        widget.classList.remove('collapsed');
      }
    });
    inputCheckOut.addEventListener('input', () => {
      const d = parseDateString(inputCheckOut.value);
      if (d) {
        calCheckOut = d;
        renderCalendarDays();
        updateNightsBadge();
      }
    });
  }

  // Quick Preset Buttons
  document.querySelectorAll('.stay-cal-preset-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      applyCalendarPreset(preset);
    });
  });
}

function syncStayCalendarFromInputs() {
  const inVal = getValue('inputCheckIn');
  const outVal = getValue('inputCheckOut');

  calCheckIn = parseDateString(inVal);
  calCheckOut = parseDateString(outVal);

  if (calCheckIn) {
    calViewDate = new Date(calCheckIn.getFullYear(), calCheckIn.getMonth(), 1);
  } else {
    calViewDate = new Date();
  }

  calPickingStep = 'checkin';
  renderCalendarDays();
  updateNightsBadge();
}

function updateNightsBadge() {
  const badge = document.getElementById('calNightsBadge');
  if (!badge) return;

  if (calCheckIn && calCheckOut && calCheckOut > calCheckIn) {
    const nights = Math.round((calCheckOut.getTime() - calCheckIn.getTime()) / (1000 * 60 * 60 * 24));
    badge.textContent = `${nights} night${nights > 1 ? 's' : ''} selected`;
    badge.style.display = 'inline-block';
  } else if (calCheckIn) {
    badge.textContent = `Select check-out date`;
    badge.style.display = 'inline-block';
  } else {
    badge.textContent = `Pick stay dates`;
    badge.style.display = 'inline-block';
  }
}

function renderCalendarDays() {
  const grid = document.getElementById('calDaysGrid');
  const title = document.getElementById('calCurrentMonthTitle');
  if (!grid || !title) return;

  const year = calViewDate.getFullYear();
  const month = calViewDate.getMonth();

  title.textContent = `${MONTH_NAMES[month]} ${year}`;

  grid.innerHTML = '';

  const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  // 1. Prior Month Trailing Days
  for (let i = firstDay - 1; i >= 0; i--) {
    const dayNum = prevMonthDays - i;
    const dateObj = new Date(year, month - 1, dayNum);
    grid.appendChild(createDayCell(dateObj, true));
  }

  // 2. Current Month Days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    grid.appendChild(createDayCell(dateObj, false));
  }

  // 3. Next Month Leading Days (pad to 35 or 42 cells)
  const totalCells = firstDay + daysInMonth;
  const remaining = (totalCells <= 35 ? 35 : 42) - totalCells;
  for (let n = 1; n <= remaining; n++) {
    const dateObj = new Date(year, month + 1, n);
    grid.appendChild(createDayCell(dateObj, true));
  }
}

function createDayCell(dateObj, isOtherMonth) {
  const cell = document.createElement('div');
  cell.className = 'stay-cal-day';
  if (isOtherMonth) cell.classList.add('other-month');

  const today = new Date();
  if (isSameDay(dateObj, today)) {
    cell.classList.add('is-today');
    cell.title = 'Today';
  }

  const isBooked = isDateBookedByIcal(dateObj);
  if (isBooked) {
    cell.classList.add('is-booked');
    cell.title = (cell.title ? cell.title + ' • ' : '') + 'Reserved (iCal)';
  }

  // Check-in / Check-out / Range styling
  const isCin = isSameDay(dateObj, calCheckIn);
  const isCout = isSameDay(dateObj, calCheckOut);

  if (isCin && isCout) {
    cell.classList.add('is-same-day');
  } else if (isCin) {
    cell.classList.add('is-checkin');
  } else if (isCout) {
    cell.classList.add('is-checkout');
  } else if (calCheckIn && calCheckOut && isDateInRange(dateObj, calCheckIn, calCheckOut)) {
    cell.classList.add('is-in-range');
  }

  cell.textContent = dateObj.getDate();

  // Interaction
  cell.addEventListener('click', () => {
    handleDayClick(dateObj);
  });

  return cell;
}

function handleDayClick(clickedDate) {
  if (calPickingStep === 'checkin' || !calCheckIn || (calCheckIn && calCheckOut)) {
    // Setting Check-In
    calCheckIn = clickedDate;
    calCheckOut = null;
    calPickingStep = 'checkout';

    setValue('inputCheckIn', formatFriendlyDate(calCheckIn));
    setValue('inputCheckOut', '');

    renderCalendarDays();
    updateNightsBadge();
  } else if (calPickingStep === 'checkout') {
    // Setting Check-Out
    if (clickedDate.getTime() <= calCheckIn.getTime()) {
      // Clicked date is on or before check-in -> treat as new Check-In
      calCheckIn = clickedDate;
      calCheckOut = null;
      calPickingStep = 'checkout';

      setValue('inputCheckIn', formatFriendlyDate(calCheckIn));
      setValue('inputCheckOut', '');
    } else {
      // Valid Check-Out date
      calCheckOut = clickedDate;
      calPickingStep = 'checkin';

      setValue('inputCheckIn', formatFriendlyDate(calCheckIn));
      setValue('inputCheckOut', formatFriendlyDate(calCheckOut));

      // Auto-update checkout time date portion while keeping user's preferred time
      const curCheckoutTime = getValue('inputCheckoutTime');
      const timeMatch = curCheckoutTime.match(/\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?/);
      const timeStr = timeMatch ? timeMatch[0] : '11:00 AM';
      setValue('inputCheckoutTime', `${formatFriendlyDate(calCheckOut)}, ${timeStr}`);

      showToast(`Dates set: ${formatFriendlyDate(calCheckIn)} → ${formatFriendlyDate(calCheckOut)}`);
      pushLiveUpdate(true);
    }

    renderCalendarDays();
    updateNightsBadge();
  }
}

function applyCalendarPreset(preset) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (preset === 'tonight') {
    calCheckIn = today;
    calCheckOut = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  } else if (preset === 'weekend') {
    const day = today.getDay(); // 0 is Sun, 5 is Fri
    const daysUntilFri = (5 - day + 7) % 7;
    const friday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + (daysUntilFri === 0 ? 7 : daysUntilFri));
    const sunday = new Date(friday.getFullYear(), friday.getMonth(), friday.getDate() + 2);
    calCheckIn = friday;
    calCheckOut = sunday;
  } else if (preset === 'next3') {
    calCheckIn = today;
    calCheckOut = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3);
  } else if (preset === 'nextWeek') {
    const day = today.getDay();
    const daysUntilMon = (1 - day + 7) % 7 || 7;
    const mon = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysUntilMon);
    const sat = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 5);
    calCheckIn = mon;
    calCheckOut = sat;
  }

  if (calCheckIn && calCheckOut) {
    calViewDate = new Date(calCheckIn.getFullYear(), calCheckIn.getMonth(), 1);
    calPickingStep = 'checkin';

    setValue('inputCheckIn', formatFriendlyDate(calCheckIn));
    setValue('inputCheckOut', formatFriendlyDate(calCheckOut));

    const curCheckoutTime = getValue('inputCheckoutTime');
    const timeMatch = curCheckoutTime.match(/\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?/);
    const timeStr = timeMatch ? timeMatch[0] : '11:00 AM';
    setValue('inputCheckoutTime', `${formatFriendlyDate(calCheckOut)}, ${timeStr}`);

    renderCalendarDays();
    updateNightsBadge();
    showToast(`Preset applied: ${formatFriendlyDate(calCheckIn)} → ${formatFriendlyDate(calCheckOut)}`);
    pushLiveUpdate(true);
  }
}

window.applyReservationToStay = function(idx) {
  if (!state || !state.bookings || !state.bookings[idx]) return;
  const b = state.bookings[idx];
  const sDate = new Date(b.start);
  const eDate = new Date(b.end);

  if (b.guestName && b.guestName !== 'Airbnb Guest' && b.guestName !== 'Guest') {
    setValue('inputGuestNames', b.guestName);
  }

  calCheckIn = new Date(sDate.getFullYear(), sDate.getMonth(), sDate.getDate());
  calCheckOut = new Date(eDate.getFullYear(), eDate.getMonth(), eDate.getDate());
  calViewDate = new Date(calCheckIn.getFullYear(), calCheckIn.getMonth(), 1);
  calPickingStep = 'checkin';

  setValue('inputCheckIn', formatFriendlyDate(calCheckIn));
  setValue('inputCheckOut', formatFriendlyDate(calCheckOut));

  const curCheckoutTime = getValue('inputCheckoutTime');
  const timeMatch = curCheckoutTime.match(/\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?/);
  const timeStr = timeMatch ? timeMatch[0] : '11:00 AM';
  setValue('inputCheckoutTime', `${formatFriendlyDate(calCheckOut)}, ${timeStr}`);

  renderCalendarDays();
  updateNightsBadge();
  showToast(`Loaded reservation onto TV: ${formatFriendlyDate(calCheckIn)} → ${formatFriendlyDate(calCheckOut)}`);
  pushLiveUpdate(false);
};

// -------------------------------------------------------------
// Security & Host PIN Handlers
// -------------------------------------------------------------
function setupSecurityListeners() {
  const overlay = document.getElementById('pinLockOverlay');
  const errorMsg = document.getElementById('pinErrorMsg');
  const unlockInput = document.getElementById('unlockPinInput');
  const unlockForm = document.getElementById('pinUnlockForm');
  const btnLock = document.getElementById('btnLockStudio');
  const btnSavePin = document.getElementById('btnSavePin');
  const btnTogglePin = document.getElementById('btnTogglePinVisibility');
  const btnCopyDirect = document.getElementById('btnCopyDirectHostUrl');

  if (unlockForm) {
    unlockForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = unlockInput?.value || '';
      unlockStudioWithPin(val);
    });
  }

  if (btnLock) {
    btnLock.addEventListener('click', () => {
      sessionStorage.removeItem('host_pin');
      currentHostPin = '';
      if (unlockInput) unlockInput.value = '';
      if (errorMsg) errorMsg.textContent = '';
      if (overlay) overlay.classList.remove('hidden');
      setTimeout(() => unlockInput?.focus(), 150);
      showToast('🔒 Host Studio locked.');
    });
  }

  if (btnTogglePin) {
    btnTogglePin.addEventListener('click', () => {
      const input = document.getElementById('inputHostPin');
      if (!input) return;
      if (input.type === 'password') {
        input.type = 'text';
        btnTogglePin.textContent = 'Hide';
      } else {
        input.type = 'password';
        btnTogglePin.textContent = 'Show';
      }
    });
  }

  if (btnSavePin) {
    btnSavePin.addEventListener('click', async () => {
      const pinInput = document.getElementById('inputHostPin');
      const newPin = (pinInput?.value || '').trim();
      if (!newPin || newPin.length < 4) {
        showToast('PIN must be at least 4 digits');
        return;
      }
      currentHostPin = newPin;
      sessionStorage.setItem('host_pin', newPin);
      updateDirectHostLink(newPin);
      await pushLiveUpdate(false);
      showToast(`🔐 PIN updated successfully to: ${newPin}`);
    });
  }

  if (btnCopyDirect) {
    btnCopyDirect.addEventListener('click', () => {
      const directInput = document.getElementById('inputDirectHostUrl');
      if (directInput && directInput.value) {
        navigator.clipboard.writeText(directInput.value);
        showToast('Secret Direct Link copied to clipboard!');
      }
    });
  }
}

async function unlockStudioWithPin(enteredPin) {
  const overlay = document.getElementById('pinLockOverlay');
  const errorMsg = document.getElementById('pinErrorMsg');
  const unlockBtn = document.getElementById('btnUnlockStudio');
  const unlockInput = document.getElementById('unlockPinInput');

  if (!enteredPin || enteredPin.trim().length === 0) {
    if (errorMsg) errorMsg.textContent = 'Please enter your 4-digit PIN.';
    return;
  }

  if (unlockBtn) {
    unlockBtn.disabled = true;
    unlockBtn.textContent = 'Verifying...';
  }

  try {
    const res = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: enteredPin.trim() })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      currentHostPin = enteredPin.trim();
      sessionStorage.setItem('host_pin', currentHostPin);
      if (overlay) overlay.classList.add('hidden');
      if (errorMsg) errorMsg.textContent = '';
      setValue('inputHostPin', currentHostPin);
      updateDirectHostLink(currentHostPin);
      showToast('✨ Studio unlocked!');
    } else {
      if (errorMsg) errorMsg.textContent = 'Incorrect PIN. Try default: 8899';
      if (unlockInput) {
        unlockInput.value = '';
        unlockInput.focus();
      }
    }
  } catch (err) {
    if (errorMsg) errorMsg.textContent = 'Error connecting to server.';
  } finally {
    if (unlockBtn) {
      unlockBtn.disabled = false;
      unlockBtn.textContent = 'Unlock Studio';
    }
  }
}

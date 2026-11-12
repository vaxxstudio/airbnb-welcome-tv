/**
 * The Zenest — Mobile Host Studio Pro
 * Zero-Lag Touch Engine, 1-Tap TV Push, and Real-Time Wi-Fi QR Generator
 */

let state = null;
let qrInstance = null;
let currentMode = 'welcome';
let currentPalette = 'landscape_mountain';

document.addEventListener('DOMContentLoaded', () => {
  initMobileApp();
  setupTabNavigation();
  setupModeSwitcher();
  setupQuickChips();
  setupPushAction();
  setupLiveSync();
});

async function initMobileApp() {
  try {
    const res = await fetch('/api/data');
    if (!res.ok) throw new Error('Failed to fetch data');
    state = await res.json();
  } catch (err) {
    const local = localStorage.getItem('aura_tv_state');
    state = local ? JSON.parse(local) : null;
  }

  if (state) {
    populateMobileForm(state);
  }
}

function populateMobileForm(data) {
  if (!data) return;

  const prop = data.property || {};
  const guest = data.guest || {};
  const wifi = data.wifi || {};

  // Header Title
  const propTitle = prop.name || 'The Zenest';
  const headerEl = document.getElementById('mobPropHeaderTitle');
  if (headerEl) headerEl.textContent = propTitle;

  // 1. Guest Information
  setValue('mobGuestName', guest.names || '');
  setValue('mobCheckIn', guest.checkIn || '');
  setValue('mobCheckOut', guest.checkOut || '');
  setValue('mobCheckoutTime', guest.checkoutTime || '11:00 AM');
  setValue('mobWelcomeNote', guest.welcomeNote || '');
  setValue('mobHostSignoff', guest.hostSignoff || '– Gautham');

  // Screen Mode
  currentMode = guest.overrideMode || 'welcome';
  updateSegmentedUI(currentMode);

  // 2. Wi-Fi
  setValue('mobWifiSsid', wifi.ssid || 'Vellara');
  setValue('mobWifiPass', wifi.password || 'vhome@123');
  renderMobileQr(wifi.ssid || 'Vellara', wifi.password || 'vhome@123');

  // 3. Villa Details
  setValue('mobPropName', prop.name || 'The Zenest');
  setValue('mobPropLoc', prop.location || 'Thekkady');
  setValue('mobHostName', prop.hostName || 'Gautham');
  setValue('mobHostContact', prop.hostContact || 'Message Gautham on the Airbnb app');

  // Rules list
  renderRulesList(data.rules || []);

  // 4. Color Palette
  currentPalette = prop.colorPalette || 'landscape_mountain';
  updatePaletteUI(currentPalette);
}

function setValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function getValue(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

// -------------------------------------------------------------
// Live Wi-Fi QR Code Generator
// -------------------------------------------------------------
function renderMobileQr(ssid, pass) {
  const target = document.getElementById('mobQrTarget');
  if (!target || typeof QRCode === 'undefined') return;

  target.innerHTML = '';
  const qrText = `WIFI:T:WPA;S:${ssid};P:${pass};;`;

  qrInstance = new QRCode(target, {
    text: qrText,
    width: 76,
    height: 76,
    colorDark: "#10141d",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.M
  });

  const previewSsid = document.getElementById('mobPreviewSsid');
  const previewPass = document.getElementById('mobPreviewPass');
  if (previewSsid) previewSsid.textContent = ssid || 'Wi-Fi Network';
  if (previewPass) previewPass.textContent = `Pass: ${pass || 'None'}`;
}

// Wire Wi-Fi input changes
document.getElementById('mobWifiSsid')?.addEventListener('input', () => {
  renderMobileQr(getValue('mobWifiSsid'), getValue('mobWifiPass'));
});
document.getElementById('mobWifiPass')?.addEventListener('input', () => {
  renderMobileQr(getValue('mobWifiSsid'), getValue('mobWifiPass'));
});

// -------------------------------------------------------------
// Tab Navigation (Guest, Wi-Fi, Villa, Style)
// -------------------------------------------------------------
function setupTabNavigation() {
  const tabBtns = document.querySelectorAll('.mob-tab-btn');
  const pages = document.querySelectorAll('.mob-tab-page');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.tab;

      tabBtns.forEach(b => b.classList.remove('active'));
      pages.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPage = document.getElementById(targetId);
      if (targetPage) targetPage.classList.add('active');

      // Light haptic feedback
      if (navigator.vibrate) navigator.vibrate(10);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

// -------------------------------------------------------------
// Mode Segmented Switcher (Welcome / Checkout / Standby)
// -------------------------------------------------------------
function setupModeSwitcher() {
  const segmentBtns = document.querySelectorAll('.mob-segment-btn');

  segmentBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      currentMode = btn.dataset.mode;
      updateSegmentedUI(currentMode);
      if (navigator.vibrate) navigator.vibrate(15);
    });
  });
}

function updateSegmentedUI(mode) {
  document.querySelectorAll('.mob-segment-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
}

// -------------------------------------------------------------
// Quick Suggestion Chips (Dates & Messages)
// -------------------------------------------------------------
function setupQuickChips() {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function fmtDate(d) {
    return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  }

  // 1. Tonight chip
  document.getElementById('chipTonight')?.addEventListener('click', () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    setValue('mobCheckIn', fmtDate(today));
    setValue('mobCheckOut', fmtDate(tomorrow));
    showToast('Applied: Tonight (1 night)');
  });

  // 2. Weekend chip
  document.getElementById('chipWeekend')?.addEventListener('click', () => {
    const d = new Date();
    const day = d.getDay();
    const diffToFri = (5 - day + 7) % 7;
    const fri = new Date(d);
    fri.setDate(d.getDate() + (diffToFri === 0 ? 7 : diffToFri));
    const sun = new Date(fri);
    sun.setDate(fri.getDate() + 2);

    setValue('mobCheckIn', fmtDate(fri));
    setValue('mobCheckOut', fmtDate(sun));
    showToast('Applied: This Weekend (Fri - Sun)');
  });

  // 3. Next 3 nights chip
  document.getElementById('chipNextWeek')?.addEventListener('click', () => {
    const start = new Date();
    start.setDate(start.getDate() + 1);
    const end = new Date(start);
    end.setDate(start.getDate() + 3);

    setValue('mobCheckIn', fmtDate(start));
    setValue('mobCheckOut', fmtDate(end));
    showToast('Applied: Next 3 Nights');
  });

  // Welcome note chips
  document.querySelectorAll('.mob-chip-pill[data-msg]').forEach(chip => {
    chip.addEventListener('click', () => {
      const msg = chip.dataset.msg;
      const noteInput = document.getElementById('mobWelcomeNote');
      if (noteInput) {
        noteInput.value = msg;
        noteInput.focus();
        showToast('Message inserted!');
      }
    });
  });

  // Host name sync to signoff
  document.getElementById('mobHostName')?.addEventListener('input', (e) => {
    const name = e.target.value.trim();
    const signoff = document.getElementById('mobHostSignoff');
    if (signoff && (!signoff.value || signoff.value.startsWith('– '))) {
      signoff.value = name ? `– ${name}` : '';
    }
  });

  // Color Palette Cards
  document.querySelectorAll('#mobPalettesGrid .mob-palette-card').forEach(card => {
    card.addEventListener('click', () => {
      currentPalette = card.dataset.palette;
      updatePaletteUI(currentPalette);
      if (navigator.vibrate) navigator.vibrate(12);
    });
  });
}

function updatePaletteUI(palette) {
  document.querySelectorAll('#mobPalettesGrid .mob-palette-card').forEach(card => {
    card.classList.toggle('active', card.dataset.palette === palette);
  });
}

// -------------------------------------------------------------
// House Rules List Renderer
// -------------------------------------------------------------
function renderRulesList(rules) {
  const container = document.getElementById('mobRulesList');
  if (!container) return;

  if (!rules || rules.length === 0) {
    rules = [
      { title: "No smoking" },
      { title: "No parties" },
      { title: "No pets" },
      { title: "Max 3 guests" },
      { title: "Quiet hours 22:00–07:00" }
    ];
  }

  container.innerHTML = rules.map((r, i) => `
    <div class="mob-rule-item">
      <div class="mob-rule-info">
        <span style="color:#ef4444;">•</span>
        <span>${escapeHtml(r.title)}</span>
      </div>
      <button type="button" class="mob-rule-delete" data-idx="${i}" title="Remove rule">✕</button>
    </div>
  `).join('');

  container.querySelectorAll('.mob-rule-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(btn.dataset.idx, 10);
      rules.splice(idx, 1);
      state.rules = rules;
      renderRulesList(rules);
    });
  });
}

// -------------------------------------------------------------
// Main Push to TV Action (Instant 1-Touch Save)
// -------------------------------------------------------------
function setupPushAction() {
  const pushBtn = document.getElementById('btnMobPushMain');
  if (!pushBtn) return;

  pushBtn.addEventListener('click', async () => {
    if (!state) state = {};

    // Build fresh state object
    const updated = {
      ...state,
      guest: {
        ...(state.guest || {}),
        names: getValue('mobGuestName'),
        checkIn: getValue('mobCheckIn'),
        checkOut: getValue('mobCheckOut'),
        checkoutTime: getValue('mobCheckoutTime'),
        welcomeNote: getValue('mobWelcomeNote'),
        hostSignoff: getValue('mobHostSignoff'),
        overrideMode: currentMode
      },
      wifi: {
        ...(state.wifi || {}),
        ssid: getValue('mobWifiSsid'),
        password: getValue('mobWifiPass'),
        security: "WPA"
      },
      property: {
        ...(state.property || {}),
        name: getValue('mobPropName'),
        location: getValue('mobPropLoc'),
        hostName: getValue('mobHostName'),
        hostContact: getValue('mobHostContact'),
        colorPalette: currentPalette
      }
    };

    state = updated;
    localStorage.setItem('aura_tv_state', JSON.stringify(updated));

    // Button animation
    const originalText = pushBtn.innerHTML;
    pushBtn.innerHTML = `<span>⏳ Updating TV...</span>`;
    pushBtn.style.opacity = '0.75';

    try {
      const res = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });

      if (res.ok) {
        showToast('✓ Updated Living Room TV Live!');
        if (navigator.vibrate) navigator.vibrate([25, 40, 25]);
      } else {
        showToast('Saved locally (Offline)');
      }
    } catch (e) {
      showToast('Saved locally (Offline)');
    } finally {
      pushBtn.innerHTML = originalText;
      pushBtn.style.opacity = '1';
    }
  });
}

// -------------------------------------------------------------
// Toast Confirmation Notification
// -------------------------------------------------------------
let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('mobToast');
  const textEl = document.getElementById('mobToastText');
  if (!toast || !textEl) return;

  textEl.textContent = msg;
  toast.classList.add('show');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2600);
}

// -------------------------------------------------------------
// Live Real-Time Background SSE Sync
// -------------------------------------------------------------
function setupLiveSync() {
  if (typeof EventSource === 'undefined') return;

  try {
    const sse = new EventSource('/api/events');
    sse.onmessage = (event) => {
      try {
        const remoteData = JSON.parse(event.data);
        if (remoteData) {
          state = remoteData;
          // Silently sync values if inputs are not currently focused
          if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
            populateMobileForm(remoteData);
          }
        }
      } catch (e) {}
    };
  } catch (err) {}
}

function escapeHtml(str) {
  return (str || '').replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[m]);
}

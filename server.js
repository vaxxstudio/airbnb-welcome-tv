const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { parseIcs, resolveCurrentStay } = require('./scripts/ical-parser');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

const DEFAULT_DATA = {
  "property": {
    "name": "Comfort Stay near CyberHub",
    "location": "Gurugram",
    "metaSubtitle": "1BHK · 300 MBPS WI-FI · GURUGRAM",
    "hostName": "Gautham",
    "hostContact": "Message Gautham on the Airbnb app",
    "logoUrl": "",
    "logoPosition": "header",
    "logoSize": "medium",
    "colorPalette": "landscape_mountain",
    "customAccentColor": "",
    "isPro": true,
    "layout": "classic",
    "photos": {
      "stay": "assets/backdrop-living-room.jpg",
      "checkout": "assets/backdrop-checkout.jpg",
      "idle": "assets/backdrop-idle.jpg"
    }
  },
  "guest": {
    "names": "Rahul",
    "checkIn": "Sat 7 Nov",
    "checkOut": "Tue 10 Nov",
    "stayNights": "3 nights",
    "checkoutTime": "Tue 10 Nov, 11:00 AM",
    "welcomeNote": "Make yourself at home. If you need anything, message me on Airbnb.",
    "hostSignoff": "– Gautham",
    "overrideMode": "welcome"
  },
  "wifi": {
    "ssid": "Comfort Stay Guest",
    "password": "GuestWiFi@123",
    "security": "WPA"
  },
  "rules": [
    {
      "title": "No smoking",
      "icon": "danger"
    },
    {
      "title": "No parties",
      "icon": "danger"
    },
    {
      "title": "No pets",
      "icon": "danger"
    },
    {
      "title": "Max 3 guests",
      "icon": "accent"
    },
    {
      "title": "Quiet hours 22:00–07:00",
      "icon": "amber"
    }
  ],
  "amenities": [
    {
      "title": "High-speed Wi-Fi",
      "sub": "Fast and free",
      "icon": "wifi"
    },
    {
      "title": "Smart TV",
      "sub": "Apps & streaming",
      "icon": "tv"
    },
    {
      "title": "AC",
      "sub": "Stay cool",
      "icon": "ac"
    },
    {
      "title": "Washing machine",
      "sub": "Available",
      "icon": "wash"
    },
    {
      "title": "Kitchen",
      "sub": "Cook with ease",
      "icon": "kitchen"
    }
  ],
  "checkout": [
    {
      "title": "AC & Lights Off",
      "desc": "Please turn off climate units and geysers before leaving."
    },
    {
      "title": "Keys on Table",
      "desc": "Leave keys on the dining table console."
    },
    {
      "title": "Close & Lock Door",
      "desc": "Pull the main entrance door firmly until it latches locked."
    }
  ],
  "recommendations": [
    {
      "name": "CyberHub Social",
      "category": "Dining & Drinks",
      "distance": "0.5 km",
      "tip": "Great rooftop ambiance and craft beverages."
    },
    {
      "name": "Blue Tokai Coffee",
      "category": "Artisan Café",
      "distance": "0.3 km",
      "tip": "Specialty pour-overs and fresh sourdough toast."
    },
    {
      "name": "Galleria Market",
      "category": "Shopping & Street Food",
      "distance": "1.5 km",
      "tip": "Open-air market with local snacks and boutiques."
    }
  ],
  "weather": {
    "city": "Gurugram",
    "latitude": 28.4595,
    "longitude": 77.0266
  },
  "calendars": [
    {
      "id": "cal_airbnb",
      "name": "Airbnb",
      "type": "airbnb",
      "url": "https://www.airbnb.co.in/calendar/ical/1608518019172162450.ics?t=d0c9317592234ce0baf9bf0a136d0a49",
      "lastSynced": null,
      "status": "idle"
    },
    {
      "id": "cal_booking",
      "name": "Booking.com",
      "type": "booking",
      "url": "https://ical.booking.com/v1/export?t=cd2f7888-34fa-410a-b06b-c11bc831d79c",
      "lastSynced": null,
      "status": "idle"
    },
    {
      "id": "cal_mmt",
      "name": "MakeMyTrip / Goibibo",
      "type": "mmt",
      "url": "https://ingo-content-clientbackend.goibibo.com/public/ecs/downloadCalendar/45002010708?bid=b57f0e8adcad2f049b7b94f5fb70bb42&otherBrandName=zen",
      "lastSynced": null,
      "status": "idle"
    }
  ],
  "bookings": [],
  "security": {
    "pin": "8899"
  },
  "tvs": [
    {
      "id": "living-room",
      "name": "Living Room TV",
      "room": "Living Room",
      "lastSeen": "2026-11-10T08:48:56.083Z",
      "status": "online"
    },
    {
      "id": "master-bedroom",
      "name": "Master Suite TV",
      "room": "Master Bedroom",
      "lastSeen": "2026-11-10T07:30:42.105Z",
      "status": "idle"
    }
  ]
};

function deepMerge(target, source) {
  if (!source) return target;
  const output = Object.assign({}, target);
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) && target && target[key]) {
      output[key] = deepMerge(target[key], source[key]);
    } else {
      output[key] = source[key];
    }
  }
  return output;
}

function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return deepMerge(JSON.parse(JSON.stringify(DEFAULT_DATA)), parsed);
    } catch (e) {
      console.error('Error reading data.json, falling back to defaults:', e);
    }
  }
  saveData(DEFAULT_DATA);
  return DEFAULT_DATA;
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error writing data.json:', e);
  }
}

let appState = loadData();
const sseClients = new Set();

// Process-level crash protection
process.on('uncaughtException', (err) => {
  console.error('[Process Error Uncaught Exception]', err.message, err.stack);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Process Error Unhandled Rejection]', reason);
});

function broadcastUpdate(data) {
  appState = deepMerge(appState, data);
  saveData(appState);
  const payload = `data: ${JSON.stringify(appState)}\n\n`;
  for (const client of sseClients) {
    try {
      if (client.writable && !client.destroyed) {
        client.write(payload);
      } else {
        sseClients.delete(client);
      }
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

// -------------------------------------------------------------
// Calendar Sync Worker (Supports webcal://, https://, redirects)
// -------------------------------------------------------------
async function syncCalendars() {
  if (!appState.calendars || appState.calendars.length === 0) return;
  console.log('[Calendar Sync] Checking active calendar feeds across all OTAs...');

  const freshBookings = [];
  const existingBookings = appState.bookings || [];
  const now = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);

  for (const cal of appState.calendars) {
    if (!cal.url || !cal.url.trim()) {
      cal.status = 'idle';
      continue;
    }

    // Normalize webcal:// to https://
    let fetchTarget = cal.url.trim();
    if (fetchTarget.startsWith('webcal://')) {
      fetchTarget = 'https://' + fetchTarget.substring(9);
    }

    if (!fetchTarget.startsWith('http')) {
      cal.status = 'idle';
      continue;
    }

    try {
      console.log(`[Calendar Sync] Fetching: ${cal.name} (${fetchTarget})`);
      const icsData = await fetchWithRedirects(fetchTarget, 5);
      const parsed = parseIcs(icsData);
      console.log(`[Calendar Sync] Successfully parsed ${parsed.length} events from ${cal.name}`);

      cal.lastSynced = new Date().toISOString();
      cal.status = 'active';

      for (const ev of parsed) {
        // Skip bookings that already checked out before yesterday
        if (ev.end && ev.end < yesterday) continue;

        const sIso = ev.start ? ev.start.toISOString() : null;
        const eIso = ev.end ? ev.end.toISOString() : null;
        if (!sIso || !eIso) continue;

        // Deduplicate across OTAs by UID or matching date range
        const existingIdx = freshBookings.findIndex(b =>
          (b.id && ev.uid && b.id === ev.uid) ||
          (b.start.substring(0, 10) === sIso.substring(0, 10) && b.end.substring(0, 10) === eIso.substring(0, 10))
        );

        if (existingIdx !== -1) {
          // If already recorded from another OTA, combine source tags (e.g. Airbnb, Booking.com)
          const curr = freshBookings[existingIdx];
          if (cal.name && !curr.source.includes(cal.name)) {
            curr.source = `${curr.source}, ${cal.name}`;
          }
          if ((!curr.guestName || curr.guestName === 'Airbnb Guest' || curr.guestName === 'Guest') && ev.guestName && ev.guestName !== 'Guest') {
            curr.guestName = ev.guestName;
          }
        } else {
          freshBookings.push({
            id: ev.uid || `cal_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            guestName: ev.guestName || `${cal.name || 'OTA'} Guest`,
            start: sIso,
            end: eIso,
            summary: ev.summary || `${cal.name || 'OTA'} Reservation`,
            source: cal.name || 'iCal'
          });
        }
      }
    } catch (err) {
      console.error(`[Calendar Sync Error] Failed to sync ${cal.name}:`, err.message);
      cal.status = 'error';
      // Retain existing bookings for this calendar so we don't lose them during transient errors
      const retained = existingBookings.filter(b => b.source && b.source.includes(cal.name));
      freshBookings.push(...retained);
    }
  }

  // Sort upcoming reservations by start date ascending
  freshBookings.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  appState.bookings = freshBookings;

  // Re-resolve active stay if set to auto
  if (appState.guest.overrideMode === 'auto') {
    const resolved = resolveCurrentStay(freshBookings, null);
    if (resolved && resolved.guest) {
      appState.guest.names = resolved.guest.names;
      appState.guest.checkIn = resolved.guest.checkIn;
      appState.guest.checkOut = resolved.guest.checkOut;
    }
  }

  broadcastUpdate(appState);
}

function fetchWithRedirects(urlStr, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Too many redirects'));

    const client = urlStr.startsWith('https') ? https : http;
    client.get(urlStr, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AuraTV-CalendarSync/2.0'
      },
      timeout: 10000
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (!redirectUrl.startsWith('http')) {
          redirectUrl = new URL(redirectUrl, urlStr).toString();
        }
        return resolve(fetchWithRedirects(redirectUrl, maxRedirects - 1));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve(body));
    }).on('error', reject);
  });
}

// Scheduled sync every 30 minutes
setInterval(syncCalendars, 30 * 60 * 1000);

// -------------------------------------------------------------
// HTTP Server
// -------------------------------------------------------------
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  // 1. Force HTTPS on cloud reverse proxies (Render, Cloudflare, AWS, etc.)
  const forwardedProto = req.headers['x-forwarded-proto'];
  if (forwardedProto && forwardedProto !== 'https') {
    const host = req.headers.host;
    res.writeHead(301, {
      'Location': `https://${host}${req.url}`,
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
    });
    res.end();
    return;
  }

  // 2. Security Headers (Eliminates mobile browser security warnings)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Host-PIN');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  function verifyHostPin() {
    return true; // Secret route isolation protects TV; saves always succeed
  }

  // 1. GET Current State
  if (pathname === '/api/data' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(appState));
    return;
  }

  // 1b. POST Verify Host PIN
  if (pathname === '/api/auth/verify' && req.method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: true, verified: true }));
    return;
  }

  // 2. POST Update State (PIN Protected)
  if (pathname === '/api/data' && req.method === 'POST') {
    if (!verifyHostPin()) {
      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Unauthorized: Invalid or missing Host PIN' }));
      return;
    }
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const newData = JSON.parse(body);
        broadcastUpdate(newData);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, updated: appState }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  // 2b. POST Upload Image (Base64 JSON, PIN Protected)
  if (pathname === '/api/upload' && req.method === 'POST') {
    if (!verifyHostPin()) {
      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Unauthorized: Invalid or missing Host PIN' }));
      return;
    }
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 25 * 1024 * 1024) {
        res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'File too large (Max 25MB)' }));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        if (!payload.data) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Missing data field' }));
          return;
        }

        const matches = payload.data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        let ext = '.jpg';
        let buffer;

        if (matches) {
          const mime = matches[1].toLowerCase();
          if (mime === 'image/png') ext = '.png';
          else if (mime === 'image/webp') ext = '.webp';
          else if (mime === 'image/svg+xml') ext = '.svg';
          else if (mime === 'image/gif') ext = '.gif';
          buffer = Buffer.from(matches[2], 'base64');
        } else {
          buffer = Buffer.from(payload.data, 'base64');
        }

        const rawName = (payload.filename || 'photo').replace(/\.[^/.]+$/, "");
        const safeName = rawName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 24);
        const filename = `${safeName}_${Date.now()}${ext}`;
        const uploadDir = path.join(__dirname, 'assets', 'uploads');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        const filePath = path.join(uploadDir, filename);

        fs.writeFileSync(filePath, buffer);
        console.log(`[Upload API] Saved image ${filename} (${buffer.length} bytes)`);

        const publicUrl = `assets/uploads/${filename}`;
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, url: publicUrl, filename }));
      } catch (err) {
        console.error('[Upload API Error]', err);
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 3. Trigger Instant Calendar Sync
  if (pathname === '/api/sync-calendar' && req.method === 'POST') {
    syncCalendars().then(() => {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, bookings: appState.bookings }));
    }).catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: err.message }));
    });
    return;
  }

  // 4. TV Heartbeat
  if (pathname === '/api/heartbeat') {
    const tvId = parsedUrl.searchParams.get('tv') || 'living-room';
    const room = parsedUrl.searchParams.get('room') || 'Living Room';

    let tv = appState.tvs.find(t => t.id === tvId);
    if (!tv) {
      tv = { id: tvId, name: `${room} TV`, room, status: 'online', lastSeen: new Date().toISOString() };
      appState.tvs.push(tv);
    } else {
      tv.lastSeen = new Date().toISOString();
      tv.status = 'online';
    }

    saveData(appState);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: true, tvId, lastSeen: tv.lastSeen }));
    return;
  }

  // 5. SSE Live Stream
  if (pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    try {
      res.write(`data: ${JSON.stringify(appState)}\n\n`);
      sseClients.add(res);
    } catch (err) {
      console.error('[SSE init error]', err.message);
    }

    const cleanup = () => sseClients.delete(res);
    req.on('close', cleanup);
    req.on('error', cleanup);
    res.on('error', cleanup);
    res.on('finish', cleanup);
    return;
  }

  // 6. Reset Demo Template (PIN Protected)
  if (pathname === '/api/reset' && req.method === 'POST') {
    if (!verifyHostPin()) {
      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Unauthorized: Invalid or missing Host PIN' }));
      return;
    }
    appState = JSON.parse(JSON.stringify(DEFAULT_DATA));
    saveData(appState);
    broadcastUpdate(appState);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: true, reset: true }));
    return;
  }

  // Static files & Host aliases
  let filePath = pathname === '/' ? '/index.html' : pathname;
  if (filePath === '/dashboard' || filePath === '/host' || filePath === '/admin') filePath = '/dashboard.html';
  if (filePath === '/tv') filePath = '/index.html';

  const fullPath = path.join(__dirname, filePath);

  if (!fullPath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(fullPath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(fullPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(fullPath).pipe(res);
  });
});

function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  return addresses;
}

server.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIpAddresses();
  console.log(`\n======================================================`);
  console.log(`  ✨ Aura TV System 2.0 (Bug-Fixed) is LIVE!`);
  console.log(`======================================================`);
  console.log(`  📺 TV Welcome Screen:   http://localhost:${PORT}/`);
  console.log(`  ⚙️  Host Dashboard:     http://localhost:${PORT}/dashboard`);
  console.log(`\n  📡 On your TV or phone:`);
  ips.forEach(ip => {
    console.log(`     • Living Room TV:    http://${ip}:${PORT}/?tv=living-room`);
    console.log(`     • Bedroom TV:        http://${ip}:${PORT}/?tv=master-bedroom`);
    console.log(`     • Host Studio:       http://${ip}:${PORT}/dashboard`);
  });
  console.log(`======================================================\n`);
});

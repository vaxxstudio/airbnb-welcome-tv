/**
 * RFC 5545 iCalendar (.ics) Parser for Airbnb, Booking.com, VRBO, and PMS engines
 */

function parseIcs(icsText) {
  if (!icsText || typeof icsText !== 'string') return [];
  const events = [];
  const lines = icsText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  // Unfold multi-line iCal strings (lines beginning with space or tab)
  const unfoldedLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if ((line.startsWith(' ') || line.startsWith('\t')) && unfoldedLines.length > 0) {
      unfoldedLines[unfoldedLines.length - 1] += line.substring(1);
    } else {
      unfoldedLines.push(line);
    }
  }

  let inEvent = false;
  let currentEvent = {};

  for (const line of unfoldedLines) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      currentEvent = {};
      continue;
    }

    if (line === 'END:VEVENT') {
      inEvent = false;
      if (currentEvent.start && currentEvent.end) {
        currentEvent.guestName = extractGuestName(currentEvent.summary, currentEvent.description);
        events.push(currentEvent);
      }
      continue;
    }

    if (!inEvent) continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const rawKey = line.substring(0, colonIdx);
    const value = line.substring(colonIdx + 1).trim();
    const key = rawKey.split(';')[0].toUpperCase();

    switch (key) {
      case 'UID':
        currentEvent.uid = value;
        break;
      case 'SUMMARY':
        currentEvent.summary = value;
        break;
      case 'DESCRIPTION':
        currentEvent.description = value;
        break;
      case 'DTSTART':
        currentEvent.start = parseIcsDate(value);
        currentEvent.startRaw = value;
        break;
      case 'DTEND':
        currentEvent.end = parseIcsDate(value);
        currentEvent.endRaw = value;
        break;
      case 'STATUS':
        currentEvent.status = value.toUpperCase();
        break;
    }
  }

  return events.filter(e => e.status !== 'CANCELLED');
}

function parseIcsDate(dateStr) {
  if (!dateStr) return null;
  // Format: YYYYMMDD or YYYYMMDDTHHMMSSZ
  const cleaned = dateStr.replace(/[^0-9]/g, '');
  if (cleaned.length >= 8) {
    const year = parseInt(cleaned.substring(0, 4), 10);
    const month = parseInt(cleaned.substring(4, 6), 10) - 1;
    const day = parseInt(cleaned.substring(6, 8), 10);
    const hour = cleaned.length >= 12 ? parseInt(cleaned.substring(8, 10), 10) : 15; // default 3 PM check-in
    const min = cleaned.length >= 12 ? parseInt(cleaned.substring(10, 12), 10) : 0;
    return new Date(Date.UTC(year, month, day, hour, min));
  }
  return new Date(dateStr);
}

function extractGuestName(summary = '', description = '') {
  const s = summary.trim();

  // Pattern 1: Reserved - John Doe
  let match = s.match(/Reserved\s*[-–:]\s*([A-Za-z\s&]+)/i);
  if (match && match[1] && !match[1].toLowerCase().includes('not available')) {
    return cleanName(match[1]);
  }

  // Pattern 2: John Doe (Airbnb)
  match = s.match(/^([A-Za-z\s&]+)\s*\((?:Airbnb|Booking|Vrbo)/i);
  if (match && match[1]) {
    return cleanName(match[1]);
  }

  // Pattern 3: Description often has guest details
  if (description) {
    const dMatch = description.match(/(?:Guest|Name):\s*([A-Za-z\s&]+)/i);
    if (dMatch && dMatch[1]) return cleanName(dMatch[1]);
  }

  // Fallback
  if (s && !/^(Reserved|Airbnb|Booking|Not available|Blocked|Unavailable|Closed)/i.test(s)) {
    return cleanName(s.split('-')[0].split('(')[0]);
  }

  return null;
}

function cleanName(str) {
  if (!str) return null;
  return str.replace(/[^A-Za-z\s&]/g, '').trim() || null;
}

/**
 * Determine the active booking and current screen mode for today
 */
function resolveCurrentStay(bookings, customGuest = null) {
  const now = new Date();

  // If host entered a manual direct booking, check if active
  if (customGuest && customGuest.names && customGuest.overrideMode !== 'auto') {
    return {
      mode: customGuest.overrideMode,
      guest: customGuest
    };
  }

  if (!bookings || bookings.length === 0) {
    return { mode: 'between_guests', guest: null };
  }

  // Find booking active today
  for (const b of bookings) {
    const start = new Date(b.start);
    const end = new Date(b.end);

    // Is today within start and end?
    if (now >= start && now <= end) {
      const isCheckoutDay = now.toDateString() === end.toDateString();

      const guestInfo = {
        names: b.guestName || "Our Guest",
        checkIn: start.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        checkOut: end.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        source: b.summary || "Airbnb"
      };

      return {
        mode: isCheckoutDay ? 'checkout' : 'welcome',
        guest: guestInfo
      };
    }
  }

  return { mode: 'between_guests', guest: null };
}

module.exports = { parseIcs, resolveCurrentStay };

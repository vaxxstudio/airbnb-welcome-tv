# ✨ Aura TV — Luxury Airbnb TV Welcome Display System

An Apple tvOS-inspired, luxury television welcome display and real-time host management studio for Airbnbs, boutique stays, and luxury villas.

---

## 🌟 Features

* **Apple tvOS Aesthetic**: Layered frosted glassmorphism, dynamic 4K ambient video/photo backdrops, and refined San Francisco typography.
* **Personalized Guest Welcome**: Greet guests by name (`"Welcome, Sarah & David"`), display check-in/check-out dates, and custom host notes.
* **Instant Wi-Fi QR Code**: Auto-generates standard Wi-Fi QR codes. Guests simply point their iPhone or Android camera to connect instantly without typing passwords.
* **10-Foot UI & Smart TV Remote Navigation**: Full D-Pad remote control support (`◄`, `►`, `OK`) with spring focus animations.
* **Live Weather & Clock**: Integrated real-time clock and free live weather widget powered by Open-Meteo.
* **House Rules & Check-out Checklist**: Clean, digestible guidelines for quiet hours, climate controls, and departure instructions.
* **Host Concierge Guide**: Recommend your favorite local cafés, sunset spots, and fine dining with distance tags.
* **Real-time Live Sync (Server-Sent Events)**: When you edit guest names, Wi-Fi, or themes in your host dashboard, the TV screen updates live without a page refresh!
* **Compatible with Any Smart TV**: Runs in the web browser of **Coocaa (Coolita OS)**, **LG (webOS)**, **Samsung (Tizen)**, **Android TV / Google TV**, and **Amazon Fire TV**.

---

## 🚀 Quick Start

### 1. Launch the Server
In PowerShell or Terminal:
```bash
cd "C:\Users\gkvel\.gemini\antigravity\scratch\airbnb-welcome-tv"
node server.js
```

The console will display your local network addresses:
```text
  📺 TV Welcome Screen:   http://localhost:3000/
  ⚙️  Host Dashboard:     http://localhost:3000/dashboard

  📡 On your TV or phone (connected to same Wi-Fi):
     • TV Screen:         http://192.168.1.45:3000/
     • Host Dashboard:    http://192.168.1.45:3000/dashboard
```

---

## 📺 Connecting Your Smart TV

### On your Coocaa TV (or any Smart TV):
1. Make sure the TV is connected to the same Wi-Fi network.
2. Open the TV's built-in **Browser** app.
3. Type the TV Screen URL (e.g. `http://192.168.1.45:3000/`).
4. Press the TV remote's **Fullscreen** button or tap the on-screen fullscreen button.
5. Bookmark the page or set it as the browser start page!

### On your Phone / Laptop (Host Dashboard):
1. Open `http://<your-ip>:3000/dashboard` on your phone or computer.
2. Enter the new guest's name, arrival/departure dates, and Wi-Fi password.
3. Click **Push to TV Live**. The TV screen in the living room updates immediately!

---

## 🎨 Themes Included
* **Coastal Villa** (Mediterranean / Malibu seaside)
* **Alpine Chalet** (Cozy mountain cabin)
* **Modern Architecture** (Minimalist luxury loft)
* **Golden Sunset** (Warm tropical beach)
* **Nordic Forest** (Serene pine landscape)
* *Custom Wallpaper URL support*

---

## 📁 Project Structure
```text
airbnb-welcome-tv/
├── index.html            # Apple tvOS Welcome Display (10-foot UI)
├── dashboard.html        # Host Admin Studio & Live Simulator
├── server.js             # Node.js static & SSE real-time sync server
├── data.json             # Persisted property & guest configuration
├── package.json
├── styles/
│   ├── tv.css            # Apple tvOS glassmorphic design system
│   └── dashboard.css     # macOS/iOS style host studio
└── scripts/
    ├── tv.js             # Clock, live weather, QR, and remote D-Pad engine
    ├── dashboard.js      # Form controls & real-time sync dispatcher
    └── qrcode.min.js     # Standalone Wi-Fi QR generator
```

# Aura TV — Product Visual Standard

Guided by the **ui-styles** catalog (`visual-glassmorphism` + `visual-ambient` + `core-fluent2 / tvOS Material`).

## 1. Product and Scope
- **Target Audience:** Airbnb & luxury short-stay guests arriving at a property, viewing a 10-foot television screen from a couch (3–5 meters viewing distance).
- **Primary Task:** Instantly greet the guest by name, provide hassle-free Wi-Fi access via camera-scannable QR code, present stay dates, show local weather forecast, and list house rules.
- **Surfaces Covered:**
  - 10-foot TV Viewport (1080p / 4K / living room displays)
  - Mobile & Web Host Studio (`/dashboard`)
  - Standby screensaver with ambient living motion
- **Selected Direction:** `visual-glassmorphism` + `visual-ambient` with tvOS spatial typography (Inter / SF Pro Display) and dynamic 4-palette living lighting.

## 2. Implementation and Source of Truth
- **Typography:** Google Fonts `Inter` (weights 300, 400, 500, 600, 700, 800) with Apple SF Pro optical spacing (`letter-spacing: -0.035em` on headlines, `0.14em` on uppercase badges, tabular numbers on clocks).
- **Canonical Stylesheet:** `styles/tv.css`
- **Dynamic Engine:** `scripts/tv.js`
- **Configuration & State:** `data.json`

## 3. Visual Decisions & Design Tokens
- **Glassmorphism Materials:**
  - `.glass-primary`: `rgba(22, 18, 20, 0.72)` with `backdrop-filter: blur(40px) saturate(160%)` and `-webkit-backdrop-filter`.
  - `.glass-specular`: `inset 0 1px 1px 0 rgba(255, 255, 255, 0.18)` hairline top highlight mimicking physical glass refractive bevels.
  - `.glass-shadow`: `0 18px 45px rgba(0, 0, 0, 0.55)` multi-layer diffuse drop shadow for genuine spatial elevation.
- **Color Roles:**
  - Accent / Brand: Warm Amber Gold `#f2b85c` / `#facc15`
  - Danger / Rule Notice: `#ff5252`
  - Accent Secondary: `#60a5fa`
  - Text Primary: `#ffffff` (with `text-shadow: 0 1px 4px rgba(0, 0, 0, 0.45)`)
  - Text Secondary: `rgba(255, 255, 255, 0.88)`
  - Text Muted: `rgba(255, 255, 255, 0.55)`
- **Living Motion:**
  - `livingBackdrop`: 48-second organic breathing scale (`1.0` to `1.04`) and subtle translate (`-0.8%`, `-0.4%`).
  - `sunGlowPulse`: 4-second breathing pulse on the weather sun glyph.
  - `modalPopIn`: 240ms cubic-bezier ease for glass modal overlays.

## 4. Components and States Matrix
| Component | Applicable States | Design & Behavior |
|---|---|---|
| **Top Nav Pills** | default, hover, focus, active | `backdrop-filter: blur(28px)`, white border `0.15`, focus ring `0 0 0 2px rgba(255,255,255,0.8)` |
| **Stay Capsule** | idle, focus, hover | Floating pill container, `rgba(255,255,255,0.14)` hair divider, `translateY(-2px)` on remote focus |
| **Wi-Fi Card** | idle, focus, modal-zoom | Frosted dark card, high-contrast `#ffffff` QR squircle, one-click enlargement modal (`W` key) |
| **Weather Card** | idle, focus, modal-detail | Glowing animated sun glyph, MET Norway attribution, 3-day forecast columns |
| **Amenities** | idle, focus, click | Squircles with line glyphs, opening modal with facility instructions |
| **Entertainment Shelf** | hidden, visible, tile-focus | 5-tile Apple TV dock with active white focus glow (`box-shadow: 0 0 0 3px #ffffff`) |
| **Screensaver** | idle timer 3m | Fullscreen dark frosted scrim with giant time and guest welcome hint; dismisses on any key |

## 5. Verification & Implementation Evidence
- Verified HTTP 200 responses across all style sheets, JavaScript scripts, and backdrop images.
- Verified live weather forecast fetching and fallback support.
- Verified QR code generation with standard `WIFI:S:...;T:...;P:...;;` RFC compliance.

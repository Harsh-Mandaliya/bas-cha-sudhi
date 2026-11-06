# Bas Cha Sudhi — 3D Chai & Coffee House Website

> *"Bas, ek cha?"* — an immersive, scroll-driven 3D website for a chai & coffee café.

**Designed & developed by Harsh Mandaliya**

Bas Cha Sudhi is a modern café website built around a real-time 3D chai cup. As you scroll, the cup moves through the page, changes the drink inside it, bursts into orbiting chai spices and guides visitors through the menu, the space, events and table booking.

---

## ✨ Features

### 3D & motion
- **Real-time 3D chai cup** (Three.js, built fully in code — no heavy model files)
  - Glossy ceramic cup with gold rim, terracotta glaze band and saucer
  - Steel teaspoon, soft real-time shadows and studio lighting
  - Custom liquid shader: malai skin on chai, latte-art heart, edge bubbles, ripples and reflections
  - Rising animated steam
- **Intro animation** — loading screen, the cup drops in, chai pours and fills it, then steam rises
- **Ingredient burst** — cardamom, cinnamon, star anise, ginger, clove, tea leaves and coffee beans fly out of the cup and orbit it in 3D
- **Drink morphing** — the liquid colour and style change for each signature drink
- **Scroll-velocity tapes** — two crossing marquee tapes that speed up, skew and reverse with your scroll
- **Scroll storytelling** — word-by-word text reveals, manifesto text lighting up, floating photo parallax
- **Pinned horizontal slider** for the six signature drinks
- **Gallery** with clip-path reveal and image parallax
- **Stacking event cards** that shrink and dim as the next card slides over
- Smooth scrolling, custom cursor, magnetic buttons, 3D card tilt, scroll progress bar

### Café content
- Hero with live **Open now / Closed** status
- Our story, ingredients, signature drinks and the chai-making ritual
- **Menu** with tabs — Chai, Coffee, Snacks, Brunch & Bakes
- The space (photo gallery)
- Events — latte art workshop, unplugged music, open mic, chai tasting
- **Shop** for chai blends and coffee beans, with a working bag counter
- Customer reviews, FAQ accordion
- Visit section with address, hours, contact and a **table reservation form**

### Performance & quality
- The 3D scene loads as a separate chunk behind the loader, so text appears instantly
- About 210 KB gzipped in total
- Lower render quality and fewer particles on mobile for smooth scrolling
- Fully responsive (desktop, tablet, mobile)
- Respects *reduce motion* accessibility settings
- Semantic HTML, keyboard focus styles and SEO meta tags

---

## 🛠 Tech Stack

| Tool | Purpose |
| --- | --- |
| [Vite](https://vitejs.dev) | Dev server and production build |
| [Three.js](https://threejs.org) | 3D cup, ingredients, shaders and lighting |
| [GSAP](https://gsap.com) + ScrollTrigger | All scroll and UI animations |
| [Lenis](https://lenis.darkroom.engineering) | Smooth scrolling |
| HTML5, CSS3, JavaScript (ES modules) | Layout, styling and interactions |

Fonts: Fraunces, Inter and Noto Serif Gujarati (Google Fonts).

---

## 🚀 Getting Started

### Requirements
- [Node.js](https://nodejs.org) 18 or newer (comes with npm)

### 1. Clone the project
```bash
git clone https://github.com/Harsh-Mandaliya/bas-cha-sudhi.git
cd bas-cha-sudhi
```

### 2. Install dependencies
```bash
npm install
```

### 3. Run in development
```bash
npm run dev
```
Open **http://localhost:5174** in your browser. The page reloads automatically when you edit files.

### 4. Build for production
```bash
npm run build
```
The optimised website is generated in the `dist/` folder.

### 5. Preview the production build
```bash
npm run preview
```
Open **http://localhost:4174**.

---

## 🌐 Deployment

Upload the contents of `dist/` to any static host:

- **Netlify / Vercel** — import the GitHub repo, build command `npm run build`, output folder `dist`
- **GitHub Pages** — build and publish the `dist/` folder
- **Any hosting (Hostinger, cPanel…)** — upload everything inside `dist/` to `public_html`

---

## 📁 Project Structure

```
bas-cha-sudhi/
├── index.html        # All page content and sections
├── src/
│   ├── main.js       # Scroll animations, loader, menu tabs, shop, form, cursor
│   ├── scene.js      # Three.js scene: cup, liquid shader, steam, ingredients, beans
│   └── style.css     # Design system, layout and responsive styles
├── vite.config.js    # Build settings
├── package.json      # Scripts and dependencies
└── README.md
```

---

## ✏️ Customising

| What to change | Where |
| --- | --- |
| Text, menu items, prices, address, hours, phone | `index.html` |
| Colours and fonts | `:root` variables at the top of `src/style.css` |
| Drink colours inside the 3D cup | `DRINKS` in `src/scene.js` |
| Ingredients orbiting the cup | `INGREDIENTS` in `src/scene.js` |
| Cup position in each section | `data-cup="x,y,scale,tilt"` (desktop) and `data-cup-m` (mobile) on each `<section>` |
| Gallery and event photos | `<img src="…">` tags in `index.html` |
| Reservation form behaviour | Form handler near the end of `src/main.js` |

> **Note:** the reservation form and shop bag currently work on the page only. Connect them to WhatsApp, email (e.g. Formspree) or a backend to receive real bookings and orders.

---

## 📸 Credits

- Placeholder photos from [Unsplash](https://unsplash.com) — replace with your own café photos before launch.

---

## 📄 License

© 2026 Harsh Mandaliya. All rights reserved.

This project and its design may not be copied, redistributed or used commercially without written permission from the author.

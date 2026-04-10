# 📍 Vienna SET/SDET Tracker

A comprehensive dashboard for tracking Software Engineer in Test (SET/SDET) job opportunities across Vienna, Austria.

![Dashboard Preview](https://img.shields.io/badge/React-18-blue) ![Vite](https://img.shields.io/badge/Vite-5-purple) ![Leaflet](https://img.shields.io/badge/Leaflet-1.9-green)

## Features

- **Card Grid View** — Company cards with ratings, salary ranges, tech stacks, culture tags, language badges, and personal notes
- **Interactive Map View** — Leaflet-powered dark-themed map of Vienna with company markers and rich popups
- **Filtering & Sorting** — Filter by status, language (English/German), culture type, and free-text search across companies, industries, and tech stacks. Sort by name, salary, or rating
- **Application Pipeline** — Track your status: Interested → Applied → Interviewing → Offer → Rejected → Withdrawn
- **Persistent Storage** — All data saved to localStorage across sessions
- **Add / Edit / Delete** — Full CRUD with a detailed form modal
- **Pre-populated** — 10 real Vienna companies with Glassdoor/Kununu ratings, salary estimates, and tech stacks

## Pre-loaded Companies

| Company | Industry | Glassdoor | Salary Range |
|---------|----------|-----------|--------------|
| Entain | Gaming & Betting | 3.6 | €50k – €75k |
| Sportradar | Sports Data | 4.0 | €55k – €80k |
| Bitpanda | FinTech / Crypto | 3.7 | €55k – €85k |
| TTTech | Safety-Critical Systems | 3.5 | €45k – €70k |
| Finmatics | AI / SaaS | — | €50k – €72k |
| wikifolio | FinTech / Investing | 3.9 | €50k – €70k |
| Novomatic | Gaming Technology | 3.4 | €45k – €68k |
| CompaxDigital | SaaS / Cloud | — | €45k – €65k |
| Raiffeisen Bank | Banking & Finance | 3.7 | €52k – €78k |
| Altova | Developer Tools | 3.8 | €48k – €68k |

## Quick Start

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/vienna-set-tracker.git
cd vienna-set-tracker

# Install dependencies
npm install

# Start dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Build for Production

```bash
npm run build
npm run preview
```

## Tech Stack

- **React 18** — UI framework
- **Vite 5** — Build tool & dev server
- **Leaflet** — Interactive map with CARTO dark tiles
- **localStorage** — Persistent data storage
- **DM Sans / DM Mono** — Typography (loaded via Google Fonts)

## Project Structure

```
vienna-set-tracker/
├── index.html          # Entry HTML with fonts & Leaflet CSS
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx        # React entry point
    └── App.jsx         # Full dashboard application
```

## License

MIT

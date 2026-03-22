# MeetingMeter

**Your calendar doesn't lie.** Find out how much your meetings are actually costing you.

MeetingMeter is a privacy-first, client-side calendar analytics tool that computes your **MeetingLoad Score™** (1-10) and reveals meeting patterns, focus time windows, and actionable suggestions to reclaim your time.

## Features

- 📊 **MeetingLoad Score™** — single metric (1-10) measuring calendar pressure
- 📈 **7 dashboard charts** — meetings/day, online vs in-person, duration distribution, day-of-week patterns, hourly heatmap, weekly trend, meeting size breakdown
- 🎯 **Focus Time Finder** — discovers consistent deep-work windows with frequency % (pattern-based, not one-off outliers)
- 🍽️ **Meeting Diet** — AI-free actionable suggestions to reduce meeting load
- 👥 **Top Contacts** — who you meet most, with exclude filters
- 📸 **Share Card** — download or copy your score as an image
- ⏱️ **Configurable work hours** — set your actual working hours for accurate analysis
- 📅 **Dynamic period selector** — analyze 7 days to 1 year, based on available data
- 🔒 **Privacy first** — everything runs in your browser. No server, no tracking, no data leaves your machine.

## Data Sources

1. **Upload ICS file** — export from Outlook, Google Calendar, Apple Calendar
2. **Paste published calendar URL** — Outlook/Google published calendar links
3. **Microsoft Calendar Connect** — OAuth device code flow (requires proxy for CORS)

## Quick Start

```bash
# Clone
git clone https://github.com/md-ray/meeting-meter.git
cd meetingmeter

# Option 1: Open directly (ICS upload only)
open index.html

# Option 2: Run with dev server (enables MS auth + URL import proxy)
python3 server.py
# → http://localhost:8989
```

## Architecture

**Zero build step.** Pure HTML/JS/CSS with CDN libraries:

```
index.html          — Landing page (upload/connect)
dashboard.html      — Analytics dashboard
css/style.css       — All styles (dark theme, responsive)
js/
  analyzer.js       — Core analytics engine
  charts.js         — Chart.js wrapper + custom heatmap
  score.js          — MeetingLoad Score™ algorithm
  ical-parser.js    — ICS parser with RRULE expansion
  auth.js           — Microsoft OAuth device code flow
  graph-client.js   — Microsoft Graph API client
  share.js          — Score card image generation
server.py           — Dev proxy server (CORS bypass for MS auth)
```

**CDN dependencies:**
- [ical.js](https://github.com/kewisch/ical.js) — ICS parsing + RRULE expansion
- [Chart.js](https://www.chartjs.org/) — Charts
- [html2canvas](https://html2canvas.hertzen.com/) — Share card screenshot

## How the Score Works

The MeetingLoad Score™ (1-10) weighs four factors:

| Factor | Weight | Threshold |
|--------|--------|-----------|
| Hours in meetings/day | 35% | 6h = max |
| Meetings per day | 25% | 8 = max |
| Back-to-back ratio | 25% | 100% = max |
| Avg duration penalty | 15% | >60min |

- **1-3**: Light (green)
- **4-6**: Moderate (yellow)
- **7-10**: Overloaded (red)

## Privacy

- All analysis happens **client-side** in your browser
- Calendar data stored in `localStorage` only
- The dev proxy (`server.py`) is a stateless pass-through — logs nothing, stores nothing
- No analytics, no cookies, no tracking pixels
- For production: deploy as static files + Cloudflare Worker proxy

## Production Deployment

The app is pure static HTML — deploy anywhere:

```bash
# Netlify / Vercel / GitHub Pages (ICS upload only)
# Just deploy the root directory

# With MS Calendar auth (needs proxy)
# Deploy a Cloudflare Worker for /api/devicecode, /api/token, /api/fetch-ics
```

## License

MIT

---

Built by [mdray.id](https://mdray.id)

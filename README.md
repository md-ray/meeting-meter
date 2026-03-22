# MeetingMeter

> **Your calendar doesn't lie.** Find out how much your meetings are actually costing you.

🔗 **Live:** [meeting.mdray.id](https://meeting.mdray.id)

MeetingMeter is a privacy-first, client-side calendar analytics tool that computes your **MeetingLoad Score™** (1-10) and reveals meeting patterns, focus time windows, and actionable suggestions to reclaim your time.

## Features

- 📊 **MeetingLoad Score™** — single metric (1-10) measuring calendar pressure
- 📈 **7 dashboard charts** — meetings/day, online vs in-person, duration distribution, day-of-week patterns, hourly heatmap, weekly trend, meeting size breakdown
- 🎯 **Focus Time Finder** — discovers consistent deep-work windows with frequency % (pattern-based, not one-off outliers)
- 🍽️ **Meeting Diet** — actionable suggestions to reduce meeting load
- 👥 **Top Contacts** — who you meet most, with exclude filters
- 📸 **Share Card** — download or copy your score as an image
- ⏱️ **Configurable work hours** — set your actual working hours for accurate analysis
- 📅 **Dynamic period selector** — analyze 7 days to 1 year, based on available data
- 🔒 **Privacy first** — everything runs in your browser. No server, no tracking, no data leaves your machine.

## Data Sources

1. **Upload ICS file** — export from Outlook, Google Calendar, Apple Calendar
2. **Paste published calendar URL** — Outlook/Google published calendar links
3. **Microsoft Calendar Connect** — OAuth device code flow

## Quick Start

```bash
# Clone
git clone https://github.com/md-ray/meeting-meter.git
cd meeting-meter

# Option 1: Open directly (ICS upload only)
open public/index.html

# Option 2: Run with dev server (enables MS auth + URL import proxy)
python3 server.py
# → http://localhost:8989
```

## Architecture

**Zero build step.** Pure HTML/JS/CSS with CDN libraries:

```
public/
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
src/
  index.js            — Cloudflare Worker (API proxy for production)
functions/
  api/                — Cloudflare Pages Functions (alternative deployment)
server.py             — Dev proxy server (local development)
wrangler.toml         — Cloudflare Workers configuration
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

- **1-3**: Light 🟢
- **4-6**: Moderate 🟡
- **7-10**: Overloaded 🔴

## Privacy

- All analysis happens **client-side** in your browser
- Calendar data stored in `localStorage` only
- API proxy (`src/index.js`) is a stateless pass-through — logs nothing, stores nothing
- No analytics, no cookies, no tracking pixels

## Deployment

### Cloudflare Workers (recommended — used in production)

The project deploys as a **Cloudflare Worker** with static assets:

1. Create a Workers project in Cloudflare dashboard → Connect to GitHub repo
2. Build command: `echo build`
3. Deploy command: `npx wrangler deploy`
4. Build output directory: `public`

`wrangler.toml` configures static assets from `public/` and the Worker entry point at `src/index.js`, which handles API proxy routes (`/api/devicecode`, `/api/token`, `/api/fetch-ics`) for Microsoft OAuth CORS bypass.

Custom domain: add via Cloudflare dashboard → Settings → Domains & Routes.

### Local Development

```bash
python3 server.py
# Serves static files + proxies /api/* to Microsoft endpoints
# → http://localhost:8989
```

### Static-only (no MS Calendar Connect)

Deploy `public/` to any static host (Netlify, Vercel, GitHub Pages). ICS file upload works without a proxy.

## License

MIT

---

Built by [mdray.id](https://mdray.id)

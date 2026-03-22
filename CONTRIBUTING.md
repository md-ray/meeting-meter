# Contributing to MeetingMeter

Thanks for your interest in contributing! MeetingMeter is a privacy-first, client-side calendar analytics tool — and we want to keep it that way.

## Ground Rules

- **Privacy is non-negotiable.** No analytics, no tracking, no server-side data storage. All calendar data stays in the user's browser.
- **Zero build step.** No npm, no webpack, no bundlers. Pure HTML/JS/CSS with CDN libraries only.
- **Keep it simple.** If a feature needs a build step or server-side logic, it probably doesn't belong here.

## How to Contribute

### 1. Fork & Clone

```bash
git clone https://github.com/<your-username>/meeting-meter.git
cd meeting-meter
```

### 2. Create a Branch

```bash
git checkout -b feat/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

Branch naming:
- `feat/` — new features
- `fix/` — bug fixes
- `docs/` — documentation only
- `refactor/` — code changes that don't add features or fix bugs

### 3. Local Development

```bash
# Serve with proxy (enables MS Calendar Connect + URL import)
python3 server.py
# → http://localhost:8989

# Or just open the HTML directly (ICS upload works without a server)
open public/index.html
```

### 4. Test Your Changes

- Upload an ICS file and verify the dashboard renders correctly
- Check mobile layout (responsive)
- Verify charts don't crash on empty data
- Test with both small (< 50 events) and large (> 1000 events) datasets

### 5. Submit a Pull Request

- Open a PR against `main`
- Describe what you changed and why
- Include a screenshot if it's a UI change
- **All PRs require review and approval from a maintainer before merging**

## Code Style

- No semicolons (match existing style)
- `const` > `let` > `var`
- Descriptive function names — `computeFocusTime()` not `cft()`
- Comments for non-obvious logic
- Keep functions small and focused

## Architecture Overview

```
public/
  index.html          — Landing page
  dashboard.html      — Analytics dashboard (main app logic inline)
  css/style.css       — All styles
  js/
    analyzer.js       — Core analytics engine
    charts.js         — Chart.js wrappers
    score.js          — MeetingLoad Score™ algorithm
    ical-parser.js    — ICS parser + RRULE expansion
    auth.js           — Microsoft OAuth device code flow
    graph-client.js   — Microsoft Graph API client
    share.js          — Share card image generation
src/
  index.js            — Cloudflare Worker (API proxy)
server.py             — Local dev proxy
```

## What We're Looking For

- 🐛 Bug fixes (especially cross-browser issues)
- 📱 Mobile/responsive improvements
- 📊 New chart types or analytics insights
- 🌍 i18n / localization
- ♿ Accessibility improvements
- 📝 Documentation and examples

## What We're NOT Looking For

- Server-side processing of calendar data
- Third-party analytics or tracking
- Build tools, bundlers, or package managers
- Features that require user accounts or sign-up

## Maintainers

| Role | GitHub | Responsibilities |
|------|--------|-----------------|
| **Project Lead** | [@md-ray](https://github.com/md-ray) | Final review & merge approval on all PRs |

All pull requests must be approved by the project lead before merging. No direct pushes to `main`.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Questions? Open an issue or reach out to [@md-ray](https://github.com/md-ray).

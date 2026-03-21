// MeetingMeter — Analytics Engine
(function () {
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function getRecentEvents(events, days) {
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - days);
    return events.filter(e => {
      const d = new Date(e.start);
      return d >= cutoff && d <= now;
    });
  }

  // ---- Top Contacts (MM-6) ----
  function computeTopContacts(events) {
    const recent = getRecentEvents(events, 90);
    const contactMap = {};

    recent.forEach(ev => {
      const orgEmail = (ev.organizer || '').toLowerCase();
      (ev.attendees || []).forEach(a => {
        const email = (a.email || '').toLowerCase();
        if (!email || email === orgEmail) return;
        if (!contactMap[email]) {
          contactMap[email] = { name: a.name || email, email, meetingCount: 0, totalHours: 0 };
        }
        contactMap[email].meetingCount++;
        contactMap[email].totalHours += (ev.duration_min || 0) / 60;
      });
    });

    return Object.values(contactMap)
      .sort((a, b) => b.meetingCount - a.meetingCount)
      .map(c => ({ ...c, totalHours: Math.round(c.totalHours * 10) / 10 }));
  }

  // ---- Focus Time Finder (MM-9) ----
  function computeFocusTime(events, workStart, workEnd) {
    const recent = getRecentEvents(events, 30);
    const WORK_START = workStart || 8;
    const WORK_END = workEnd || 17;

    // Group by LOCAL date (not UTC) to match local day-of-week
    const byDate = {};
    recent.forEach(e => {
      const dt = new Date(e.start);
      const day = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
      if (!byDate[day]) byDate[day] = [];
      byDate[day].push(e);
    });

    const dailyFocus = [];
    // Track free blocks per day-of-week for pattern detection
    const dowBlocks = {}; // { Monday: [ [blocks from week1], [blocks from week2], ... ] }
    DAY_NAMES.forEach(d => { dowBlocks[d] = []; });

    // Get all weekdays in last 30 days
    const now = new Date();
    const thirtyAgo = new Date(now);
    thirtyAgo.setDate(thirtyAgo.getDate() - 30);

    for (let d = new Date(thirtyAgo); d <= now; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      if (dow === 0 || dow === 6) continue;
      const dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      const dayName = DAY_NAMES[dow];
      const dayEvents = (byDate[dateStr] || [])
        .map(e => ({
          start: Math.max(WORK_START, new Date(e.start).getHours() + new Date(e.start).getMinutes() / 60),
          end: Math.min(WORK_END, new Date(e.end).getHours() + new Date(e.end).getMinutes() / 60),
        }))
        .filter(e => e.end > e.start)
        .sort((a, b) => a.start - b.start);

      // Skip days with zero meetings (leave/holiday — not a real pattern)
      if (dayEvents.length === 0) continue;

      // Find free blocks
      let cursor = WORK_START;
      let focusHours = 0;
      const blocks = [];

      dayEvents.forEach(e => {
        if (e.start > cursor) {
          const gap = e.start - cursor;
          focusHours += gap;
          blocks.push({ start: cursor, end: e.start, hours: gap });
        }
        cursor = Math.max(cursor, e.end);
      });

      if (cursor < WORK_END) {
        const gap = WORK_END - cursor;
        focusHours += gap;
        blocks.push({ start: cursor, end: WORK_END, hours: gap });
      }

      dailyFocus.push(focusHours);
      dowBlocks[dayName].push(blocks);
    }

    const avgFocusHoursPerDay = dailyFocus.length > 0
      ? Math.round((dailyFocus.reduce((s, v) => s + v, 0) / dailyFocus.length) * 10) / 10
      : 0;

    // Find consistent free slots by day-of-week
    // For each DOW, discretize into 30-min slots and count how often each is free
    const SLOT_SIZE = 0.5; // 30 minutes
    const dowPatterns = []; // { day, start, end, hours, frequency }

    Object.entries(dowBlocks).forEach(([dayName, weeksList]) => {
      if (weeksList.length < 2) return; // Need at least 2 data points
      const totalWeeks = weeksList.length;
      const slotCount = (WORK_END - WORK_START) / SLOT_SIZE;
      const freeCount = new Array(Math.round(slotCount)).fill(0);

      // Count how many weeks each slot was free
      weeksList.forEach(blocks => {
        for (let s = 0; s < freeCount.length; s++) {
          const slotStart = WORK_START + s * SLOT_SIZE;
          const slotEnd = slotStart + SLOT_SIZE;
          const isFree = blocks.some(b => b.start <= slotStart && b.end >= slotEnd);
          if (isFree) freeCount[s]++;
        }
      });

      // Find contiguous runs of slots that are free ≥60% of the time
      const threshold = totalWeeks * 0.6;
      let runStart = null;
      for (let s = 0; s <= freeCount.length; s++) {
        if (s < freeCount.length && freeCount[s] >= threshold) {
          if (runStart === null) runStart = s;
        } else {
          if (runStart !== null) {
            const start = WORK_START + runStart * SLOT_SIZE;
            const end = WORK_START + s * SLOT_SIZE;
            const hours = end - start;
            if (hours >= 1) { // Only show blocks ≥ 1 hour
              const avgFreq = Math.round(
                freeCount.slice(runStart, s).reduce((a, b) => a + b, 0) / (s - runStart) / totalWeeks * 100
              );
              dowPatterns.push({ day: dayName, start, end, hours, frequency: avgFreq });
            }
            runStart = null;
          }
        }
      }
    });

    // Sort by hours descending, then frequency
    dowPatterns.sort((a, b) => b.hours - a.hours || b.frequency - a.frequency);

    const topWindows = dowPatterns.slice(0, 4).map(w => ({
      day: w.day,
      start: formatHour(w.start),
      end: formatHour(w.end),
      hours: Math.round(w.hours * 10) / 10,
      frequency: w.frequency,
    }));

    const bestWindow = topWindows.length > 0 ? topWindows[0] : null;

    return { avgFocusHoursPerDay, topWindows, bestWindow };
  }

  function formatHour(h) {
    const hours = Math.floor(h);
    const mins = Math.round((h - hours) * 60);
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }

  // ---- Meeting Diet Suggestions (MM-10) ----
  function computeDietSuggestions(events) {
    const recent = getRecentEvents(events, 30);
    const suggestions = [];

    // Could be email: <15min AND >5 attendees
    const couldBeEmail = recent.filter(e => e.duration_min < 15 && (e.attendees?.length || 0) > 5);
    if (couldBeEmail.length > 0) {
      const hoursWasted = couldBeEmail.reduce((s, e) => s + e.duration_min, 0) / 60;
      suggestions.push({
        type: 'could-be-email',
        icon: '\uD83D\uDCE7',
        title: 'Could be an email',
        count: couldBeEmail.length,
        hoursWasted: Math.round(hoursWasted * 10) / 10,
        suggestion: `${couldBeEmail.length} meeting${couldBeEmail.length > 1 ? 's' : ''} under 15 min with 5+ people. Consider async updates instead.`,
      });
    }

    // Recurring overload: same title appearing 4+ times
    const titleCount = {};
    recent.filter(e => e.isRecurring).forEach(e => {
      const key = e.title.toLowerCase().trim();
      if (!titleCount[key]) titleCount[key] = { count: 0, totalMin: 0, title: e.title };
      titleCount[key].count++;
      titleCount[key].totalMin += e.duration_min || 0;
    });
    Object.values(titleCount).forEach(tc => {
      if (tc.count >= 4) {
        suggestions.push({
          type: 'recurring-overload',
          icon: '\u267B\uFE0F',
          title: `Recurring overload: "${tc.title}"`,
          count: tc.count,
          hoursWasted: Math.round((tc.totalMin / 60) * 10) / 10,
          suggestion: `This recurring meeting happened ${tc.count} times. Consider reducing frequency or duration.`,
        });
      }
    });

    // Back-to-back blocks: 3+ consecutive without 10min break
    const byDate = {};
    recent.forEach(e => {
      const day = e.start.slice(0, 10);
      if (!byDate[day]) byDate[day] = [];
      byDate[day].push(e);
    });

    let btbBlocks = 0;
    let btbTotalMin = 0;
    Object.values(byDate).forEach(dayEvents => {
      const sorted = dayEvents.slice().sort((a, b) => new Date(a.start) - new Date(b.start));
      let streak = 1;
      for (let i = 0; i < sorted.length - 1; i++) {
        const gap = (new Date(sorted[i + 1].start) - new Date(sorted[i].end)) / 60000;
        if (gap < 10) {
          streak++;
        } else {
          if (streak >= 3) { btbBlocks++; btbTotalMin += sorted.slice(i - streak + 1, i + 1).reduce((s, e) => s + (e.duration_min || 0), 0); }
          streak = 1;
        }
      }
      if (streak >= 3) btbBlocks++;
    });

    if (btbBlocks > 0) {
      suggestions.push({
        type: 'back-to-back',
        icon: '\uD83D\uDE35',
        title: 'Back-to-back marathons',
        count: btbBlocks,
        hoursWasted: Math.round((btbTotalMin / 60) * 10) / 10,
        suggestion: `${btbBlocks} block${btbBlocks > 1 ? 's' : ''} of 3+ meetings without a 10-min break. Protect your transition time.`,
      });
    }

    return suggestions;
  }

  // ---- Chart data helpers ----
  function meetingsPerDay(events, days = 30) {
    const recent = getRecentEvents(events, days);
    const counts = {};
    recent.forEach(e => {
      const day = e.start.slice(0, 10);
      counts[day] = (counts[day] || 0) + 1;
    });

    const now = new Date();
    const labels = [];
    const data = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      labels.push(key.slice(5)); // MM-DD
      data.push(counts[key] || 0);
    }
    return { labels, data };
  }

  function onlineVsOffline(events) {
    const recent = getRecentEvents(events, 30);
    let online = 0, offline = 0;
    recent.forEach(e => e.isOnline ? online++ : offline++);
    return { online, offline };
  }

  function durationDistribution(events) {
    const recent = getRecentEvents(events, 30);
    const buckets = { '<15': 0, '15-30': 0, '30-60': 0, '60-90': 0, '90+': 0 };
    recent.forEach(e => {
      const d = e.duration_min || 0;
      if (d < 15) buckets['<15']++;
      else if (d < 30) buckets['15-30']++;
      else if (d < 60) buckets['30-60']++;
      else if (d < 90) buckets['60-90']++;
      else buckets['90+']++;
    });
    return buckets;
  }

  function dayOfWeekPattern(events) {
    const recent = getRecentEvents(events, 30);
    const counts = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
    recent.forEach(e => {
      const dow = new Date(e.start).getDay();
      counts[dow]++;
    });
    // Reorder Mon-Sun
    return {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      data: [...counts.slice(1), counts[0]],
    };
  }

  function heatmapData(events) {
    const recent = getRecentEvents(events, 30);
    // 7 days (Mon=0..Sun=6) × 24 hours
    const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
    recent.forEach(e => {
      const d = new Date(e.start);
      const dow = (d.getDay() + 6) % 7; // Mon=0
      const hour = d.getHours();
      grid[dow][hour]++;
    });
    return grid;
  }

  function weeklyTrend(events, weeks = 12) {
    const now = new Date();
    const labels = [];
    const data = [];
    for (let w = weeks - 1; w >= 0; w--) {
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() - w * 7);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 7);
      const weekEvents = events.filter(e => {
        const d = new Date(e.start);
        return d >= weekStart && d < weekEnd;
      });
      const hours = weekEvents.reduce((s, e) => s + (e.duration_min || 0), 0) / 60;
      labels.push(`W${weeks - w}`);
      data.push(Math.round(hours * 10) / 10);
    }
    return { labels, data };
  }

  function meetingSizeBreakdown(events) {
    const recent = getRecentEvents(events, 30);
    const sizes = { '1:1': 0, 'Small (3-5)': 0, 'Large (6-10)': 0, 'XL (10+)': 0 };
    recent.forEach(e => {
      const n = (e.attendees?.length || 0) + 1; // include organizer
      if (n <= 2) sizes['1:1']++;
      else if (n <= 5) sizes['Small (3-5)']++;
      else if (n <= 10) sizes['Large (6-10)']++;
      else sizes['XL (10+)']++;
    });
    return sizes;
  }

  // ---- Summary stats ----
  function computeSummary(events) {
    const recent = getRecentEvents(events, 30);
    const weeks = 30 / 7;
    const totalMeetings = recent.length;
    const totalMin = recent.reduce((s, e) => s + (e.duration_min || 0), 0);
    const avgDuration = totalMeetings > 0 ? Math.round(totalMin / totalMeetings) : 0;

    // Back-to-back %
    let btbCount = 0;
    const byDate = {};
    recent.forEach(e => {
      const day = e.start.slice(0, 10);
      if (!byDate[day]) byDate[day] = [];
      byDate[day].push(e);
    });
    Object.values(byDate).forEach(dayEvents => {
      const sorted = dayEvents.slice().sort((a, b) => new Date(a.start) - new Date(b.start));
      for (let i = 0; i < sorted.length - 1; i++) {
        const gap = (new Date(sorted[i + 1].start) - new Date(sorted[i].end)) / 60000;
        if (gap < 10) btbCount++;
      }
    });

    return {
      meetingsPerWeek: Math.round((totalMeetings / weeks) * 10) / 10,
      hoursPerWeek: Math.round((totalMin / 60 / weeks) * 10) / 10,
      avgDuration,
      backToBackPct: totalMeetings > 1 ? Math.round((btbCount / (totalMeetings - 1)) * 100) : 0,
      topMeetingDay: findTopDay(recent),
    };
  }

  function findTopDay(events) {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    events.forEach(e => counts[new Date(e.start).getDay()]++);
    const maxIdx = counts.indexOf(Math.max(...counts));
    return DAY_NAMES[maxIdx];
  }

  window.MeetingMeterAnalyzer = {
    computeTopContacts,
    computeFocusTime,
    computeDietSuggestions,
    meetingsPerDay,
    onlineVsOffline,
    durationDistribution,
    dayOfWeekPattern,
    heatmapData,
    weeklyTrend,
    meetingSizeBreakdown,
    computeSummary,
    getRecentEvents,
  };
})();

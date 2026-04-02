// MeetingMeter — MeetingLoad Score™
(function () {
  function computeScore(events, days) {
    const d = days || 30;
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - d);

    const recent = events.filter(e => {
      const d = new Date(e.start);
      return d >= thirtyDaysAgo && d <= now;
    });

    if (recent.length === 0) {
      return { score: 0, label: 'No Data', color: '#94a3b8', breakdown: {} };
    }

    // Group by date
    const byDate = {};
    recent.forEach(e => {
      const day = e.start.slice(0, 10);
      if (!byDate[day]) byDate[day] = [];
      byDate[day].push(e);
    });

    // Count only weekdays in the period
    let weekdayCount = 0;
    for (let d = new Date(thirtyDaysAgo); d <= now; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) weekdayCount++;
    }
    if (weekdayCount === 0) weekdayCount = 1;

    // Avg meetings per day
    const avgMeetings = recent.length / weekdayCount;
    const meetingsNorm = Math.min(10, (avgMeetings / 8) * 10);

    // Avg hours per day (threshold: 4h = max score)
    const totalMin = recent.reduce((s, e) => s + (e.duration_min || 0), 0);
    const avgHours = (totalMin / 60) / weekdayCount;
    const hoursNorm = Math.min(10, (avgHours / 4) * 10);

    // Back-to-back ratio
    let btbCount = 0;
    Object.values(byDate).forEach(dayEvents => {
      const sorted = dayEvents.slice().sort((a, b) => new Date(a.start) - new Date(b.start));
      for (let i = 0; i < sorted.length - 1; i++) {
        const endCur = new Date(sorted[i].end);
        const startNext = new Date(sorted[i + 1].start);
        const gap = (startNext - endCur) / 60000;
        if (gap < 10) btbCount++;
      }
    });
    const btbRatio = recent.length > 1 ? btbCount / (recent.length - Object.keys(byDate).length) : 0;
    const btbNorm = Math.min(10, Math.max(0, btbRatio * 10));

    // Avg duration penalty
    const avgDuration = totalMin / recent.length;
    let durNorm = 0;
    if (avgDuration > 60) {
      durNorm = Math.min(10, ((avgDuration - 60) / 60) * 10);
    }

    // Weighted score (hours = 45%, meetings = 20%, btb = 20%, duration = 15%)
    let raw = hoursNorm * 0.45 + meetingsNorm * 0.20 + btbNorm * 0.20 + durNorm * 0.15;

    // Floor rule: 6+ hours/day of meetings = minimum score 8
    let score = Math.max(1, Math.min(10, Math.round(raw)));
    if (avgHours >= 6) score = Math.max(score, 8);

    let label, color;
    if (score <= 3) { label = 'Light'; color = '#22c55e'; }
    else if (score <= 6) { label = 'Moderate'; color = '#eab308'; }
    else { label = 'Overloaded'; color = '#ef4444'; }

    return {
      score,
      label,
      color,
      breakdown: {
        avgMeetingsPerDay: Math.round(avgMeetings * 10) / 10,
        avgHoursPerDay: Math.round(avgHours * 10) / 10,
        backToBackRatio: Math.round(btbRatio * 100),
        avgDurationMin: Math.round(avgDuration),
        meetingsNorm: Math.round(meetingsNorm * 10) / 10,
        hoursNorm: Math.round(hoursNorm * 10) / 10,
        btbNorm: Math.round(btbNorm * 10) / 10,
        durNorm: Math.round(durNorm * 10) / 10,
      },
    };
  }

  window.MeetingMeterScore = { computeScore };
})();

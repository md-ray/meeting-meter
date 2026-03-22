// MeetingMeter — Chart.js chart rendering
(function () {
  const ACCENT = '#6366f1';
  const ACCENT_LIGHT = '#818cf8';
  const TEXT_MUTED = '#94a3b8';
  const GRID_COLOR = '#2d3148';

  // Shared defaults
  Chart.defaults.color = TEXT_MUTED;
  Chart.defaults.borderColor = GRID_COLOR;
  Chart.defaults.font.family = "'Segoe UI', system-ui, sans-serif";

  function commonOptions(title) {
    return {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        title: { display: false },
      },
      scales: {
        x: { grid: { color: GRID_COLOR }, ticks: { color: TEXT_MUTED, maxRotation: 45 } },
        y: { grid: { color: GRID_COLOR }, ticks: { color: TEXT_MUTED }, beginAtZero: true },
      },
    };
  }

  // 1. Meetings per day (bar)
  function renderMeetingsPerDay(canvasId, events, days) {
    const { labels, data } = window.MeetingMeterAnalyzer.meetingsPerDay(events, days);
    return new Chart(document.getElementById(canvasId), {
      type: 'bar',
      data: {
        labels,
        datasets: [{ data, backgroundColor: ACCENT, borderRadius: 4 }],
      },
      options: commonOptions(),
    });
  }

  // 2. Online vs Offline (donut)
  function renderOnlineVsOffline(canvasId, events, days) {
    const { online, offline } = window.MeetingMeterAnalyzer.onlineVsOffline(events, days);
    return new Chart(document.getElementById(canvasId), {
      type: 'doughnut',
      data: {
        labels: ['Online', 'In-person'],
        datasets: [{
          data: [online, offline],
          backgroundColor: [ACCENT, '#f59e0b'],
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: true, position: 'bottom', labels: { color: TEXT_MUTED, padding: 16 } },
        },
      },
    });
  }

  // 3. Duration distribution (bar)
  function renderDurationDistribution(canvasId, events, days) {
    const buckets = window.MeetingMeterAnalyzer.durationDistribution(events, days);
    return new Chart(document.getElementById(canvasId), {
      type: 'bar',
      data: {
        labels: Object.keys(buckets),
        datasets: [{ data: Object.values(buckets), backgroundColor: ACCENT_LIGHT, borderRadius: 4 }],
      },
      options: commonOptions(),
    });
  }

  // 4. Day of week pattern (bar)
  function renderDayOfWeek(canvasId, events, days) {
    const { labels, data } = window.MeetingMeterAnalyzer.dayOfWeekPattern(events, days);
    return new Chart(document.getElementById(canvasId), {
      type: 'bar',
      data: {
        labels,
        datasets: [{ data, backgroundColor: ACCENT, borderRadius: 4 }],
      },
      options: commonOptions(),
    });
  }

  // 5. Meeting heatmap (custom canvas)
  function renderHeatmap(canvasId, events, periodDays) {
    const grid = window.MeetingMeterAnalyzer.heatmapData(events, periodDays);
    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext('2d');
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    const cellW = 28;
    const cellH = 28;
    const labelW = 36;
    const labelH = 20;
    canvas.width = labelW + 24 * cellW;
    canvas.height = labelH + 7 * cellH;
    canvas.style.maxWidth = '100%';
    canvas.style.height = 'auto';

    // Find max
    let max = 1;
    grid.forEach(row => row.forEach(v => { if (v > max) max = v; }));

    // Hour labels
    ctx.fillStyle = TEXT_MUTED;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    for (let h = 0; h < 24; h++) {
      ctx.fillText(h, labelW + h * cellW + cellW / 2, labelH - 4);
    }

    // Draw grid
    for (let d = 0; d < 7; d++) {
      // Day label
      ctx.fillStyle = TEXT_MUTED;
      ctx.textAlign = 'right';
      ctx.font = '10px sans-serif';
      ctx.fillText(days[d], labelW - 6, labelH + d * cellH + cellH / 2 + 4);

      for (let h = 0; h < 24; h++) {
        const val = grid[d][h];
        const intensity = val / max;
        const r = Math.round(99 + (99 - 99) * intensity);
        const g = Math.round(102 + (102 - 102) * intensity);
        const b = Math.round(241 * intensity);
        ctx.fillStyle = val === 0 ? '#1e2130' : `rgba(99, 102, 241, ${0.15 + intensity * 0.85})`;
        ctx.fillRect(labelW + h * cellW + 1, labelH + d * cellH + 1, cellW - 2, cellH - 2);

        if (val > 0) {
          ctx.fillStyle = '#fff';
          ctx.textAlign = 'center';
          ctx.font = '9px sans-serif';
          ctx.fillText(val, labelW + h * cellW + cellW / 2, labelH + d * cellH + cellH / 2 + 3);
        }
      }
    }
  }

  // 6. Weekly hours trend (line)
  function renderWeeklyTrend(canvasId, events, days) {
    const weeks = days ? Math.ceil(days / 7) : 12;
    const { labels, data } = window.MeetingMeterAnalyzer.weeklyTrend(events, weeks);
    return new Chart(document.getElementById(canvasId), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data,
          borderColor: ACCENT,
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: ACCENT,
        }],
      },
      options: commonOptions(),
    });
  }

  // 7. Meeting size breakdown (horizontal bar)
  function renderMeetingSize(canvasId, events, days) {
    const sizes = window.MeetingMeterAnalyzer.meetingSizeBreakdown(events, days);
    return new Chart(document.getElementById(canvasId), {
      type: 'bar',
      data: {
        labels: Object.keys(sizes),
        datasets: [{ data: Object.values(sizes), backgroundColor: [ACCENT, ACCENT_LIGHT, '#f59e0b', '#ef4444'], borderRadius: 4 }],
      },
      options: {
        ...commonOptions(),
        indexAxis: 'y',
      },
    });
  }

  window.MeetingMeterCharts = {
    renderMeetingsPerDay,
    renderOnlineVsOffline,
    renderDurationDistribution,
    renderDayOfWeek,
    renderHeatmap,
    renderWeeklyTrend,
    renderMeetingSize,
  };
})();

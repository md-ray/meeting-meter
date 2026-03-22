// MeetingMeter — Shareable PNG Score Card
(function () {
  function buildScoreCard(scoreData, summary) {
    const el = document.getElementById('score-card-render');
    if (!el) return;

    el.innerHTML = `
      <div class="sc-score" style="color: ${scoreData.color}">${scoreData.score}</div>
      <div class="sc-label" style="color: ${scoreData.color}">MeetingLoad: ${scoreData.label}</div>
      <div class="sc-stats">
        <div><strong>${summary.meetingsPerWeek}</strong> meetings/week</div>
        <div><strong>${summary.hoursPerWeek}h</strong> hrs/week</div>
        <div><strong>${summary.topMeetingDay}</strong> busiest day</div>
      </div>
      <div class="sc-tagline">Analyzed by MeetingMeter</div>
      <div class="sc-watermark">meetingmeter.arsitekmembumi.id</div>
    `;
  }

  async function captureScoreCard() {
    const el = document.getElementById('score-card-render');
    if (!el) return null;
    // Temporarily make visible for capture
    el.style.position = 'fixed';
    el.style.left = '0';
    el.style.top = '0';
    el.style.zIndex = '-1';
    const canvas = await html2canvas(el, {
      backgroundColor: '#0f1117',
      scale: 2,
      width: 600,
      height: 400,
    });
    el.style.position = 'absolute';
    el.style.left = '-9999px';
    el.style.top = '-9999px';
    return canvas;
  }

  async function downloadCard() {
    const canvas = await captureScoreCard();
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'my-meetingload-score.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  async function copyCard() {
    const canvas = await captureScoreCard();
    if (!canvas) return;
    try {
      canvas.toBlob(async (blob) => {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        alert('Score card copied to clipboard!');
      });
    } catch (err) {
      console.error('Copy failed:', err);
      alert('Copy failed. Try downloading instead.');
    }
  }

  function getLinkedInCaption(score, hoursPerWeek) {
    const emoji = score <= 3 ? '\uD83D\uDE0E' : score <= 6 ? '\uD83D\uDE05' : '\uD83E\uDD2F';
    return `My MeetingLoad Score this month: ${score}/10 ${emoji}. Turns out I spend ${hoursPerWeek} hrs/week in meetings. Check yours \u2192 meetingmeter.arsitekmembumi.id #MeetingMeter #WorkSmarter`;
  }

  window.MeetingMeterShare = { buildScoreCard, downloadCard, copyCard, getLinkedInCaption };
})();

// MeetingMeter — Microsoft Graph Calendar Client
(function () {
  const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

  async function fetchCalendarEvents(token, startDate, endDate) {
    if (!startDate) {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 90);
    }
    if (!endDate) {
      endDate = new Date();
    }
    const start = startDate.toISOString();
    const end = endDate.toISOString();

    let allEvents = [];
    let url = `${GRAPH_BASE}/me/calendarView?startDateTime=${encodeURIComponent(start)}&endDateTime=${encodeURIComponent(end)}&$top=999&$select=id,subject,start,end,attendees,isOnlineMeeting,recurrence,organizer,location`;

    while (url) {
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error(`Graph API error: ${resp.status}`);
      const data = await resp.json();
      if (data.value) allEvents = allEvents.concat(data.value);
      url = data['@odata.nextLink'] || null;
    }

    return allEvents.map(normalizeGraphEvent);
  }

  function normalizeGraphEvent(ev) {
    const startDt = new Date(ev.start.dateTime + (ev.start.timeZone === 'UTC' ? 'Z' : ''));
    const endDt = new Date(ev.end.dateTime + (ev.end.timeZone === 'UTC' ? 'Z' : ''));
    const durationMin = Math.round((endDt - startDt) / 60000);

    return {
      id: ev.id,
      title: ev.subject || '(No title)',
      start: startDt.toISOString(),
      end: endDt.toISOString(),
      duration_min: durationMin,
      attendees: (ev.attendees || []).map(a => ({
        email: a.emailAddress?.address || '',
        name: a.emailAddress?.name || '',
      })),
      isOnline: !!ev.isOnlineMeeting,
      isRecurring: !!ev.recurrence,
      organizer: ev.organizer?.emailAddress?.address || '',
      location: ev.location?.displayName || '',
    };
  }

  async function fetchAndStore() {
    const token = await window.MeetingMeterAuth.getToken();
    const events = await fetchCalendarEvents(token);
    localStorage.setItem('mm_events', JSON.stringify(events));
    window.location.href = 'dashboard.html';
  }

  window.MeetingMeterGraph = { fetchCalendarEvents, fetchAndStore };
})();

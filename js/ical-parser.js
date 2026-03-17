// MeetingMeter — ICS Parser (uses ical.js)
(function () {
  const ONLINE_PATTERNS = /zoom\.us|teams\.microsoft|meet\.google|webex|\/j\//i;

  function parseICS(text) {
    const jcalData = ICAL.parse(text);
    const comp = new ICAL.Component(jcalData);
    const vevents = comp.getAllSubcomponents('vevent');
    return vevents.map(ve => {
      const event = new ICAL.Event(ve);
      const startDt = event.startDate?.toJSDate();
      const endDt = event.endDate?.toJSDate();
      if (!startDt || !endDt) return null;

      const durationMin = Math.round((endDt - startDt) / 60000);
      const location = ve.getFirstPropertyValue('location') || '';
      const description = ve.getFirstPropertyValue('description') || '';
      const rrule = ve.getFirstPropertyValue('rrule');
      const attendees = ve.getAllProperties('attendee').map(a => {
        const cn = a.getParameter('cn') || '';
        const val = a.getFirstValue() || '';
        const email = val.replace(/^mailto:/i, '');
        return { email, name: cn || email };
      });
      const organizer = ve.getFirstPropertyValue('organizer');
      const orgEmail = organizer ? organizer.replace(/^mailto:/i, '') : '';

      return {
        id: event.uid || crypto.randomUUID(),
        title: event.summary || '(No title)',
        start: startDt.toISOString(),
        end: endDt.toISOString(),
        duration_min: durationMin,
        attendees,
        isOnline: ONLINE_PATTERNS.test(location) || ONLINE_PATTERNS.test(description),
        isRecurring: !!rrule,
        organizer: orgEmail,
        location,
      };
    }).filter(Boolean);
  }

  function parseMultipleFiles(fileList) {
    return new Promise((resolve, reject) => {
      const allEvents = [];
      const seen = new Set();
      let pending = fileList.length;
      if (pending === 0) return resolve([]);

      Array.from(fileList).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const events = parseICS(e.target.result);
            events.forEach(ev => {
              if (!seen.has(ev.id)) {
                seen.add(ev.id);
                allEvents.push(ev);
              }
            });
          } catch (err) {
            console.error('Failed to parse ICS file:', file.name, err);
          }
          pending--;
          if (pending === 0) resolve(allEvents);
        };
        reader.onerror = () => {
          pending--;
          if (pending === 0) resolve(allEvents);
        };
        reader.readAsText(file);
      });
    });
  }

  async function parseAndStore(fileList) {
    const events = await parseMultipleFiles(fileList);
    if (events.length === 0) {
      alert('No events found in the uploaded file(s). Please check your ICS files.');
      return;
    }
    localStorage.setItem('mm_events', JSON.stringify(events));
    window.location.href = 'dashboard.html';
  }

  window.MeetingMeterICS = { parseICS, parseMultipleFiles, parseAndStore };
})();

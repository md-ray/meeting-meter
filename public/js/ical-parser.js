// MeetingMeter — ICS Parser with RRULE expansion (uses ical.js)
(function () {
  const ONLINE_PATTERNS = /zoom\.us|teams\.microsoft|meet\.google|webex|\/j\//i;

  // Default analysis window: last 90 days
  function getDateRange() {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 90);
    return { start, end };
  }

  function parseICS(text) {
    const jcalData = ICAL.parse(text);
    const comp = new ICAL.Component(jcalData);
    const vevents = comp.getAllSubcomponents('vevent');
    const { start: rangeStart, end: rangeEnd } = getDateRange();
    const allEvents = [];

    for (const ve of vevents) {
      const event = new ICAL.Event(ve);
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
      const isOnline = ONLINE_PATTERNS.test(location) || ONLINE_PATTERNS.test(description);
      const isRecurring = !!rrule;
      const baseUid = event.uid || crypto.randomUUID();

      if (isRecurring && event.startDate) {
        // Expand recurring events within the analysis window
        try {
          const iter = event.iterator();
          const maxIter = 500;
          const durationMs = event.duration ? event.duration.toSeconds() * 1000 : 
                            (event.endDate && event.startDate ? 
                              (event.endDate.toJSDate() - event.startDate.toJSDate()) : 3600000);

          for (let i = 0; i < maxIter; i++) {
            let next;
            try { next = iter.next(); } catch (e) { break; }
            if (!next) break;

            const occStart = next.toJSDate();

            // Skip events before our range
            if (occStart < rangeStart) continue;
            // Stop once we pass the end of our range
            if (occStart > rangeEnd) break;

            const occEnd = new Date(occStart.getTime() + durationMs);

            allEvents.push({
              id: baseUid + '_' + occStart.toISOString(),
              title: event.summary || '(No title)',
              start: occStart.toISOString(),
              end: occEnd.toISOString(),
              duration_min: Math.round(durationMs / 60000),
              attendees,
              isOnline,
              isRecurring: true,
              organizer: orgEmail,
              location,
            });
          }
        } catch (err) {
          // If expansion fails, fall back to single instance
          console.warn('RRULE expansion failed for', event.summary, err);
          const startDt = event.startDate?.toJSDate();
          const endDt = event.endDate?.toJSDate();
          if (startDt && endDt) {
            allEvents.push(makeEvent(baseUid, event, startDt, endDt, attendees, isOnline, isRecurring, orgEmail, location));
          }
        }
      } else {
        // Non-recurring event
        const startDt = event.startDate?.toJSDate();
        const endDt = event.endDate?.toJSDate();
        if (startDt && endDt) {
          allEvents.push(makeEvent(baseUid, event, startDt, endDt, attendees, isOnline, isRecurring, orgEmail, location));
        }
      }
    }

    return allEvents;
  }

  function makeEvent(uid, event, startDt, endDt, attendees, isOnline, isRecurring, orgEmail, location) {
    return {
      id: uid,
      title: event.summary || '(No title)',
      start: startDt.toISOString(),
      end: endDt.toISOString(),
      duration_min: Math.round((endDt - startDt) / 60000),
      attendees,
      isOnline,
      isRecurring,
      organizer: orgEmail,
      location,
    };
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


import { CalendarEvent } from '../types';

const SCHEDULE_KEY = 'transcriber_pro_calendar_v2';

/**
 * Robust date parser for ICS formats.
 * Handles: 20250123T101000, 20250123T101000Z, 20250123
 */
const parseIcsDate = (dateStr: string): Date => {
  if (!dateStr || dateStr.length < 8) return new Date();

  const year = parseInt(dateStr.substring(0, 4));
  const month = parseInt(dateStr.substring(4, 6)) - 1;
  const day = parseInt(dateStr.substring(6, 8));

  if (dateStr.includes('T')) {
    const timePart = dateStr.split('T')[1].replace('Z', '');
    const hour = parseInt(timePart.substring(0, 2)) || 0;
    const minute = parseInt(timePart.substring(2, 4)) || 0;
    const second = parseInt(timePart.substring(4, 6)) || 0;
    return new Date(year, month, day, hour, minute, second);
  }
  
  // Date-only format (start of day)
  return new Date(year, month, day, 0, 0, 0);
};

/**
 * Main parser for .ics file content.
 * Implements line unfolding and robust regex for properties with parameters (like TZID).
 */
export const parseICS = (icsData: string): CalendarEvent[] => {
  const events: CalendarEvent[] = [];
  
  // Unfold lines (RFC 5545: lines starting with space are continuations)
  const unfoldedData = icsData.replace(/\r?\n[ \t]/g, '');
  
  const veventBlocks = unfoldedData.split('BEGIN:VEVENT');
  veventBlocks.shift(); // Remove header stuff

  const now = new Date();
  const expansionLimit = new Date();
  expansionLimit.setDate(now.getDate() + 60); // Limit to 60 days of future schedule

  veventBlocks.forEach((block, blockIdx) => {
    // Regex that handles parameters: e.g. DTSTART;TZID=Asia/Kolkata:20250123T101000
    const summaryMatch = block.match(/SUMMARY(?:;[^:]*)?:(.*)/);
    const dtStartMatch = block.match(/DTSTART(?:;[^:]*)?:(\d{8}T\d{6}Z?|\d{8})/);
    const dtEndMatch = block.match(/DTEND(?:;[^:]*)?:(\d{8}T\d{6}Z?|\d{8})/);
    const rruleMatch = block.match(/RRULE(?:;[^:]*)?:(.*)/);
    const locationMatch = block.match(/LOCATION(?:;[^:]*)?:(.*)/);

    if (summaryMatch && dtStartMatch) {
      const title = summaryMatch[1].trim();
      const location = locationMatch ? locationMatch[1].trim() : 'No location';
      const startBase = parseIcsDate(dtStartMatch[1]);
      
      let duration = 60 * 60 * 1000; // Default 1hr
      if (dtEndMatch) {
        const endBase = parseIcsDate(dtEndMatch[1]);
        duration = endBase.getTime() - startBase.getTime();
      }
      
      const rrule = rruleMatch ? rruleMatch[1].trim() : null;

      const addOccurrence = (occStart: Date, idx: number) => {
        const occEnd = new Date(occStart.getTime() + duration);
        
        // Filter: Keep if the meeting hasn't ended yet
        if (occEnd < now) return;

        events.push({
          id: `ics-${blockIdx}-${idx}-${occStart.getTime()}`,
          title,
          startTime: `${occStart.getHours().toString().padStart(2, '0')}:${occStart.getMinutes().toString().padStart(2, '0')}`,
          endTime: `${occEnd.getHours().toString().padStart(2, '0')}:${occEnd.getMinutes().toString().padStart(2, '0')}`,
          date: occStart.toISOString().split('T')[0],
          days: [occStart.getDay()],
          location,
          isExternal: true
        });
      };

      if (!rrule) {
        addOccurrence(startBase, 0);
      } else {
        const freqMatch = rrule.match(/FREQ=([^;]+)/i);
        const countMatch = rrule.match(/COUNT=(\d+)/i);
        const untilMatch = rrule.match(/UNTIL=(\d{8}T\d{6}Z?|\d{8})/i);
        const intervalMatch = rrule.match(/INTERVAL=(\d+)/i);

        const freq = freqMatch ? freqMatch[1].toUpperCase() : 'WEEKLY';
        const count = countMatch ? parseInt(countMatch[1]) : Infinity;
        const until = untilMatch ? parseIcsDate(untilMatch[1]) : expansionLimit;
        const interval = intervalMatch ? parseInt(intervalMatch[1]) : 1;

        let currentStart = new Date(startBase.getTime());
        let iterations = 0;

        while (iterations < count && currentStart <= until && currentStart <= expansionLimit) {
          addOccurrence(new Date(currentStart.getTime()), iterations);

          if (freq === 'DAILY') {
            currentStart.setDate(currentStart.getDate() + interval);
          } else if (freq === 'WEEKLY') {
            currentStart.setDate(currentStart.getDate() + (7 * interval));
          } else if (freq === 'MONTHLY') {
            currentStart.setMonth(currentStart.getMonth() + interval);
          } else if (freq === 'YEARLY') {
            currentStart.setFullYear(currentStart.getFullYear() + interval);
          } else {
            break;
          }
          
          iterations++;
          // Safety break to prevent infinite loops on malformed RRULEs
          if (iterations > 500) break;
        }
      }
    }
  });

  return events.sort((a, b) => {
    if (a.date !== b.date) return (a.date || '').localeCompare(b.date || '');
    return a.startTime.localeCompare(b.startTime);
  });
};

export const filterUpcomingEvents = (schedule: CalendarEvent[]): CalendarEvent[] => {
  const now = new Date();
  return schedule.filter(event => {
    if (!event.date) return true;
    const [endH, endM] = event.endTime.split(':').map(Number);
    const [y, m, d] = event.date.split('-').map(Number);
    const eventEnd = new Date(y, m - 1, d, endH, endM);
    return eventEnd >= now;
  });
};

export const getStoredSchedule = (): CalendarEvent[] => {
  const stored = localStorage.getItem(SCHEDULE_KEY);
  if (stored) {
    try {
      return filterUpcomingEvents(JSON.parse(stored));
    } catch (e) {
      return [];
    }
  }
  return [];
};

export const findActiveEvent = (schedule: CalendarEvent[]): CalendarEvent | null => {
  const now = new Date();
  const todayIso = now.toISOString().split('T')[0];
  const currentTimeMins = now.getHours() * 60 + now.getMinutes();

  return schedule.find(event => {
    if (event.date !== todayIso) return false;
    const [startH, startM] = event.startTime.split(':').map(Number);
    const [endH, endM] = event.endTime.split(':').map(Number);
    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;
    // occurrenceStart <= now <= occurrenceEnd
    return currentTimeMins >= startMins && currentTimeMins <= endMins;
  }) || null;
};

export const saveSchedule = (schedule: CalendarEvent[]) => {
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule));
};

import { google } from 'googleapis';
import { getGoogleAuth } from './auth';

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'primary';

/**
 * Získání Google Calendar API klienta
 */
export function getCalendarClient() {
  const auth = getGoogleAuth();
  return google.calendar({ version: 'v3', auth });
}

/**
 * Načtení událostí z Google Calendar
 */
export async function fetchCalendarEvents(
  timeMin?: Date,
  timeMax?: Date,
  maxResults: number = 100
) {
  const calendar = getCalendarClient();

  try {
    const response = await calendar.events.list({
      calendarId: CALENDAR_ID,
      timeMin: timeMin?.toISOString() || new Date().toISOString(),
      timeMax: timeMax?.toISOString(),
      maxResults,
      singleEvents: true,
      orderBy: 'startTime',
    });

    return response.data.items || [];
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    throw new Error('Failed to fetch calendar events');
  }
}

/**
 * Získání jedné události podle ID
 */
export async function getCalendarEvent(eventId: string) {
  const calendar = getCalendarClient();

  try {
    const response = await calendar.events.get({
      calendarId: CALENDAR_ID,
      eventId,
    });

    return response.data;
  } catch (error) {
    console.error('Error fetching calendar event:', error);
    throw new Error('Failed to fetch calendar event');
  }
}

/**
 * Přidání attendee (technika) k události
 */
export async function addAttendeeToEvent(
  eventId: string,
  attendeeEmail: string,
  attendeeName?: string
) {
  const calendar = getCalendarClient();

  try {
    // Nejdřív získáme aktuální event
    const event = await calendar.events.get({
      calendarId: CALENDAR_ID,
      eventId,
    });

    // Přidáme nového attendee
    const attendees = event.data.attendees || [];

    // Zkontrolujeme, jestli už není přidaný
    const alreadyExists = attendees.some(a => a.email === attendeeEmail);
    if (alreadyExists) {
      console.log(`Attendee ${attendeeEmail} already exists in event ${eventId}`);
      return event.data;
    }

    attendees.push({
      email: attendeeEmail,
      displayName: attendeeName,
      responseStatus: 'needsAction',
    });

    // Aktualizujeme event
    const response = await calendar.events.update({
      calendarId: CALENDAR_ID,
      eventId,
      sendUpdates: 'all', // Pošle email notifikaci
      requestBody: {
        ...event.data,
        attendees,
      },
    });

    return response.data;
  } catch (error: any) {
    console.error('Error adding attendee to event:', error);
    console.error('Error details:', {
      message: error?.message,
      response: error?.response?.data,
      status: error?.response?.status,
    });
    throw new Error(`Failed to add attendee: ${error?.message || 'Unknown error'}`);
  }
}

/**
 * Odebrání attendee z události
 */
export async function removeAttendeeFromEvent(
  eventId: string,
  attendeeEmail: string
) {
  const calendar = getCalendarClient();

  try {
    const event = await calendar.events.get({
      calendarId: CALENDAR_ID,
      eventId,
    });

    const attendees = (event.data.attendees || []).filter(
      a => a.email !== attendeeEmail
    );

    const response = await calendar.events.update({
      calendarId: CALENDAR_ID,
      eventId,
      sendUpdates: 'all',
      requestBody: {
        ...event.data,
        attendees,
      },
    });

    return response.data;
  } catch (error) {
    console.error('Error removing attendee from event:', error);
    throw new Error('Failed to remove attendee from event');
  }
}

/**
 * Získání statusů všech attendees pro danou událost
 */
export async function getAttendeeStatuses(eventId: string) {
  const calendar = getCalendarClient();

  try {
    const event = await calendar.events.get({
      calendarId: CALENDAR_ID,
      eventId,
    });

    return (event.data.attendees || []).map(attendee => ({
      email: attendee.email!,
      displayName: attendee.displayName,
      responseStatus: attendee.responseStatus as 'accepted' | 'declined' | 'tentative' | 'needsAction',
      comment: attendee.comment,
    }));
  } catch (error) {
    console.error('Error getting attendee statuses:', error);
    throw new Error('Failed to get attendee statuses');
  }
}

/**
 * Vytvoření nové události v kalendáři (pokud by bylo potřeba)
 */
export async function createCalendarEvent(
  summary: string,
  startTime: Date,
  endTime: Date,
  description?: string,
  location?: string
) {
  const calendar = getCalendarClient();

  try {
    const response = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: {
        summary,
        description,
        location,
        start: {
          dateTime: startTime.toISOString(),
        },
        end: {
          dateTime: endTime.toISOString(),
        },
      },
    });

    return response.data;
  } catch (error) {
    console.error('Error creating calendar event:', error);
    throw new Error('Failed to create calendar event');
  }
}

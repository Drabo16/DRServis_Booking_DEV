import { google } from 'googleapis';
import { getGoogleAuth } from './auth';
import { env } from '@/lib/env';

const CALENDAR_ID = env.GOOGLE_CALENDAR_ID;

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
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const response = (error as Record<string, unknown>)?.response as Record<string, unknown> | undefined;
    console.error('Error adding attendee to event:', error);
    console.error('Error details:', {
      message,
      response: response?.data,
      status: response?.status,
    });
    throw new Error(`Failed to add attendee: ${message}`);
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

// MIME types for Google Docs/Sheets and MS Office equivalents that should be attached
const ATTACHABLE_MIME_TYPES: Record<string, { icon: string }> = {
  'application/vnd.google-apps.document': { icon: 'https://drive-thirdparty.googleusercontent.com/16/type/application/vnd.google-apps.document' },
  'application/vnd.google-apps.spreadsheet': { icon: 'https://drive-thirdparty.googleusercontent.com/16/type/application/vnd.google-apps.spreadsheet' },
  'application/vnd.google-apps.presentation': { icon: 'https://drive-thirdparty.googleusercontent.com/16/type/application/vnd.google-apps.presentation' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { icon: 'https://drive-thirdparty.googleusercontent.com/16/type/application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { icon: 'https://drive-thirdparty.googleusercontent.com/16/type/application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { icon: 'https://drive-thirdparty.googleusercontent.com/16/type/application/vnd.openxmlformats-officedocument.presentationml.presentation' },
  'application/msword': { icon: 'https://drive-thirdparty.googleusercontent.com/16/type/application/msword' },
  'application/vnd.ms-excel': { icon: 'https://drive-thirdparty.googleusercontent.com/16/type/application/vnd.ms-excel' },
  'application/pdf': { icon: 'https://drive-thirdparty.googleusercontent.com/16/type/application/pdf' },
};

/**
 * Připojení Drive složky A jejích souborů k události v kalendáři jako přílohy
 * Přidává jak složku, tak jednotlivé dokumenty (Google Docs, Sheets, PDF, Office soubory)
 */
export async function attachDriveFolderToEvent(
  eventId: string,
  driveFolderUrl: string,
  driveFolderId: string,
  driveFolderName?: string,
  folderFiles?: Array<{ id: string; name: string; mimeType: string; webViewLink: string }>
) {
  const calendar = getCalendarClient();

  try {
    // Získáme aktuální event
    const event = await calendar.events.get({
      calendarId: CALENDAR_ID,
      eventId,
    });

    const existingAttachments = event.data.attachments || [];
    const newAttachments: Array<{
      fileUrl: string;
      title: string;
      mimeType: string;
      iconLink: string;
      fileId: string;
    }> = [];

    // 1. Přidáme Drive složku jako hlavní přílohu (pokud ještě není)
    const folderAlreadyAttached = existingAttachments.some(
      (att) => att.fileId === driveFolderId || att.fileUrl === driveFolderUrl
    );

    if (!folderAlreadyAttached) {
      newAttachments.push({
        fileUrl: driveFolderUrl,
        title: driveFolderName || 'Podklady akce',
        mimeType: 'application/vnd.google-apps.folder',
        iconLink: 'https://drive-thirdparty.googleusercontent.com/16/type/application/vnd.google-apps.folder',
        fileId: driveFolderId,
      });
    }

    // 2. Přidáme jednotlivé dokumenty ze složky
    if (folderFiles && folderFiles.length > 0) {
      for (const file of folderFiles) {
        // Zkontrolujeme, jestli je to podporovaný typ souboru
        const mimeConfig = ATTACHABLE_MIME_TYPES[file.mimeType];
        if (!mimeConfig) continue;

        // Zkontrolujeme, jestli už není přidaný
        const fileAlreadyAttached = existingAttachments.some(
          (att) => att.fileId === file.id
        );
        if (fileAlreadyAttached) continue;

        newAttachments.push({
          fileUrl: file.webViewLink,
          title: file.name,
          mimeType: file.mimeType,
          iconLink: mimeConfig.icon,
          fileId: file.id,
        });
      }
    }

    // Pokud nejsou žádné nové přílohy, vrátíme stávající event
    if (newAttachments.length === 0) {
      return { event: event.data, attachedCount: 0 };
    }

    // Aktualizujeme event s novými přílohami
    const response = await calendar.events.patch({
      calendarId: CALENDAR_ID,
      eventId,
      supportsAttachments: true,
      requestBody: {
        attachments: [...existingAttachments, ...newAttachments],
      },
    });

    return { event: response.data, attachedCount: newAttachments.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const response = (error as Record<string, unknown>)?.response as Record<string, unknown> | undefined;
    console.error('Error attaching Drive folder to event:', error);
    console.error('Error details:', {
      message,
      response: response?.data,
      status: response?.status,
    });
    throw new Error(`Failed to attach Drive folder: ${message}`);
  }
}

/**
 * Odebrání Drive složky z přílohy události v kalendáři
 */
export async function removeDriveFolderFromEvent(
  eventId: string,
  driveFolderId: string
) {
  const calendar = getCalendarClient();

  try {
    // Získáme aktuální event
    const event = await calendar.events.get({
      calendarId: CALENDAR_ID,
      eventId,
    });

    const existingAttachments = event.data.attachments || [];

    // Najdeme a odstraníme přílohu - kontrolujeme fileId i fileUrl (obsahuje folder ID)
    const newAttachments = existingAttachments.filter((att) => {
      const matchesFileId = att.fileId === driveFolderId;
      const matchesFileUrl = att.fileUrl?.includes(driveFolderId);
      const shouldRemove = matchesFileId || matchesFileUrl;

      return !shouldRemove;
    });

    // Pokud se nic nezměnilo, nic neděláme
    if (newAttachments.length === existingAttachments.length) {
      return event.data;
    }

    // Aktualizujeme event bez přílohy
    const response = await calendar.events.patch({
      calendarId: CALENDAR_ID,
      eventId,
      supportsAttachments: true,
      requestBody: {
        attachments: newAttachments,
      },
    });

    return response.data;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const response = (error as Record<string, unknown>)?.response as Record<string, unknown> | undefined;
    console.error('[Calendar] Error removing Drive folder from event:', error);
    console.error('[Calendar] Error details:', {
      message,
      response: response?.data,
      status: response?.status,
    });
    // Pokud event neexistuje nebo jiná chyba, jen logujeme
    if (response?.status === 404) {
      return null;
    }
    throw new Error(`Failed to remove Drive folder attachment: ${message}`);
  }
}

/**
 * Aktualizace popisu události s informacemi o technicích
 */
export async function updateEventDescription(
  eventId: string,
  techniciansInfo: Array<{ name: string; role: string; status: string }>
) {
  const calendar = getCalendarClient();

  try {
    const event = await calendar.events.get({
      calendarId: CALENDAR_ID,
      eventId,
    });

    let description = event.data.description || '';

    // Odstraníme starou sekci s techniky (pokud existuje)
    const techSectionRegex = /\n\n👥 Přiřazení technici:[\s\S]*?(?=\n\n📁|$)/;
    description = description.replace(techSectionRegex, '');

    // Přidáme novou sekci s techniky (před Drive link, pokud existuje)
    if (techniciansInfo.length > 0) {
      let techSection = '\n\n👥 Přiřazení technici:';
      techniciansInfo.forEach(tech => {
        const statusIcon = tech.status === 'Potvrzeno' ? '✅' : tech.status === 'Odmítnuto' ? '❌' : '⏳';
        techSection += `\n${statusIcon} ${tech.name} - ${tech.role}`;
      });

      // Vložíme před Drive sekci nebo na konec
      const driveIndex = description.indexOf('\n\n📁');
      if (driveIndex !== -1) {
        description = description.slice(0, driveIndex) + techSection + description.slice(driveIndex);
      } else {
        description += techSection;
      }
    }

    const response = await calendar.events.update({
      calendarId: CALENDAR_ID,
      eventId,
      requestBody: {
        ...event.data,
        description,
      },
    });

    return response.data;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error updating event description:', error);
    throw new Error(`Failed to update event description: ${message}`);
  }
}

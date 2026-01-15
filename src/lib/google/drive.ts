import { google } from 'googleapis';
import { getGoogleAuth } from './auth';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';

const PARENT_FOLDER_ID = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID || 'root';

/**
 * Získání Google Drive API klienta
 */
export function getDriveClient() {
  const auth = getGoogleAuth();
  return google.drive({ version: 'v3', auth });
}

/**
 * Vytvoření složky na Google Drive
 */
export async function createFolder(folderName: string, parentFolderId?: string) {
  const drive = getDriveClient();

  try {
    const response = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId || PARENT_FOLDER_ID],
      },
      fields: 'id, name, webViewLink',
    });

    return {
      id: response.data.id!,
      name: response.data.name!,
      webViewLink: response.data.webViewLink!,
    };
  } catch (error) {
    console.error('Error creating folder:', error);
    throw new Error('Failed to create folder on Google Drive');
  }
}

/**
 * Vyhledání složky podle názvu v daném rodiči
 */
export async function findFolderByName(folderName: string, parentFolderId?: string) {
  const drive = getDriveClient();
  const parent = parentFolderId || PARENT_FOLDER_ID;

  try {
    const response = await drive.files.list({
      q: `name='${folderName}' and '${parent}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name, webViewLink)',
    });

    return response.data.files?.[0] || null;
  } catch (error) {
    console.error('Error finding folder:', error);
    return null;
  }
}

/**
 * Získání nebo vytvoření měsíční složky
 * Formát: 01, 02, ... 12
 */
export async function getOrCreateMonthFolder(eventDate: Date) {
  const monthNum = format(eventDate, 'MM'); // 01-12
  const year = format(eventDate, 'yyyy');
  const monthFolderName = `${year}-${monthNum}`;

  // Zkusíme najít existující složku
  const existingFolder = await findFolderByName(monthFolderName);

  if (existingFolder) {
    return {
      id: existingFolder.id!,
      name: existingFolder.name!,
      webViewLink: existingFolder.webViewLink!,
    };
  }

  // Vytvoříme novou měsíční složku
  return await createFolder(monthFolderName);
}

/**
 * Vytvoření info.txt souboru v složce akce
 */
export async function createInfoFile(
  folderId: string,
  eventData: {
    title: string;
    startTime: Date;
    endTime?: Date;
    location?: string;
    description?: string;
    confirmedTechnicians?: Array<{ name: string; role: string; status: string }>;
  }
) {
  const drive = getDriveClient();

  const startFormatted = format(eventData.startTime, 'd. MMMM yyyy HH:mm', { locale: cs });
  const endFormatted = eventData.endTime
    ? format(eventData.endTime, 'd. MMMM yyyy HH:mm', { locale: cs })
    : 'Neuvedeno';

  let content = `===========================================
INFO O AKCI
===========================================

Název: ${eventData.title}
Datum od: ${startFormatted}
Datum do: ${endFormatted}
Místo: ${eventData.location || 'Neuvedeno'}

-------------------------------------------
POPIS
-------------------------------------------
${eventData.description || 'Bez popisu'}

-------------------------------------------
POTVRZENÍ ÚČASTNÍCI / ROLE
-------------------------------------------
`;

  if (eventData.confirmedTechnicians && eventData.confirmedTechnicians.length > 0) {
    eventData.confirmedTechnicians.forEach((tech, index) => {
      content += `${index + 1}. ${tech.name} - ${tech.role} (${tech.status})\n`;
    });
  } else {
    content += 'Zatím žádní potvrzení účastníci.\n';
  }

  content += `
-------------------------------------------
Vygenerováno: ${format(new Date(), 'd. MMMM yyyy HH:mm:ss', { locale: cs })}
`;

  try {
    const response = await drive.files.create({
      requestBody: {
        name: 'info_akce.txt',
        mimeType: 'text/plain',
        parents: [folderId],
      },
      media: {
        mimeType: 'text/plain',
        body: content,
      },
      fields: 'id, name, webViewLink',
    });

    return {
      id: response.data.id!,
      name: response.data.name!,
      webViewLink: response.data.webViewLink!,
    };
  } catch (error) {
    console.error('Error creating info file:', error);
    throw new Error('Failed to create info file');
  }
}

/**
 * Aktualizace info.txt souboru
 */
export async function updateInfoFile(
  folderId: string,
  eventData: {
    title: string;
    startTime: Date;
    endTime?: Date;
    location?: string;
    description?: string;
    confirmedTechnicians?: Array<{ name: string; role: string; status: string }>;
  }
) {
  const drive = getDriveClient();

  try {
    // Najdeme existující info soubor
    const response = await drive.files.list({
      q: `name='info_akce.txt' and '${folderId}' in parents and trashed=false`,
      fields: 'files(id)',
    });

    const existingFile = response.data.files?.[0];

    if (existingFile) {
      // Smažeme starý soubor
      await drive.files.delete({ fileId: existingFile.id! });
    }

    // Vytvoříme nový
    return await createInfoFile(folderId, eventData);
  } catch (error) {
    console.error('Error updating info file:', error);
    // Pokud selže update, zkusíme vytvořit nový
    return await createInfoFile(folderId, eventData);
  }
}

/**
 * Vytvoření struktury složek pro akci
 * V2: Složky jsou organizovány do měsíčních podložek
 * Struktura: Parent / YYYY-MM / YYYY-MM-DD - Název akce / [Podklady, Foto, Video, Dokumenty]
 */
export async function createEventFolderStructure(
  eventTitle: string,
  eventDate: Date,
  eventData?: {
    endTime?: Date;
    location?: string;
    description?: string;
    confirmedTechnicians?: Array<{ name: string; role: string; status: string }>;
  }
) {
  try {
    // Získáme nebo vytvoříme měsíční složku
    const monthFolder = await getOrCreateMonthFolder(eventDate);

    const dateStr = eventDate.toISOString().split('T')[0]; // YYYY-MM-DD
    const mainFolderName = `${dateStr} - ${eventTitle}`;

    // Vytvoříme hlavní složku akce v měsíční složce
    const mainFolder = await createFolder(mainFolderName, monthFolder.id);

    // Vytvoříme podsložky
    const subfolders = ['Podklady', 'Foto', 'Video', 'Dokumenty'];
    const subfolderPromises = subfolders.map(name =>
      createFolder(name, mainFolder.id)
    );

    await Promise.all(subfolderPromises);

    // Vytvoříme info soubor
    await createInfoFile(mainFolder.id, {
      title: eventTitle,
      startTime: eventDate,
      endTime: eventData?.endTime,
      location: eventData?.location,
      description: eventData?.description,
      confirmedTechnicians: eventData?.confirmedTechnicians,
    });

    return {
      folderId: mainFolder.id,
      folderUrl: mainFolder.webViewLink,
      folderName: mainFolder.name,
      monthFolderId: monthFolder.id,
    };
  } catch (error) {
    console.error('Error creating event folder structure:', error);
    throw new Error('Failed to create event folder structure');
  }
}

/**
 * Získání informací o složce
 */
export async function getFolderInfo(folderId: string) {
  const drive = getDriveClient();

  try {
    const response = await drive.files.get({
      fileId: folderId,
      fields: 'id, name, webViewLink, createdTime, modifiedTime',
    });

    return response.data;
  } catch (error) {
    console.error('Error getting folder info:', error);
    throw new Error('Failed to get folder info');
  }
}

/**
 * Seznam souborů ve složce
 */
export async function listFilesInFolder(folderId: string) {
  const drive = getDriveClient();

  try {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id, name, mimeType, webViewLink, createdTime, size)',
      orderBy: 'createdTime desc',
    });

    return response.data.files || [];
  } catch (error) {
    console.error('Error listing files in folder:', error);
    throw new Error('Failed to list files in folder');
  }
}

/**
 * Nastavení oprávnění pro složku (např. sdílení s týmem)
 */
export async function shareFolderWithEmail(
  folderId: string,
  email: string,
  role: 'reader' | 'writer' | 'commenter' = 'reader'
) {
  const drive = getDriveClient();

  try {
    const response = await drive.permissions.create({
      fileId: folderId,
      requestBody: {
        type: 'user',
        role,
        emailAddress: email,
      },
      sendNotificationEmail: true,
    });

    return response.data;
  } catch (error) {
    console.error('Error sharing folder:', error);
    throw new Error('Failed to share folder');
  }
}

/**
 * Nastavení složky jako veřejně viditelné (anyone with link can view)
 */
export async function makeFolderPublic(folderId: string) {
  const drive = getDriveClient();

  try {
    const response = await drive.permissions.create({
      fileId: folderId,
      requestBody: {
        type: 'anyone',
        role: 'reader',
      },
    });

    return response.data;
  } catch (error) {
    console.error('Error making folder public:', error);
    throw new Error('Failed to make folder public');
  }
}

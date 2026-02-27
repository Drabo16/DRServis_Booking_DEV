import { google } from 'googleapis';
import { getGoogleAuth } from './auth';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import { env } from '@/lib/env';

const PARENT_FOLDER_ID = env.GOOGLE_DRIVE_PARENT_FOLDER_ID;

/** Escape single quotes for Google Drive API query strings */
function escapeDriveQuery(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Získání Google Drive API klienta
 */
export function getDriveClient() {
  const auth = getGoogleAuth();
  return google.drive({ version: 'v3', auth });
}

/**
 * Vytvoření složky na Google Drive
 * Podporuje Shared Drives pomocí supportsAllDrives
 * Automaticky nastaví oprávnění "Anyone with the link can view"
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
      supportsAllDrives: true,
    });

    const folderId = response.data.id!;

    // Nastavit oprávnění "Anyone with the link can view"
    try {
      await drive.permissions.create({
        fileId: folderId,
        supportsAllDrives: true,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });
    } catch (permError) {
      // Na Shared Drive může být omezení na sdílení - to je ok
      console.warn(`[Drive] Could not set public permission (may be Shared Drive restriction): ${permError instanceof Error ? permError.message : permError}`);
    }

    return {
      id: folderId,
      name: response.data.name!,
      webViewLink: response.data.webViewLink!,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error creating folder:', message);
    throw new Error(`Failed to create folder on Google Drive: ${message}`);
  }
}

/**
 * Vyhledání složky podle názvu v daném rodiči
 * Podporuje Shared Drives
 */
export async function findFolderByName(folderName: string, parentFolderId?: string) {
  const drive = getDriveClient();
  const parent = parentFolderId || PARENT_FOLDER_ID;

  try {
    const response = await drive.files.list({
      q: `name='${escapeDriveQuery(folderName)}' and '${escapeDriveQuery(parent)}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name, webViewLink)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
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
        name: 'info_akce',
        mimeType: 'application/vnd.google-apps.document',
        parents: [folderId],
      },
      fields: 'id, name, webViewLink',
      supportsAllDrives: true,
    });

    const docId = response.data.id!;

    // Zapíšeme obsah pomocí Google Docs API
    try {
      const { google } = require('googleapis');
      const docs = google.docs({ version: 'v1', auth: getGoogleAuth() });

      await docs.documents.batchUpdate({
        documentId: docId,
        requestBody: {
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: content,
              },
            },
          ],
        },
      });
    } catch (docsError) {
      console.warn('[Drive] Could not write content to doc:', docsError instanceof Error ? docsError.message : docsError);
      // Doc je vytvořený, jen bez obsahu - to je OK
    }

    // Nastavíme veřejný přístup k souboru
    try {
      await drive.permissions.create({
        fileId: response.data.id!,
        supportsAllDrives: true,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });
    } catch (permError) {
      console.warn('[Drive] Could not set public permission for info file:', permError instanceof Error ? permError.message : permError);
    }

    return {
      id: response.data.id!,
      name: response.data.name!,
      webViewLink: response.data.webViewLink!,
    };
  } catch (error) {
    const errObj = error as Record<string, unknown>;
    const message = error instanceof Error ? error.message : 'Unknown error';
    const response = errObj?.response as Record<string, unknown> | undefined;
    console.error('[Drive] Error creating info file:', {
      message,
      code: errObj?.code,
      status: response?.status,
      statusText: response?.statusText,
      data: JSON.stringify(response?.data),
      errors: errObj?.errors,
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw new Error(`Failed to create info file: ${message}`);
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
      q: `name='info_akce' and '${escapeDriveQuery(folderId)}' in parents and trashed=false`,
      fields: 'files(id)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const existingFile = response.data.files?.[0];

    if (existingFile) {
      // Smažeme starý soubor
      await drive.files.delete({ fileId: existingFile.id!, supportsAllDrives: true });
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
 * V3: Jednoduchá struktura - pouze složka s info.txt (bez podsložek)
 * Struktura: Parent / YYYY-MM / YYYY-MM-DD - Název akce / info_akce.txt
 */
export async function createEventFolderStructure(
  eventTitle: string,
  eventDate: Date,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _eventData?: {
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

    // INFO SOUBOR DEAKTIVOVÁN
    // Service Account nemá žádnou storage kvótu - nelze vytvářet soubory
    // Řešení: Použít Shared Drive v Google Workspace klienta
    // Po nastavení GOOGLE_DRIVE_PARENT_FOLDER_ID na ID Shared Drive lze toto odkomentovat:
    //
    // try {
    //   await createInfoFile(mainFolder.id, { ... });
    //   infoFileCreated = true;
    // } catch (infoError) { ... }
    //
    const infoFileCreated = false;
    const infoFileError: string | null = null; // Tiše přeskočíme

    return {
      folderId: mainFolder.id,
      folderUrl: mainFolder.webViewLink,
      folderName: mainFolder.name,
      monthFolderId: monthFolder.id,
      infoFileCreated,
      infoFileError,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const response = (error as Record<string, unknown>)?.response as Record<string, unknown> | undefined;
    console.error('[Drive] Error creating event folder structure:', error);
    console.error('[Drive] Error details:', {
      message,
      response: response?.data,
      status: response?.status,
    });
    throw new Error(`Failed to create event folder structure: ${message}`);
  }
}

/**
 * Získání informací o složce
 * Kontroluje i oprávnění - složka musí být sdílená a přístupná
 */
export async function getFolderInfo(folderId: string) {
  const drive = getDriveClient();

  try {
    const response = await drive.files.get({
      fileId: folderId,
      fields: 'id, name, webViewLink, createdTime, modifiedTime, trashed, shared, permissions',
      supportsAllDrives: true,
    });

    // Pokud je složka v koši, považujeme ji za neexistující
    if (response.data.trashed) {
      throw new Error('Folder is trashed');
    }

    // Kontrola, jestli má složka nastavené "anyone" permission (veřejný odkaz)
    const permissions = response.data.permissions || [];
    const hasPublicAccess = permissions.some(
      (p) => p.type === 'anyone' && (p.role === 'reader' || p.role === 'writer')
    );

    if (!hasPublicAccess) {
      // Zkusíme nastavit veřejné oprávnění
      try {
        await drive.permissions.create({
          fileId: folderId,
          supportsAllDrives: true,
          requestBody: {
            role: 'reader',
            type: 'anyone',
          },
        });
      } catch (permError) {
        // Pokud se nepodaří nastavit oprávnění, složka není platná pro uživatele
        console.error(`[Drive] Failed to set public permission: ${permError instanceof Error ? permError.message : permError}`);
        throw new Error('Folder not accessible - cannot set public permission');
      }
    }

    return response.data;
  } catch (error) {
    // 404 = neexistuje, trashed = v koši, jiné = problém s přístupem
    console.error('Error getting folder info:', error instanceof Error ? error.message : error);
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
      q: `'${escapeDriveQuery(folderId)}' in parents and trashed=false`,
      fields: 'files(id, name, mimeType, webViewLink, createdTime, size)',
      orderBy: 'createdTime desc',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
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

/**
 * Smazání složky na Google Drive
 * Smaže složku včetně všech souborů v ní
 */
export async function deleteFolder(folderId: string) {
  const drive = getDriveClient();

  try {
    await drive.files.delete({
      fileId: folderId,
      supportsAllDrives: true,
    });
    return { success: true };
  } catch (error) {
    const errObj = error as Record<string, unknown>;
    const response = errObj?.response as Record<string, unknown> | undefined;
    // Pokud složka neexistuje (404), považujeme to za úspěch
    if (errObj?.code === 404 || response?.status === 404) {
      return { success: true, alreadyDeleted: true };
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error deleting folder:', message);
    throw new Error(`Failed to delete folder: ${message}`);
  }
}

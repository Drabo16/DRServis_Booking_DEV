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
      console.log(`[Drive] Set public link permission for folder: ${folderId}`);
    } catch (permError: any) {
      // Na Shared Drive může být omezení na sdílení - to je ok
      console.warn(`[Drive] Could not set public permission (may be Shared Drive restriction): ${permError?.message}`);
    }

    return {
      id: folderId,
      name: response.data.name!,
      webViewLink: response.data.webViewLink!,
    };
  } catch (error: any) {
    console.error('Error creating folder:', error?.message);
    throw new Error(`Failed to create folder on Google Drive: ${error?.message}`);
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
      q: `name='${folderName}' and '${parent}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
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
    console.log('[Drive] Creating info file in folder:', folderId);
    console.log('[Drive] Content length:', content.length, 'characters');

    // Vytvoříme prázdný Google Doc (nezabírá storage quota)
    // a pak do něj zapíšeme obsah pomocí Docs API
    console.log('[Drive] Creating empty Google Doc...');

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
    console.log('[Drive] Empty doc created:', docId);

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
      console.log('[Drive] Content written to doc');
    } catch (docsError: any) {
      console.warn('[Drive] Could not write content to doc:', docsError?.message);
      // Doc je vytvořený, jen bez obsahu - to je OK
    }

    console.log('[Drive] API response received:', JSON.stringify(response.data));
    console.log('[Drive] Text file created successfully with ID:', response.data.id);

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
      console.log('[Drive] Public permission set for info file');
    } catch (permError: any) {
      console.warn('[Drive] Could not set public permission for info file:', permError?.message);
    }

    return {
      id: response.data.id!,
      name: response.data.name!,
      webViewLink: response.data.webViewLink!,
    };
  } catch (error: any) {
    console.error('[Drive] Error creating info file:', {
      message: error?.message,
      code: error?.code,
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      data: JSON.stringify(error?.response?.data),
      errors: error?.errors,
      stack: error?.stack,
    });
    throw new Error(`Failed to create info file: ${error?.message || 'Unknown error'}`);
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
  console.log('[Drive] Creating folder structure for:', eventTitle, eventDate);

  try {
    // Získáme nebo vytvoříme měsíční složku
    console.log('[Drive] Getting/creating month folder...');
    const monthFolder = await getOrCreateMonthFolder(eventDate);
    console.log('[Drive] Month folder:', monthFolder.id, monthFolder.name);

    const dateStr = eventDate.toISOString().split('T')[0]; // YYYY-MM-DD
    const mainFolderName = `${dateStr} - ${eventTitle}`;

    // Vytvoříme hlavní složku akce v měsíční složce
    console.log('[Drive] Creating main folder:', mainFolderName);
    const mainFolder = await createFolder(mainFolderName, monthFolder.id);
    console.log('[Drive] Main folder created:', mainFolder.id);

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
  } catch (error: any) {
    console.error('[Drive] Error creating event folder structure:', error);
    console.error('[Drive] Error details:', {
      message: error?.message,
      response: error?.response?.data,
      status: error?.response?.status,
    });
    throw new Error(`Failed to create event folder structure: ${error?.message || 'Unknown error'}`);
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
      console.log(`[Drive] Folder ${folderId} is trashed`);
      throw new Error('Folder is trashed');
    }

    // Kontrola, jestli má složka nastavené "anyone" permission (veřejný odkaz)
    const permissions = response.data.permissions || [];
    const hasPublicAccess = permissions.some(
      (p: any) => p.type === 'anyone' && (p.role === 'reader' || p.role === 'writer')
    );

    if (!hasPublicAccess) {
      console.log(`[Drive] Folder ${folderId} is not publicly accessible, trying to set permission...`);
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
        console.log(`[Drive] Public permission set for folder: ${folderId}`);
      } catch (permError: any) {
        // Pokud se nepodaří nastavit oprávnění, složka není platná pro uživatele
        console.error(`[Drive] Failed to set public permission: ${permError?.message}`);
        throw new Error('Folder not accessible - cannot set public permission');
      }
    }

    return response.data;
  } catch (error: any) {
    // 404 = neexistuje, trashed = v koši, jiné = problém s přístupem
    console.error('Error getting folder info:', error?.message || error);
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
    console.log(`[Drive] Deleting folder: ${folderId}`);
    await drive.files.delete({
      fileId: folderId,
      supportsAllDrives: true,
    });
    console.log(`[Drive] Folder deleted successfully: ${folderId}`);
    return { success: true };
  } catch (error: any) {
    // Pokud složka neexistuje (404), považujeme to za úspěch
    if (error?.code === 404 || error?.response?.status === 404) {
      console.log(`[Drive] Folder not found (already deleted?): ${folderId}`);
      return { success: true, alreadyDeleted: true };
    }
    console.error('Error deleting folder:', error?.message || error);
    throw new Error(`Failed to delete folder: ${error?.message || 'Unknown error'}`);
  }
}

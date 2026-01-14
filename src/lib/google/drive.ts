import { google } from 'googleapis';
import { getGoogleAuth } from './auth';

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
 * Vytvoření struktury složek pro akci
 * Například: Akce / 2026-01-15 - Název akce / [Podklady, Foto, Video]
 */
export async function createEventFolderStructure(
  eventTitle: string,
  eventDate: Date
) {
  try {
    const dateStr = eventDate.toISOString().split('T')[0]; // YYYY-MM-DD
    const mainFolderName = `${dateStr} - ${eventTitle}`;

    // Vytvoříme hlavní složku
    const mainFolder = await createFolder(mainFolderName);

    // Vytvoříme podsložky
    const subfolders = ['Podklady', 'Foto', 'Video', 'Dokumenty'];
    const subfolderPromises = subfolders.map(name =>
      createFolder(name, mainFolder.id)
    );

    await Promise.all(subfolderPromises);

    return {
      folderId: mainFolder.id,
      folderUrl: mainFolder.webViewLink,
      folderName: mainFolder.name,
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

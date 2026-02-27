import { google } from 'googleapis';
import { env } from '@/lib/env';

/**
 * Získání Google Auth klienta pomocí Service Account
 *
 * DŮLEŽITÉ: Pro použití Service Accountu s Google Calendar/Drive je potřeba:
 * 1. Vytvořit Service Account v Google Cloud Console
 * 2. Stáhnout JSON klíč
 * 3. Přidat email Service Accountu jako Editor do Google Kalendáře
 * 4. Přidat oprávnění k Drive složce
 */
export function getGoogleAuth() {
  // Dekódování private key (může obsahovat \n jako string)
  const decodedKey = env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n');

  const auth = new google.auth.JWT({
    email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: decodedKey,
    scopes: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.file',
    ],
  });

  return auth;
}

/**
 * Test připojení k Google API
 */
export async function testGoogleConnection() {
  try {
    const auth = getGoogleAuth();
    const calendar = google.calendar({ version: 'v3', auth });

    // Zkusíme získat seznam kalendářů
    const response = await calendar.calendarList.list();

    return {
      success: true,
      calendars: response.data.items?.map(cal => ({
        id: cal.id,
        summary: cal.summary,
      })),
    };
  } catch (error) {
    console.error('Google API connection test failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { google } from 'googleapis';
import { getAuthClient } from '@/lib/google/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Zkontroluj autentifikaci
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Načti akci
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('drive_folder_id')
      .eq('id', id)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (!event.drive_folder_id) {
      return NextResponse.json({ files: [] });
    }

    // Načti soubory z Google Drive
    const auth = await getAuthClient();
    const drive = google.drive({ version: 'v3', auth });

    const response = await drive.files.list({
      q: `'${event.drive_folder_id}' in parents and trashed=false`,
      fields: 'files(id, name, mimeType, thumbnailLink, webViewLink, iconLink, createdTime, size)',
      orderBy: 'createdTime desc',
      pageSize: 50,
    });

    return NextResponse.json({ files: response.data.files || [] });
  } catch (error) {
    console.error('[API] Error fetching Drive files:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch files',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

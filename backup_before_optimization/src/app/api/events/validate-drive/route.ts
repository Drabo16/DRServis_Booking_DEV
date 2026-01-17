import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getFolderInfo } from '@/lib/google/drive';

/**
 * POST /api/events/validate-drive
 * Ověří existenci Drive složek a aktualizuje stav v DB
 */
export async function POST() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Kontrola admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('auth_user_id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Načti všechny eventy s drive_folder_id
    const { data: events, error } = await supabase
      .from('events')
      .select('id, title, drive_folder_id, drive_folder_url')
      .not('drive_folder_id', 'is', null);

    if (error) {
      throw error;
    }

    let validatedCount = 0;
    let invalidatedCount = 0;
    const results: Array<{ eventId: string; title: string; valid: boolean }> = [];

    for (const event of events || []) {
      if (!event.drive_folder_id) continue;

      try {
        // Zkusíme získat info o složce
        await getFolderInfo(event.drive_folder_id);
        validatedCount++;
        results.push({ eventId: event.id, title: event.title, valid: true });
      } catch {
        // Složka neexistuje - vymažeme z DB
        await supabase
          .from('events')
          .update({
            drive_folder_id: null,
            drive_folder_url: null,
            calendar_attachment_synced: false,
          })
          .eq('id', event.id);

        invalidatedCount++;
        results.push({ eventId: event.id, title: event.title, valid: false });
        console.log(`[Validate Drive] Folder not found for event: ${event.title}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Validated ${validatedCount} folders, invalidated ${invalidatedCount}`,
      validated: validatedCount,
      invalidated: invalidatedCount,
      results,
    });
  } catch (error: any) {
    console.error('Validate Drive error:', error);
    return NextResponse.json(
      {
        error: 'Failed to validate Drive folders',
        message: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

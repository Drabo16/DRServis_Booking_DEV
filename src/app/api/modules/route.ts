// =====================================================
// MODULE SYSTEM API - List all modules
// =====================================================
// To remove: delete this entire /api/modules directory

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/modules
 * Get all active modules (for admin management)
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all active modules
    const { data: modules, error } = await supabase
      .from('app_modules')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({ modules });
  } catch (error) {
    console.error('Modules fetch error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch modules',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

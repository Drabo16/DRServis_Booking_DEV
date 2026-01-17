import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();

    // Kontrola autentizace
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Načti všechny aktivní techniky (včetně adminů, kteří mohou být také techniky)
    const { data: technicians, error } = await supabase
      .from('profiles')
      .select('*')
      .in('role', ['technician', 'admin'])
      .eq('is_active', true)
      .order('full_name');

    if (error) throw error;

    return NextResponse.json({ technicians: technicians || [] });
  } catch (error) {
    console.error('[API] Error fetching technicians:', error);
    return NextResponse.json(
      { error: 'Failed to fetch technicians' },
      { status: 500 }
    );
  }
}

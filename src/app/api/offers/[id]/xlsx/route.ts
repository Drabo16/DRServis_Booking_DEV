// =====================================================
// OFFERS API - XLSX Export Route (Warehouse Preparation)
// =====================================================
// Generates a simple checklist Excel for warehouse workers.
// Format: event name + date, then items with boolean checkboxes.

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import * as XLSX from 'xlsx';
import { OFFER_CATEGORY_ORDER } from '@/types/offers';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, id')
      .eq('auth_user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    let hasAccess = profile.role === 'admin';
    if (!hasAccess) {
      const { data: moduleAccess } = await supabase
        .from('user_module_access')
        .select('id')
        .eq('user_id', profile.id)
        .eq('module_code', 'offers')
        .maybeSingle();
      hasAccess = !!moduleAccess;
    }
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Use service role to fetch data (bypasses RLS)
    const db = createServiceRoleClient();

    const [offerRes, itemsRes] = await Promise.all([
      db
        .from('offers')
        .select('offer_number, year, title, event:events(title, start_time)')
        .eq('id', id)
        .single(),
      db
        .from('offer_items')
        .select('name, category, subcategory, unit, days_hours, quantity, sort_order')
        .eq('offer_id', id)
        .gt('quantity', 0),
    ]);

    if (offerRes.error || !offerRes.data) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
    }

    const offer = offerRes.data as any;
    const rawItems: any[] = itemsRes.data || [];

    // Sort by category order then sort_order
    const catIdx = (cat: string) => {
      const i = OFFER_CATEGORY_ORDER.indexOf(cat as any);
      return i === -1 ? 999 : i;
    };
    const items = [...rawItems].sort((a, b) => {
      const d = catIdx(a.category) - catIdx(b.category);
      return d !== 0 ? d : (a.sort_order || 0) - (b.sort_order || 0);
    });

    // Event info
    const eventTitle: string = offer.event?.title || offer.title || '';
    const eventDate: string = offer.event?.start_time
      ? new Date(offer.event.start_time).toLocaleDateString('cs-CZ', {
          day: 'numeric', month: 'long', year: 'numeric',
        })
      : '';

    // Build rows: info block, empty row, header, item rows
    const rows: any[][] = [
      [eventTitle],
      eventDate ? [eventDate] : [],
      [],
      // Table header
      ['Připraveno', 'Položka', 'Počet (ks)', 'Dny/hod'],
      // Item rows — first column is boolean false (= unchecked checkbox in Sheets)
      ...items.map(item => [
        false,
        item.subcategory ? `${item.name} (${item.subcategory})` : item.name,
        item.quantity ?? 0,
        item.days_hours ?? 1,
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Column widths
    ws['!cols'] = [
      { wch: 14 }, // Připraveno
      { wch: 45 }, // Položka
      { wch: 12 }, // Počet
      { wch: 10 }, // Dny/hod
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Priprava');

    // Write to base64, then decode to binary (avoids Buffer type issues in edge TS)
    const base64: string = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    const binary = Buffer.from(base64, 'base64');

    const filename = `priprava-${offer.offer_number}-${offer.year}.xlsx`;

    return new NextResponse(binary, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('XLSX generation error:', error);
    return NextResponse.json({ error: 'Failed to generate XLSX' }, { status: 500 });
  }
}

// =====================================================
// OFFERS API - XLSX Export Route (Warehouse Preparation)
// =====================================================
// Generates a checklist Excel for warehouse workers.
// Format: event name + date, items grouped by category, no prices.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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

    // Check offers module access
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

    // Fetch offer info
    const { data: offer, error: offerError } = await supabase
      .from('offers')
      .select('offer_number, year, title, event:events(title, start_time)')
      .eq('id', id)
      .single();

    if (offerError || !offer) {
      console.error('XLSX: offer fetch error', offerError);
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
    }

    // Fetch all items for this offer (same as the items GET route — no quantity filter)
    const { data: items, error: itemsError } = await supabase
      .from('offer_items')
      .select('name, category, subcategory, days_hours, quantity, sort_order')
      .eq('offer_id', id)
      .order('sort_order', { ascending: true });

    if (itemsError) {
      console.error('XLSX: items fetch error', itemsError);
      return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
    }

    const allItems = items || [];

    // Filter out items with qty = 0 (shouldn't be in DB but just in case)
    const activeItems = allItems.filter(item => (item.quantity ?? 0) > 0);

    // Sort by category order, then sort_order within category
    const catIdx = (cat: string): number => {
      const i = OFFER_CATEGORY_ORDER.indexOf(cat as any);
      return i === -1 ? 999 : i;
    };
    activeItems.sort((a, b) => {
      const d = catIdx(a.category) - catIdx(b.category);
      return d !== 0 ? d : (a.sort_order || 0) - (b.sort_order || 0);
    });

    // Build event info
    const offerData = offer as any;
    const eventTitle: string = offerData.event?.title || offerData.title || '';
    const eventDate: string = offerData.event?.start_time
      ? new Date(offerData.event.start_time).toLocaleDateString('cs-CZ', {
          day: 'numeric', month: 'long', year: 'numeric',
        })
      : '';

    // Build rows grouped by category
    const rows: any[][] = [];

    // Info header
    rows.push([eventTitle]);
    if (eventDate) rows.push([eventDate]);
    rows.push([]); // empty row

    // Table header
    rows.push(['Připraveno', 'Kategorie', 'Položka', 'Počet (ks)', 'Dny/hod']);

    // Items grouped by category
    let lastCategory = '';
    for (const item of activeItems) {
      const cat = item.category || 'Ostatní';
      if (cat !== lastCategory) {
        // Category separator row (empty checkbox, bold category name)
        rows.push(['', cat]);
        lastCategory = cat;
      }
      const itemName = item.subcategory
        ? `${item.name} (${item.subcategory})`
        : item.name;
      rows.push([
        false,       // Připraveno — boolean false = unchecked in Google Sheets
        '',          // Category already shown in separator
        itemName,
        item.quantity ?? 0,
        item.days_hours ?? 1,
      ]);
    }

    // If no items at all, add a note row
    if (activeItems.length === 0) {
      rows.push(['', '', '— žádné položky —']);
    }

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Column widths
    ws['!cols'] = [
      { wch: 13 }, // Připraveno
      { wch: 24 }, // Kategorie
      { wch: 44 }, // Položka
      { wch: 12 }, // Počet
      { wch: 10 }, // Dny/hod
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Priprava');

    const filename = `priprava-${offerData.offer_number}-${offerData.year}.xlsx`;

    const xlsxBuffer: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(new Uint8Array(xlsxBuffer), {
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

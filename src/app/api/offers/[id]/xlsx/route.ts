// =====================================================
// OFFERS API - XLSX Export Route (Warehouse Preparation)
// =====================================================
// Generates an Excel file with offer items (no prices)
// for warehouse workers to use as a preparation checklist.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import * as XLSX from 'xlsx';
import { formatOfferNumber, OFFER_CATEGORY_ORDER } from '@/types/offers';

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

    // Check offers access
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

    // Fetch offer data using service role to bypass RLS
    const db = createServiceRoleClient();

    const [offerRes, itemsRes] = await Promise.all([
      db
        .from('offers')
        .select('id, offer_number, year, title, event:events(title, start_time, location)')
        .eq('id', id)
        .single(),
      db
        .from('offer_items')
        .select('name, category, subcategory, unit, days_hours, quantity, sort_order')
        .eq('offer_id', id)
        .gt('quantity', 0)
        .order('sort_order', { ascending: true }),
    ]);

    if (offerRes.error || !offerRes.data) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
    }

    const offer = offerRes.data as any;
    const rawItems: any[] = itemsRes.data || [];

    // Sort items by category order
    const categoryIndex = (cat: string) => {
      const idx = OFFER_CATEGORY_ORDER.indexOf(cat as any);
      return idx === -1 ? 999 : idx;
    };
    const items = [...rawItems].sort((a, b) => {
      const catDiff = categoryIndex(a.category) - categoryIndex(b.category);
      if (catDiff !== 0) return catDiff;
      return (a.sort_order || 0) - (b.sort_order || 0);
    });

    // Build spreadsheet rows
    const offerNum = formatOfferNumber(offer.offer_number, offer.year);
    const eventTitle = offer.event?.title || '-';
    const eventDate = offer.event?.start_time
      ? new Date(offer.event.start_time).toLocaleDateString('cs-CZ', {
          day: 'numeric', month: 'long', year: 'numeric',
        })
      : '-';

    const headerRows: any[][] = [
      ['Nabídka:', offerNum],
      ['Název:', offer.title],
      ['Akce:', eventTitle],
      ['Datum akce:', eventDate],
      [],
    ];

    const tableHeader = ['Připraveno', 'Kategorie', 'Položka', 'Podkategorie', 'Dny / hod', 'Množství', 'Jednotka'];

    const tableRows = items.map(item => [
      '',                         // Připraveno — empty, worker marks this
      item.category || '',
      item.name || '',
      item.subcategory || '',
      item.days_hours ?? 1,
      item.quantity ?? 0,
      item.unit || 'ks',
    ]);

    const allRows = [...headerRows, tableHeader, ...tableRows];

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(allRows);

    // Column widths
    ws['!cols'] = [
      { wch: 13 }, // Připraveno
      { wch: 22 }, // Kategorie
      { wch: 40 }, // Položka
      { wch: 22 }, // Podkategorie
      { wch: 11 }, // Dny/hod
      { wch: 11 }, // Množství
      { wch: 9 },  // Jednotka
    ];

    // Bold the table header row (row index = headerRows.length, 0-based)
    const headerRowIdx = headerRows.length;
    tableHeader.forEach((_, colIdx) => {
      const cellAddr = XLSX.utils.encode_cell({ r: headerRowIdx, c: colIdx });
      if (ws[cellAddr]) {
        ws[cellAddr].s = { font: { bold: true }, fill: { fgColor: { rgb: 'E2E8F0' } } };
      }
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Příprava skladu');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="priprava-${offerNum}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('XLSX generation error:', error);
    return NextResponse.json({ error: 'Failed to generate XLSX' }, { status: 500 });
  }
}

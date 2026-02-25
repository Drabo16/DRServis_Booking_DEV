// =====================================================
// OFFERS API - XLSX Export Route (Warehouse Preparation)
// =====================================================
// Generates a warehouse checklist Excel.
// Format: event name + date, items with ☐ checkboxes,
// categories highlighted with colored merged rows, no prices.

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

    // Fetch all items
    const { data: items, error: itemsError } = await supabase
      .from('offer_items')
      .select('name, category, subcategory, days_hours, quantity, sort_order')
      .eq('offer_id', id)
      .order('sort_order', { ascending: true });

    if (itemsError) {
      console.error('XLSX: items fetch error', itemsError);
      return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
    }

    const activeItems = (items || []).filter(item => (item.quantity ?? 0) > 0);

    // Sort by category order, then sort_order within category
    const catIdx = (cat: string): number => {
      const i = OFFER_CATEGORY_ORDER.indexOf(cat as any);
      return i === -1 ? 999 : i;
    };
    activeItems.sort((a, b) => {
      const d = catIdx(a.category) - catIdx(b.category);
      return d !== 0 ? d : (a.sort_order || 0) - (b.sort_order || 0);
    });

    const offerData = offer as any;
    const eventTitle: string = offerData.event?.title || offerData.title || '';
    const eventDate: string = offerData.event?.start_time
      ? new Date(offerData.event.start_time).toLocaleDateString('cs-CZ', {
          day: 'numeric', month: 'long', year: 'numeric',
        })
      : '';

    // ── Styles ──────────────────────────────────────────
    const STYLE_TITLE = { font: { bold: true, sz: 13 } };
    const STYLE_DATE  = { font: { sz: 11 } };
    const STYLE_HEADER = { font: { bold: true, sz: 11 } };
    const STYLE_CATEGORY = {
      fill: { patternType: 'solid', fgColor: { rgb: 'BDD7EE' } },
      font: { bold: true, sz: 11 },
    };
    const STYLE_CHECKBOX = { font: { sz: 14 }, alignment: { horizontal: 'center', vertical: 'center' } };

    // ── Build rows ───────────────────────────────────────
    // Columns: A = Připraveno (checkbox), B = Položka, C = Počet (ks)
    const NUM_COLS = 3;
    const wsData: any[][] = [];
    const merges: XLSX.Range[] = [];
    const styledCells: Record<string, any> = {};

    const addRow = (cells: any[], style?: any, mergeAll = false): number => {
      wsData.push(cells);
      const r = wsData.length - 1;
      if (mergeAll) {
        merges.push({ s: { r, c: 0 }, e: { r, c: NUM_COLS - 1 } });
      }
      if (style) {
        styledCells[XLSX.utils.encode_cell({ r, c: 0 })] = style;
      }
      return r;
    };

    // Title + date (merged across all columns)
    addRow([eventTitle, '', ''], STYLE_TITLE, true);
    if (eventDate) addRow([eventDate, '', ''], STYLE_DATE, true);
    addRow(['', '', '']); // empty spacer

    // Table header
    addRow(['Připraveno', 'Položka', 'Počet (ks)'], null);
    const headerRow = wsData.length - 1;
    for (let c = 0; c < NUM_COLS; c++) {
      styledCells[XLSX.utils.encode_cell({ r: headerRow, c })] = STYLE_HEADER;
    }

    // Items grouped by category
    let lastCategory = '';
    for (const item of activeItems) {
      const cat = item.category || 'Ostatní';
      if (cat !== lastCategory) {
        // Category row: merged, colored
        addRow([cat, '', ''], STYLE_CATEGORY, true);
        lastCategory = cat;
      }
      const itemName = item.subcategory ? `${item.name} (${item.subcategory})` : item.name;
      addRow(['☐', itemName, item.quantity ?? 0]);
      // Style the checkbox cell
      const checkboxRow = wsData.length - 1;
      styledCells[XLSX.utils.encode_cell({ r: checkboxRow, c: 0 })] = STYLE_CHECKBOX;
    }

    if (activeItems.length === 0) {
      addRow(['', '— žádné položky —', '']);
    }

    // ── Create worksheet ─────────────────────────────────
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!merges'] = merges;

    // Apply styles
    for (const [addr, style] of Object.entries(styledCells)) {
      if (ws[addr]) ws[addr].s = style;
    }

    // Column widths
    ws['!cols'] = [
      { wch: 12 }, // Připraveno (checkbox)
      { wch: 50 }, // Položka
      { wch: 12 }, // Počet (ks)
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Priprava');

    const filename = `priprava-${offerData.offer_number}-${offerData.year}.xlsx`;
    const xlsxBuffer: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellStyles: true });

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

// =====================================================
// OFFERS API - XLSX Export Route (Warehouse Preparation)
// =====================================================
// Professional warehouse checklist with Excel 365 checkboxes.
// Excel 365 stores checkboxes as boolean cells with numFmt="Checkbox".

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import * as XLSX from 'xlsx';
import { OFFER_CATEGORY_ORDER } from '@/types/offers';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ── Style definitions ──────────────────────────────────────────────────────
const S_TITLE: any = {
  font: { bold: true, sz: 16, color: { rgb: '1A355E' } },
  alignment: { vertical: 'center' },
};
const S_DATE: any = {
  font: { sz: 11, color: { rgb: '555555' } },
  alignment: { vertical: 'center' },
};
const S_COL_HEADER: any = {
  fill: { patternType: 'solid', fgColor: { rgb: '1A355E' } },
  font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } },
  alignment: { horizontal: 'center', vertical: 'center' },
};
const S_COL_HEADER_LEFT: any = {
  fill: { patternType: 'solid', fgColor: { rgb: '1A355E' } },
  font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } },
  alignment: { horizontal: 'left', vertical: 'center' },
};
const S_CATEGORY: any = {
  fill: { patternType: 'solid', fgColor: { rgb: 'BDD7EE' } },
  font: { bold: true, sz: 11, color: { rgb: '1A355E' } },
  alignment: { horizontal: 'left', vertical: 'center' },
};
// Excel 365 native checkbox: boolean cell + numFmt "Checkbox"
const S_CHECKBOX: any = {
  numFmt: 'Checkbox',
  alignment: { horizontal: 'center', vertical: 'center' },
};
const S_ITEM_NAME: any = {
  font: { sz: 11 },
  alignment: { vertical: 'center', wrapText: false },
};
const S_ITEM_QTY: any = {
  font: { sz: 11 },
  alignment: { horizontal: 'center', vertical: 'center' },
};

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

    const { data: offer, error: offerError } = await supabase
      .from('offers')
      .select('offer_number, year, title, event:events(title, start_time)')
      .eq('id', id)
      .single();

    if (offerError || !offer) {
      console.error('XLSX: offer fetch error', offerError);
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
    }

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

    // ── Build worksheet ───────────────────────────────────────────────────
    const wsData: any[][] = [];
    const merges: XLSX.Range[] = [];
    // { r, c, style } applied after aoa_to_sheet
    const cellStyleMap: { r: number; c: number; style: any; t?: string; v?: any }[] = [];
    const rowHpts: number[] = [];

    const push = (cells: any[], hpt: number): number => {
      wsData.push(cells);
      rowHpts.push(hpt);
      return wsData.length - 1;
    };

    const mergeRow = (r: number) =>
      merges.push({ s: { r, c: 0 }, e: { r, c: 2 } });

    // Row: event title
    const rTitle = push([eventTitle, '', ''], 32);
    mergeRow(rTitle);
    cellStyleMap.push({ r: rTitle, c: 0, style: S_TITLE });

    // Row: date
    if (eventDate) {
      const rDate = push([eventDate, '', ''], 20);
      mergeRow(rDate);
      cellStyleMap.push({ r: rDate, c: 0, style: S_DATE });
    }

    // Spacer
    push(['', '', ''], 10);

    // Column headers
    const rHeader = push(['Připraveno', 'Položka', 'Počet (ks)'], 24);
    cellStyleMap.push({ r: rHeader, c: 0, style: S_COL_HEADER });
    cellStyleMap.push({ r: rHeader, c: 1, style: S_COL_HEADER_LEFT });
    cellStyleMap.push({ r: rHeader, c: 2, style: S_COL_HEADER });

    // Items
    let lastCategory = '';
    for (const item of activeItems) {
      const cat = item.category || 'Ostatní';
      if (cat !== lastCategory) {
        const rCat = push([cat, '', ''], 22);
        mergeRow(rCat);
        cellStyleMap.push({ r: rCat, c: 0, style: S_CATEGORY });
        lastCategory = cat;
      }

      const itemName = item.subcategory
        ? `${item.name} (${item.subcategory})`
        : item.name;

      // Use boolean false → Excel 365 will treat as checkbox with numFmt "Checkbox"
      const rItem = push([false, itemName, item.quantity ?? 0], 20);

      // Checkbox cell: boolean + Excel 365 numFmt
      cellStyleMap.push({ r: rItem, c: 0, style: S_CHECKBOX, t: 'b', v: false });
      cellStyleMap.push({ r: rItem, c: 1, style: S_ITEM_NAME });
      cellStyleMap.push({ r: rItem, c: 2, style: S_ITEM_QTY });
    }

    if (activeItems.length === 0) {
      const rEmpty = push(['', '— žádné položky —', ''], 20);
      mergeRow(rEmpty);
    }

    // ── Create & style worksheet ──────────────────────────────────────────
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!merges'] = merges;

    // Apply cell styles (and override t/v for checkbox cells)
    for (const { r, c, style, t, v } of cellStyleMap) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = {};
      ws[addr].s = style;
      if (t !== undefined) ws[addr].t = t;
      if (v !== undefined) ws[addr].v = v;
    }

    // Row heights
    ws['!rows'] = rowHpts.map(hpt => ({ hpt }));

    // Column widths
    ws['!cols'] = [
      { wch: 13 }, // Připraveno
      { wch: 52 }, // Položka
      { wch: 12 }, // Počet (ks)
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Priprava');

    const filename = `priprava-${offerData.offer_number}-${offerData.year}.xlsx`;
    // cellStyles: true — SheetJS writes s.numFmt as custom numFmt in styles.xml
    // Excel 365 reads numFmt="Checkbox" and renders boolean cells as interactive checkboxes
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

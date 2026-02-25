// =====================================================
// OFFERS API - XLSX Export Route (Warehouse Preparation)
// =====================================================
// Uses xlsx-js-style for real style writing.
// Excel 365 checkboxes: boolean cell with f:"CHECKBOX()" formula.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
// xlsx-js-style: SheetJS fork that actually writes cell styles
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx-js-style');
import { OFFER_CATEGORY_ORDER } from '@/types/offers';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ── Styles ────────────────────────────────────────────────────────────────
const S_TITLE = {
  font: { bold: true, sz: 16, color: { rgb: '1A355E' } },
  alignment: { horizontal: 'center', vertical: 'center' },
};
const S_DATE_ROW = {
  font: { sz: 11, italic: true, color: { rgb: '555555' } },
  alignment: { horizontal: 'center', vertical: 'center' },
};
const S_COL_HEADER_CENTER = {
  fill: { fgColor: { rgb: '1A355E' } },
  font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } },
  alignment: { horizontal: 'center', vertical: 'center' },
};
const S_COL_HEADER_LEFT = {
  fill: { fgColor: { rgb: '1A355E' } },
  font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } },
  alignment: { horizontal: 'left', vertical: 'center' },
};
const S_CATEGORY = {
  fill: { fgColor: { rgb: 'BDD7EE' } },
  font: { bold: true, sz: 11, color: { rgb: '1A355E' } },
  alignment: { horizontal: 'left', vertical: 'center' },
};
const S_ITEM = {
  font: { sz: 11 },
  alignment: { vertical: 'center', wrapText: false },
};
const S_QTY = {
  font: { sz: 11 },
  alignment: { horizontal: 'center', vertical: 'center' },
};
const S_CHECKBOX_HEADER = {
  fill: { fgColor: { rgb: '1A355E' } },
  font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } },
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
      .select('offer_number, year, title, event:events(title, start_time, end_time)')
      .eq('id', id)
      .single();

    if (offerError || !offer) {
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
    const ev = offerData.event;
    const eventTitle: string = ev?.title || offerData.title || '';

    // Date range: "25. června 2025" or "25. – 27. června 2025"
    let dateLabel = '';
    if (ev?.start_time) {
      const startDate = new Date(ev.start_time);
      const fmt = (d: Date) => d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
      if (ev?.end_time) {
        const endDate = new Date(ev.end_time);
        const sameDay = startDate.toDateString() === endDate.toDateString();
        dateLabel = sameDay
          ? fmt(startDate)
          : `${startDate.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long' })} – ${fmt(endDate)}`;
      } else {
        dateLabel = fmt(startDate);
      }
    }

    // ── Build worksheet ───────────────────────────────────────────────────
    // Columns: A = Položka | B = Počet (ks) | C = Připraveno (checkbox, last)
    const NUM_COLS = 3;
    const ws: any = {};
    const merges: any[] = [];
    let r = 0;

    const set = (row: number, col: number, v: any, t: string, s?: any, f?: string) => {
      const addr = XLSX.utils.encode_cell({ r: row, c: col });
      ws[addr] = { v, t, ...(s ? { s } : {}), ...(f ? { f } : {}) };
    };

    const mergeRow = (row: number) =>
      merges.push({ s: { r: row, c: 0 }, e: { r: row, c: NUM_COLS - 1 } });

    const emptyMergedRow = (row: number, s?: any) => {
      for (let c = 0; c < NUM_COLS; c++) set(row, c, '', 's', s);
      mergeRow(row);
    };

    // Row 0: event title (centered, merged)
    for (let c = 0; c < NUM_COLS; c++) set(r, c, c === 0 ? eventTitle : '', 's', S_TITLE);
    mergeRow(r); r++;

    // Row 1: date range (if available)
    if (dateLabel) {
      for (let c = 0; c < NUM_COLS; c++) set(r, c, c === 0 ? dateLabel : '', 's', S_DATE_ROW);
      mergeRow(r); r++;
    } else {
      // Empty row 1 even if no date
      emptyMergedRow(r); r++;
    }

    // Row 2: spacer
    emptyMergedRow(r); r++;

    // Row 3: column headers — Položka | Počet (ks) | Připraveno
    set(r, 0, 'Položka',     's', S_COL_HEADER_LEFT);
    set(r, 1, 'Počet (ks)', 's', S_COL_HEADER_CENTER);
    set(r, 2, 'Připraveno', 's', S_CHECKBOX_HEADER);
    r++;

    // Items
    let lastCategory = '';
    for (const item of activeItems) {
      const cat = item.category || 'Ostatní';
      if (cat !== lastCategory) {
        // Category row: merged, colored
        for (let c = 0; c < NUM_COLS; c++) set(r, c, c === 0 ? cat : '', 's', S_CATEGORY);
        mergeRow(r); r++;
        lastCategory = cat;
      }

      const itemName = item.subcategory
        ? `${item.name} (${item.subcategory})`
        : item.name;

      set(r, 0, itemName,          's', S_ITEM);
      set(r, 1, item.quantity ?? 0,'n', S_QTY);
      // Column C: Excel 365 checkbox via CHECKBOX() formula
      // t:'b', v:false = cached boolean value, f:'CHECKBOX()' = Excel 365 checkbox formula
      set(r, 2, false, 'b', S_COL_HEADER_CENTER, 'CHECKBOX()');
      r++;
    }

    if (activeItems.length === 0) {
      set(r, 0, '— žádné položky —', 's');
      set(r, 1, '', 's');
      set(r, 2, '', 's');
      r++;
    }

    // Worksheet metadata
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: r - 1, c: NUM_COLS - 1 } });
    ws['!merges'] = merges;
    ws['!cols'] = [
      { wch: 54 }, // Položka
      { wch: 12 }, // Počet (ks)
      { wch: 13 }, // Připraveno
    ];
    ws['!rows'] = Array.from({ length: r }, (_, i) => {
      if (i === 0) return { hpt: 30 };  // title
      if (i === 1) return { hpt: 18 };  // date / empty
      return { hpt: 20 };               // rest
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Priprava');

    const offerNum = offerData.offer_number;
    const offerYear = offerData.year;
    const filename = `priprava-${offerNum}-${offerYear}.xlsx`;
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

// =====================================================
// OFFERS API - XLSX Export Route (Warehouse Preparation)
// =====================================================
// Uses xlsx-js-style (SheetJS fork with real style writing support).
// Excel 365 checkboxes: boolean cell + numFmt "Checkbox" in styles.xml.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
// xlsx-js-style: drop-in replacement for xlsx that actually writes cell styles
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx-js-style');
import { OFFER_CATEGORY_ORDER } from '@/types/offers';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ── Styles (xlsx-js-style format) ──────────────────────────────────────────
const S_TITLE = {
  font: { bold: true, sz: 16, color: { rgb: '1A355E' } },
};
const S_DATE = {
  font: { sz: 11, italic: true, color: { rgb: '666666' } },
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
// Excel 365 checkbox: boolean cell + numFmt "Checkbox" written to styles.xml
const S_CHECKBOX = {
  numFmt: 'Checkbox',
  alignment: { horizontal: 'center', vertical: 'center' },
};
const S_ITEM = {
  font: { sz: 11 },
  alignment: { vertical: 'center' },
};
const S_QTY = {
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

    // ── Build worksheet manually (not aoa) for full style control ──────────
    const ws: any = {};
    const merges: any[] = [];
    let r = 0; // current row index

    const setCell = (row: number, col: number, v: any, t: string, s?: any) => {
      const addr = XLSX.utils.encode_cell({ r: row, c: col });
      ws[addr] = { v, t, ...(s ? { s } : {}) };
    };

    const mergeRow = (row: number) =>
      merges.push({ s: { r: row, c: 0 }, e: { r: row, c: 2 } });

    // Row: event title
    setCell(r, 0, eventTitle, 's', S_TITLE);
    setCell(r, 1, '', 's');
    setCell(r, 2, '', 's');
    mergeRow(r); r++;

    // Row: date
    if (eventDate) {
      setCell(r, 0, eventDate, 's', S_DATE);
      setCell(r, 1, '', 's');
      setCell(r, 2, '', 's');
      mergeRow(r); r++;
    }

    // Spacer
    setCell(r, 0, '', 's'); setCell(r, 1, '', 's'); setCell(r, 2, '', 's');
    r++;

    // Column headers
    setCell(r, 0, 'Připraveno', 's', S_COL_HEADER_CENTER);
    setCell(r, 1, 'Položka',    's', S_COL_HEADER_LEFT);
    setCell(r, 2, 'Počet (ks)', 's', S_COL_HEADER_CENTER);
    r++;

    // Items grouped by category
    let lastCategory = '';
    for (const item of activeItems) {
      const cat = item.category || 'Ostatní';
      if (cat !== lastCategory) {
        setCell(r, 0, cat, 's', S_CATEGORY);
        setCell(r, 1, '',  's', S_CATEGORY);
        setCell(r, 2, '',  's', S_CATEGORY);
        mergeRow(r); r++;
        lastCategory = cat;
      }

      const itemName = item.subcategory
        ? `${item.name} (${item.subcategory})`
        : item.name;

      // Checkbox: boolean false + numFmt "Checkbox" → Excel 365 interactive checkbox
      setCell(r, 0, false,             'b', S_CHECKBOX);
      setCell(r, 1, itemName,          's', S_ITEM);
      setCell(r, 2, item.quantity ?? 0,'n', S_QTY);
      r++;
    }

    if (activeItems.length === 0) {
      setCell(r, 0, '', 's');
      setCell(r, 1, '— žádné položky —', 's');
      setCell(r, 2, '', 's');
      r++;
    }

    // Worksheet range
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: r - 1, c: 2 } });
    ws['!merges'] = merges;
    ws['!cols'] = [
      { wch: 13 }, // Připraveno
      { wch: 52 }, // Položka
      { wch: 12 }, // Počet (ks)
    ];
    // Row heights (hpt = points)
    ws['!rows'] = Array.from({ length: r }, (_, i) => {
      if (i === 0) return { hpt: 28 };          // title
      if (eventDate && i === 1) return { hpt: 18 }; // date
      return { hpt: 20 };
    });

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

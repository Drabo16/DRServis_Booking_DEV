// =====================================================
// OFFERS API - XLSX Export Route (Warehouse Preparation)
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiError } from '@/lib/api-response';
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
// Empty cell — white background, no content (placeholder for checkbox)
const S_EMPTY = {
  alignment: { horizontal: 'center', vertical: 'center' },
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, id')
      .eq('auth_user_id', user.id)
      .single();

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

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
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

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
      .select('name, category, subcategory, quantity, sort_order')
      .eq('offer_id', id)
      .order('sort_order', { ascending: true });

    if (itemsError) {
      console.error('XLSX: items fetch error', itemsError);
      return apiError('Failed to fetch items');
    }

    const EXCLUDED_CATEGORIES = ['Technický personál', 'Doprava'];
    const activeItems = (items || []).filter(item =>
      (item.quantity ?? 0) > 0 && !EXCLUDED_CATEGORIES.includes(item.category)
    );

    const catIdx = (cat: string): number => {
      const i = (OFFER_CATEGORY_ORDER as readonly string[]).indexOf(cat);
      return i === -1 ? 999 : i;
    };
    activeItems.sort((a, b) => {
      const d = catIdx(a.category) - catIdx(b.category);
      return d !== 0 ? d : (a.sort_order || 0) - (b.sort_order || 0);
    });

    const offerData = offer as Record<string, unknown>;
    const ev = offerData.event as Record<string, unknown> | null;
    const eventTitle: string = (ev?.title as string) || (offerData.title as string) || '';

    // ── Build worksheet ───────────────────────────────────────────────────
    // Columns: A = Položka | B = Počet (ks) | C = Připraveno (empty, for manual checkbox)
    const NUM_COLS = 3;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ws: Record<string, any> = {};
    const merges: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }> = [];
    let r = 0;

    const set = (row: number, col: number, v: string | number, t: string, s?: Record<string, unknown>) => {
      const addr = XLSX.utils.encode_cell({ r: row, c: col });
      ws[addr] = { v, t, ...(s ? { s } : {}) };
    };

    const mergeRow = (row: number) =>
      merges.push({ s: { r: row, c: 0 }, e: { r: row, c: NUM_COLS - 1 } });

    // Title
    for (let c = 0; c < NUM_COLS; c++) set(r, c, c === 0 ? eventTitle : '', 's', S_TITLE);
    mergeRow(r); r++;

    // Spacer
    for (let c = 0; c < NUM_COLS; c++) set(r, c, '', 's');
    r++;

    // Headers
    set(r, 0, 'Položka',     's', S_COL_HEADER_LEFT);
    set(r, 1, 'Počet (ks)', 's', S_COL_HEADER_CENTER);
    set(r, 2, 'Připraveno', 's', S_COL_HEADER_CENTER);
    r++;

    // Items
    let lastCategory = '';
    for (const item of activeItems) {
      const cat = item.category || 'Ostatní';
      if (cat !== lastCategory) {
        for (let c = 0; c < NUM_COLS; c++) set(r, c, c === 0 ? cat : '', 's', S_CATEGORY);
        mergeRow(r); r++;
        lastCategory = cat;
      }

      const itemName = item.subcategory
        ? `${item.name} (${item.subcategory})`
        : item.name;

      set(r, 0, itemName,          's', S_ITEM);
      set(r, 1, item.quantity ?? 0,'n', S_QTY);
      set(r, 2, '',                's', S_EMPTY); // empty — user adds checkbox via Insert > Checkbox
      r++;
    }

    if (activeItems.length === 0) {
      set(r, 0, '— žádné položky —', 's'); set(r, 1, '', 's'); set(r, 2, '', 's');
      r++;
    }

    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: r - 1, c: NUM_COLS - 1 } });
    ws['!merges'] = merges;
    ws['!cols'] = [
      { wch: 54 }, // Položka
      { wch: 12 }, // Počet (ks)
      { wch: 13 }, // Připraveno
    ];
    ws['!rows'] = Array.from({ length: r }, (_, i) => {
      if (i === 0) return { hpt: 30 };
      if (i === 1) return { hpt: 18 };
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
    return apiError('Failed to generate XLSX');
  }
}

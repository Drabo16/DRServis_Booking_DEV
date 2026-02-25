// =====================================================
// OFFERS API - XLSX Export Route (Warehouse Preparation)
// =====================================================
// Uses xlsx-js-style for cell styles.
// Injects VML form-control checkboxes via fflate ZIP manipulation.
// These are the "Zaškrtávací políčko" (legacy form controls) that work
// in all Excel versions without needing the CHECKBOX() function.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx-js-style');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { unzipSync, zipSync, strToU8, strFromU8 } = require('fflate');
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
// Checkbox cell: dark blue fill, text invisible (same as bg) — form control floats on top
const S_CHECKBOX_CELL = {
  fill: { fgColor: { rgb: '1A355E' } },
  font: { color: { rgb: '1A355E' } }, // invisible text on dark bg
  alignment: { horizontal: 'center', vertical: 'center' },
};

// ── VML injection ─────────────────────────────────────────────────────────
function injectFormControls(buffer: Buffer, rowIndices: number[]): Buffer {
  if (rowIndices.length === 0) return buffer;

  const zipped: Record<string, Uint8Array> = unzipSync(new Uint8Array(buffer));

  // 1. Build VML drawing with one checkbox per row
  const shapes = rowIndices.map((rowIdx, i) => `
  <v:shape id="_x0000_s${1025 + i}" type="#_x0000_t201"
   style='position:absolute;margin-left:0;margin-top:0;width:52pt;height:14pt;z-index:1;mso-position-horizontal:absolute;mso-position-vertical:absolute'>
   <v:fill color2="window [65]" o:detectmouseclick="t"/>
   <v:shadow color="windowText [64]" obscured="t"/>
   <v:path o:connecttype="rect"/>
   <v:textbox><div style='text-align:left'><span style='font-size:8pt'>&#x00A0;</span></div></v:textbox>
   <x:ClientData ObjectType="Checkbox">
    <x:Anchor>2, 15, ${rowIdx}, 2, 3, -15, ${rowIdx + 1}, -2</x:Anchor>
    <x:PrintObject/>
    <x:AutoFill>False</x:AutoFill>
    <x:FmlaLink>$C$${rowIdx + 1}</x:FmlaLink>
    <x:TextHAlign>Center</x:TextHAlign>
    <x:NoThreeD/>
   </x:ClientData>
  </v:shape>`).join('');

  const vmlXml =
    `<xml xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">` +
    `<o:shapelayout v:ext="edit"><o:idmap v:ext="edit" data="1"/></o:shapelayout>` +
    `<v:shapetype id="_x0000_t201" coordsize="21600,21600" o:spt="201" path="m0,0l0,21600,21600,21600,21600,0xe">` +
    `<v:stroke joinstyle="miter"/>` +
    `<v:path shadowok="f" o:extrusionok="f" gradientshapeok="t" o:connecttype="rect"/>` +
    `</v:shapetype>` +
    shapes +
    `</xml>`;

  zipped['xl/drawings/vmlDrawing1.vml'] = strToU8(vmlXml);

  // 2. Add <legacyDrawing> to sheet1.xml
  const sheetKey = 'xl/worksheets/sheet1.xml';
  if (zipped[sheetKey]) {
    let sheetXml: string = strFromU8(zipped[sheetKey]);
    if (!sheetXml.includes('legacyDrawing')) {
      sheetXml = sheetXml.replace('</worksheet>', '<legacyDrawing r:id="rIdVML"/></worksheet>');
      zipped[sheetKey] = strToU8(sheetXml);
    }
  }

  // 3. Create sheet1.xml.rels (doesn't exist in base output)
  const vmlRel =
    `<Relationship Id="rIdVML"` +
    ` Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/vmlDrawing"` +
    ` Target="../drawings/vmlDrawing1.vml"/>`;
  const relsKey = 'xl/worksheets/_rels/sheet1.xml.rels';
  if (zipped[relsKey]) {
    let relsXml: string = strFromU8(zipped[relsKey]);
    if (!relsXml.includes('vmlDrawing')) {
      relsXml = relsXml.replace('</Relationships>', vmlRel + '</Relationships>');
      zipped[relsKey] = strToU8(relsXml);
    }
  } else {
    zipped[relsKey] = strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      vmlRel +
      `</Relationships>`
    );
  }

  // 4. Register vmlDrawing in [Content_Types].xml
  const ctKey = '[Content_Types].xml';
  if (zipped[ctKey]) {
    let ctXml: string = strFromU8(zipped[ctKey]);
    if (!ctXml.includes('vmlDrawing')) {
      ctXml = ctXml.replace(
        '</Types>',
        `<Override PartName="/xl/drawings/vmlDrawing1.vml"` +
        ` ContentType="application/vnd.openxmlformats-officedocument.vmlDrawing"/></Types>`
      );
      zipped[ctKey] = strToU8(ctXml);
    }
  }

  return Buffer.from(zipSync(zipped));
}

// ── Route handler ──────────────────────────────────────────────────────────
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

    // Date range label
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
    // Columns: A = Položka (wide) | B = Počet (ks) | C = Připraveno (checkbox)
    const NUM_COLS = 3;
    const ws: any = {};
    const merges: any[] = [];
    const checkboxRowIndices: number[] = [];
    let r = 0;

    const set = (row: number, col: number, v: any, t: string, s?: any) => {
      const addr = XLSX.utils.encode_cell({ r: row, c: col });
      ws[addr] = { v, t, ...(s ? { s } : {}) };
    };

    const mergeRow = (row: number) =>
      merges.push({ s: { r: row, c: 0 }, e: { r: row, c: NUM_COLS - 1 } });

    // Title row (merged, centered)
    for (let c = 0; c < NUM_COLS; c++) set(r, c, c === 0 ? eventTitle : '', 's', S_TITLE);
    mergeRow(r); r++;

    // Date row (merged, centered) — always present (empty if no date)
    for (let c = 0; c < NUM_COLS; c++) set(r, c, c === 0 ? dateLabel : '', 's', S_DATE_ROW);
    mergeRow(r); r++;

    // Spacer
    for (let c = 0; c < NUM_COLS; c++) set(r, c, '', 's');
    r++;

    // Column headers
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
      // boolean FALSE — form control linked here; text color = bg = invisible
      set(r, 2, false,             'b', S_CHECKBOX_CELL);
      checkboxRowIndices.push(r);
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

    // Generate base XLSX with styles, then inject VML form control checkboxes
    const baseBuffer: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const finalBuffer = injectFormControls(baseBuffer, checkboxRowIndices);

    return new NextResponse(new Uint8Array(finalBuffer), {
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

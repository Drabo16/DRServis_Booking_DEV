// =====================================================
// OFFERS API - Offer XLSX Export Route
// =====================================================
// Generates a full offer spreadsheet (equivalent of PDF)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiError } from '@/lib/api-response';
import { OFFER_CATEGORY_ORDER, getCategoryGroup, formatOfferNumber } from '@/types/offers';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx-js-style');

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ── Colours ───────────────────────────────────────────────────────────────
const C_BRAND   = '0066B3';
const C_DARK    = '1E293B';
const C_LIGHT   = 'E2E8F0';
const C_ALT     = 'F8FAFC';
const C_WHITE   = 'FFFFFF';
const C_GREEN   = '16A34A';
const C_YELLOW  = 'FEFCE8';
const C_BLUE_LT = 'DBEAFE';

// ── Styles ────────────────────────────────────────────────────────────────
const S = {
  title: {
    font: { bold: true, sz: 15, color: { rgb: C_BRAND } },
    alignment: { horizontal: 'center', vertical: 'center' },
  },
  offerNum: {
    font: { bold: true, sz: 12, color: { rgb: C_DARK } },
    alignment: { horizontal: 'right', vertical: 'center' },
  },
  meta: {
    font: { sz: 10, color: { rgb: '666666' } },
    alignment: { horizontal: 'right', vertical: 'center' },
  },
  infoLabel: {
    font: { bold: true, sz: 10 },
    fill: { fgColor: { rgb: 'F0F4F8' } },
    alignment: { vertical: 'center' },
  },
  infoValue: {
    font: { sz: 10 },
    fill: { fgColor: { rgb: 'F0F4F8' } },
    alignment: { vertical: 'center' },
  },
  catHeader: {
    fill: { fgColor: { rgb: C_DARK } },
    font: { bold: true, sz: 11, color: { rgb: C_WHITE } },
    alignment: { horizontal: 'left', vertical: 'center' },
  },
  tableHead: {
    fill: { fgColor: { rgb: C_LIGHT } },
    font: { bold: true, sz: 9, color: { rgb: '475569' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  },
  tableHeadLeft: {
    fill: { fgColor: { rgb: C_LIGHT } },
    font: { bold: true, sz: 9, color: { rgb: '475569' } },
    alignment: { horizontal: 'left', vertical: 'center' },
  },
  item: {
    font: { sz: 10 },
    alignment: { vertical: 'center', wrapText: false },
  },
  itemAlt: {
    font: { sz: 10 },
    fill: { fgColor: { rgb: C_ALT } },
    alignment: { vertical: 'center', wrapText: false },
  },
  itemSub: {
    font: { sz: 9, color: { rgb: '64748B' } },
    alignment: { vertical: 'center' },
  },
  itemSubAlt: {
    font: { sz: 9, color: { rgb: '64748B' } },
    fill: { fgColor: { rgb: C_ALT } },
    alignment: { vertical: 'center' },
  },
  num: {
    font: { sz: 10 },
    alignment: { horizontal: 'center', vertical: 'center' },
  },
  numAlt: {
    font: { sz: 10 },
    fill: { fgColor: { rgb: C_ALT } },
    alignment: { horizontal: 'center', vertical: 'center' },
  },
  price: {
    font: { sz: 10 },
    numFmt: '#,##0 "Kč"',
    alignment: { horizontal: 'right', vertical: 'center' },
  },
  priceAlt: {
    font: { sz: 10 },
    fill: { fgColor: { rgb: C_ALT } },
    numFmt: '#,##0 "Kč"',
    alignment: { horizontal: 'right', vertical: 'center' },
  },
  priceBold: {
    font: { bold: true, sz: 10 },
    numFmt: '#,##0 "Kč"',
    alignment: { horizontal: 'right', vertical: 'center' },
  },
  catTotal: {
    fill: { fgColor: { rgb: 'F1F5F9' } },
    font: { bold: true, sz: 10 },
    alignment: { horizontal: 'right', vertical: 'center' },
  },
  catTotalLabel: {
    fill: { fgColor: { rgb: 'F1F5F9' } },
    font: { bold: true, sz: 10 },
    alignment: { horizontal: 'right', vertical: 'center' },
  },
  summaryLabel: {
    font: { sz: 10, color: { rgb: '475569' } },
    alignment: { horizontal: 'left', vertical: 'center' },
  },
  summaryValue: {
    font: { bold: true, sz: 10 },
    numFmt: '#,##0 "Kč"',
    alignment: { horizontal: 'right', vertical: 'center' },
  },
  discountLabel: {
    font: { sz: 10, color: { rgb: C_GREEN } },
    alignment: { horizontal: 'left', vertical: 'center' },
  },
  discountValue: {
    font: { bold: true, sz: 10, color: { rgb: C_GREEN } },
    numFmt: '#,##0 "Kč"',
    alignment: { horizontal: 'right', vertical: 'center' },
  },
  totalLabel: {
    font: { bold: true, sz: 12, color: { rgb: C_BRAND } },
    alignment: { horizontal: 'left', vertical: 'center' },
  },
  totalValue: {
    font: { bold: true, sz: 12, color: { rgb: C_BRAND } },
    numFmt: '#,##0 "Kč"',
    alignment: { horizontal: 'right', vertical: 'center' },
  },
  notesBg: {
    fill: { fgColor: { rgb: C_YELLOW } },
    font: { sz: 10, color: { rgb: '713F12' } },
    alignment: { vertical: 'center', wrapText: true },
  },
  validBg: {
    fill: { fgColor: { rgb: C_BLUE_LT } },
    font: { sz: 10, color: { rgb: '1E40AF' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  },
  footer: {
    font: { sz: 9, color: { rgb: '94A3B8' } },
    alignment: { vertical: 'center' },
  },
};

const NUM_COLS = 5; // Položka | Dny | Ks | Kč/ks | Celkem

function calcItemTotal(item: { days_hours: number; quantity: number; unit_price: number }): number {
  return item.days_hours * item.quantity * item.unit_price;
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('cs-CZ', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, id, full_name')
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
      .select(`
        *,
        event:events(id, title, start_time, location),
        client:clients(id, name),
        items:offer_items(*),
        created_by_profile:profiles!offers_created_by_fkey(full_name)
      `)
      .eq('id', id)
      .single();

    if (offerError || !offer) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
    }

    // Sort items
    const sortedItems = ((offer.items || []) as Array<{
      id: string; name: string; subcategory?: string; category: string;
      days_hours: number; quantity: number; unit_price: number; sort_order?: number;
    }>).sort((a, b) => {
      const ai = (OFFER_CATEGORY_ORDER as readonly string[]).indexOf(a.category);
      const bi = (OFFER_CATEGORY_ORDER as readonly string[]).indexOf(b.category);
      const catDiff = (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      return catDiff !== 0 ? catDiff : (a.sort_order || 0) - (b.sort_order || 0);
    });

    // Version name
    let versionName: string | null = null;
    try {
      const { data: v } = await supabase
        .from('offer_versions')
        .select('name')
        .eq('offer_id', id)
        .not('name', 'is', null)
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      versionName = v?.name || null;
    } catch { /* ignore */ }

    // Totals
    let subtotalEquipment = 0, subtotalPersonnel = 0, subtotalTransport = 0;
    for (const item of sortedItems) {
      const total = calcItemTotal(item);
      const group = getCategoryGroup(item.category);
      if (group === 'equipment') subtotalEquipment += total;
      else if (group === 'personnel') subtotalPersonnel += total;
      else subtotalTransport += total;
    }
    const discountAmount = Math.round(subtotalEquipment * ((offer.discount_percent || 0) / 100));
    const totalAmount = subtotalEquipment + subtotalPersonnel + subtotalTransport - discountAmount;

    // Group by category
    const grouped: Record<string, typeof sortedItems> = {};
    for (const item of sortedItems) {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    }

    const ev = offer.event as { title?: string; location?: string; start_time?: string } | null;
    const client = offer.client as { name?: string } | null;
    const creatorName = (offer.created_by_profile as { full_name?: string } | null)?.full_name ?? null;

    const startDate = offer.event_start_date ? formatDate(offer.event_start_date) : null;
    const endDate = offer.event_end_date ? formatDate(offer.event_end_date) : null;
    const eventDateStr = startDate
      ? (endDate && endDate !== startDate ? `${startDate} – ${endDate}` : startDate)
      : (ev?.start_time ? formatDate(ev.start_time) : null);

    // ── Build worksheet ───────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ws: Record<string, any> = {};
    const merges: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }> = [];
    let r = 0;

    const set = (
      row: number, col: number,
      v: string | number, t: string,
      s?: Record<string, unknown>
    ) => {
      const addr = XLSX.utils.encode_cell({ r: row, c: col });
      ws[addr] = { v, t, ...(s ? { s } : {}) };
    };

    const fill = (row: number, s: Record<string, unknown>, from = 0, to = NUM_COLS - 1) => {
      for (let c = from; c <= to; c++) {
        const addr = XLSX.utils.encode_cell({ r: row, c });
        if (!ws[addr]) ws[addr] = { v: '', t: 's', s };
        else ws[addr].s = s;
      }
    };

    const merge = (row: number, from = 0, to = NUM_COLS - 1) =>
      merges.push({ s: { r: row, c: from }, e: { r: row, c: to } });

    // ── Row 0: Title (offer title) ────────────────────────────────────────
    set(r, 0, offer.title || '', 's', S.title);
    fill(r, S.title);
    merge(r); r++;

    // ── Row 1: Offer number right-aligned, left empty ─────────────────────
    set(r, 0, '', 's');
    set(r, 1, '', 's');
    set(r, 2, '', 's');
    const offerNumLabel = `Nabídka č. ${formatOfferNumber(offer.offer_number, offer.year)}`;
    const versionLabel = versionName ? ` | Verze: ${versionName}` : (offer.set_label ? ` | ${offer.set_label}` : '');
    set(r, 3, offerNumLabel + versionLabel, 's', S.offerNum);
    merge(r, 3, 4);
    set(r, 4, '', 's', S.offerNum); r++;

    // ── Row 2: Date ───────────────────────────────────────────────────────
    set(r, 0, '', 's'); set(r, 1, '', 's'); set(r, 2, '', 's');
    set(r, 3, `Vystaveno: ${formatDate(offer.created_at)}`, 's', S.meta);
    merge(r, 3, 4);
    set(r, 4, '', 's', S.meta); r++;

    // ── Spacer ────────────────────────────────────────────────────────────
    r++;

    // ── Info box ──────────────────────────────────────────────────────────
    if (client?.name) {
      set(r, 0, 'Klient:', 's', S.infoLabel);
      set(r, 1, client.name, 's', S.infoValue);
      merge(r, 1, 4);
      fill(r, S.infoValue, 2);
      r++;
    }
    if (ev?.title) {
      const evText = ev.location ? `${ev.title} | ${ev.location}` : ev.title;
      set(r, 0, 'Akce:', 's', S.infoLabel);
      set(r, 1, evText, 's', S.infoValue);
      merge(r, 1, 4);
      fill(r, S.infoValue, 2);
      r++;
    }
    if (eventDateStr) {
      set(r, 0, 'Termín:', 's', S.infoLabel);
      set(r, 1, eventDateStr, 's', S.infoValue);
      merge(r, 1, 4);
      fill(r, S.infoValue, 2);
      r++;
    }

    // ── Spacer ────────────────────────────────────────────────────────────
    r++;

    // ── Categories ────────────────────────────────────────────────────────
    const allCategories = [
      ...OFFER_CATEGORY_ORDER,
      ...Object.keys(grouped).filter(c => !(OFFER_CATEGORY_ORDER as readonly string[]).includes(c)),
    ];

    for (const categoryName of allCategories) {
      const items = grouped[categoryName];
      if (!items || items.length === 0) continue;

      const isTransport = categoryName === 'Doprava';
      const isPersonnel = categoryName === 'Technický personál';

      // Category header
      set(r, 0, categoryName, 's', S.catHeader);
      fill(r, S.catHeader, 1);
      merge(r); r++;

      // Table header
      set(r, 0, 'Položka', 's', S.tableHeadLeft);
      set(r, 1, 'Dny', 's', S.tableHead);
      set(r, 2, isTransport ? 'km' : isPersonnel ? 'Technik' : 'Ks', 's', S.tableHead);
      set(r, 3, isTransport ? 'Kč/km' : isPersonnel ? 'Kč/technik' : 'Kč/ks', 's', S.tableHead);
      set(r, 4, 'Celkem', 's', S.tableHead);
      r++;

      // Items
      let rowIdx = 0;
      for (const item of items) {
        const alt = rowIdx % 2 === 1;
        const sItem = alt ? S.itemAlt : S.item;
        const sNum = alt ? S.numAlt : S.num;
        const sPrice = alt ? S.priceAlt : S.price;

        const itemLabel = item.subcategory ? `${item.name} (${item.subcategory})` : item.name;
        set(r, 0, itemLabel, 's', sItem);
        set(r, 1, item.days_hours, 'n', sNum);
        set(r, 2, item.quantity, 'n', sNum);
        set(r, 3, item.unit_price, 'n', sPrice);
        set(r, 4, calcItemTotal(item), 'n', { ...sPrice, font: { ...(sPrice.font || {}), bold: true } });
        r++;
        rowIdx++;
      }

      // Category total
      const catTotal = items.reduce((sum, item) => sum + calcItemTotal(item), 0);
      set(r, 0, '', 's', S.catTotal); set(r, 1, '', 's', S.catTotal);
      set(r, 2, '', 's', S.catTotal);
      set(r, 3, `${categoryName}:`, 's', S.catTotalLabel);
      set(r, 4, catTotal, 'n', { ...S.catTotal, numFmt: '#,##0 "Kč"' });
      r++;
    }

    // ── Spacer ────────────────────────────────────────────────────────────
    r++;

    // ── Summary ───────────────────────────────────────────────────────────
    const summaryRows: Array<[string, number, Record<string, unknown>, Record<string, unknown>]> = [
      ['Technika celkem:', subtotalEquipment, S.summaryLabel, S.summaryValue],
      ['Technický personál:', subtotalPersonnel, S.summaryLabel, S.summaryValue],
      ['Doprava:', subtotalTransport, S.summaryLabel, S.summaryValue],
    ];

    for (const [label, value, ls, vs] of summaryRows) {
      set(r, 0, '', 's'); set(r, 1, '', 's'); set(r, 2, '', 's');
      set(r, 3, label, 's', ls);
      set(r, 4, value, 'n', vs);
      r++;
    }

    if ((offer.discount_percent || 0) > 0) {
      set(r, 0, '', 's'); set(r, 1, '', 's'); set(r, 2, '', 's');
      set(r, 3, `Sleva na techniku (${offer.discount_percent}%):`, 's', S.discountLabel);
      set(r, 4, -discountAmount, 'n', S.discountValue);
      r++;
    }

    // Total without VAT
    set(r, 0, '', 's'); set(r, 1, '', 's'); set(r, 2, '', 's');
    const totalLabel = offer.is_vat_payer !== false ? 'CELKEM BEZ DPH:' : 'CELKOVÁ CENA:';
    set(r, 3, totalLabel, 's', S.totalLabel);
    set(r, 4, totalAmount, 'n', S.totalValue);
    r++;

    if (offer.is_vat_payer !== false) {
      set(r, 0, '', 's'); set(r, 1, '', 's'); set(r, 2, '', 's');
      set(r, 3, 'DPH (21%):', 's', S.summaryLabel);
      set(r, 4, Math.round(totalAmount * 0.21), 'n', S.summaryValue);
      r++;

      set(r, 0, '', 's'); set(r, 1, '', 's'); set(r, 2, '', 's');
      set(r, 3, 'CELKEM S DPH:', 's', S.totalLabel);
      set(r, 4, Math.round(totalAmount * 1.21), 'n', S.totalValue);
      r++;
    }

    // ── Valid until ───────────────────────────────────────────────────────
    if (offer.valid_until) {
      r++;
      set(r, 0, `Platnost nabídky do: ${formatDate(offer.valid_until)}`, 's', S.validBg);
      fill(r, S.validBg, 1);
      merge(r); r++;
    }

    // ── Notes ─────────────────────────────────────────────────────────────
    if (offer.notes) {
      r++;
      set(r, 0, 'Poznámky:', 's', { ...S.notesBg, font: { bold: true, sz: 10, color: { rgb: '713F12' } } });
      fill(r, S.notesBg, 1);
      merge(r); r++;
      set(r, 0, offer.notes, 's', S.notesBg);
      fill(r, S.notesBg, 1);
      merge(r); r++;
    }

    // ── Footer ────────────────────────────────────────────────────────────
    r++;
    const footerText = creatorName
      ? `DR Servis s.r.o. | www.drservis.cz | Vypracoval: ${creatorName}`
      : 'DR Servis s.r.o. | www.drservis.cz';
    set(r, 0, footerText, 's', S.footer);
    merge(r); r++;

    // ── Finalize worksheet ────────────────────────────────────────────────
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: r - 1, c: NUM_COLS - 1 } });
    ws['!merges'] = merges;
    ws['!cols'] = [
      { wch: 48 }, // Položka
      { wch: 8 },  // Dny
      { wch: 10 }, // Ks
      { wch: 16 }, // Kč/ks
      { wch: 16 }, // Celkem
    ];
    ws['!rows'] = Array.from({ length: r }, (_, i) => {
      if (i === 0) return { hpt: 28 };
      return { hpt: 20 };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Nabídka');

    const filename = `nabidka-${formatOfferNumber(offer.offer_number, offer.year).replace('/', '-')}.xlsx`;
    const xlsxBuffer: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(new Uint8Array(xlsxBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Offer XLSX generation error:', error);
    return apiError('Failed to generate XLSX');
  }
}

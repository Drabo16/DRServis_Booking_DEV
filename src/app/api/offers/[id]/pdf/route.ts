// =====================================================
// OFFERS API - PDF Export Route
// =====================================================
// Generate professional PDF for an offer

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { OfferPdfDocument } from '@/components/offers/OfferPdfDocument';
import { formatOfferNumber } from '@/types/offers';
import { apiError } from '@/lib/api-response';
import fs from 'fs/promises';
import path from 'path';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/offers/[id]/pdf
 * Generate PDF for an offer
 */
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

    // Check module access
    let hasAccess = profile.role === 'admin';
    if (!hasAccess) {
      const { data: moduleAccess } = await supabase
        .from('user_module_access')
        .select('id, module:app_modules!inner(code)')
        .eq('user_id', profile.id)
        .eq('module.code', 'offers')
        .maybeSingle();
      hasAccess = !!moduleAccess;
    }

    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch offer with items, event and client
    const { data: offer, error: offerError } = await supabase
      .from('offers')
      .select(`
        *,
        event:events(id, title, start_time, location),
        client:clients(id, name),
        items:offer_items(*)
      `)
      .eq('id', id)
      .single();

    if (offerError || !offer) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
    }

    // Sort items by category order then sort_order
    const { OFFER_CATEGORY_ORDER } = await import('@/types/offers');
    const sortedItems = (offer.items || []).sort((a: { category: string; sort_order?: number }, b: { category: string; sort_order?: number }) => {
      const catA = (OFFER_CATEGORY_ORDER as readonly string[]).indexOf(a.category);
      const catB = (OFFER_CATEGORY_ORDER as readonly string[]).indexOf(b.category);
      if (catA !== catB) return catA - catB;
      return (a.sort_order || 0) - (b.sort_order || 0);
    });

    // Fetch latest named version for PDF header
    let versionName: string | null = null;
    try {
      const { data: versions } = await supabase
        .from('offer_versions')
        .select('name')
        .eq('offer_id', id)
        .not('name', 'is', null)
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      versionName = versions?.name || null;
    } catch {
      // Optional - ignore errors
    }

    // Read logo as base64
    let logoBase64 = '';
    try {
      const logoPath = path.join(process.cwd(), 'public', 'logo-offers.png');
      const logoBuffer = await fs.readFile(logoPath);
      logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    } catch (e) {
      console.warn('Logo not found, using placeholder');
    }

    // Generate PDF
    const pdfBuffer = await renderToBuffer(
      OfferPdfDocument({
        offer: {
          ...offer,
          items: sortedItems,
          versionName,
        },
        logoBase64,
      })
    );

    // Create filename
    const filename = `nabidka-${formatOfferNumber(offer.offer_number, offer.year).replace('/', '-')}.pdf`;

    // Convert Buffer to Uint8Array for NextResponse compatibility
    const pdfUint8Array = new Uint8Array(pdfBuffer);

    return new NextResponse(pdfUint8Array, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return apiError('Failed to generate PDF');
  }
}

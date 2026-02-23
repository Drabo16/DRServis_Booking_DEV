// =====================================================
// OFFERS API - Project PDF Export Route
// =====================================================
// Generate PDF that looks like a single offer with sub-sections

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { ProjectPdfDocument } from '@/components/offers/ProjectPdfDocument';
import { formatOfferNumber } from '@/types/offers';
import fs from 'fs/promises';
import path from 'path';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/offers/sets/[id]/pdf
 * Generate combined PDF for all offers in a project
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

    // Fetch the offer set with event
    const { data: offerSet, error: setError } = await supabase
      .from('offer_sets')
      .select(`
        *,
        event:events(id, title, start_time, location)
      `)
      .eq('id', id)
      .single();

    if (setError || !offerSet) {
      return NextResponse.json({ error: 'Offer set not found' }, { status: 404 });
    }

    // Fetch all offers in this set with their items
    const { data: offers, error: offersError } = await supabase
      .from('offers')
      .select(`
        *,
        event:events(id, title, start_time, location),
        items:offer_items(*)
      `)
      .eq('offer_set_id', id)
      .order('set_label', { ascending: true });

    if (offersError) {
      throw offersError;
    }

    // Fetch direct items on the project (offer_set_items table)
    let directItems: any[] = [];
    try {
      const { data: setItems } = await supabase
        .from('offer_set_items')
        .select('*')
        .eq('offer_set_id', id)
        .order('category')
        .order('sort_order');
      directItems = setItems || [];
    } catch {
      // Table might not exist yet
    }

    // Sort items in each offer by category and sort_order
    const offersWithSortedItems = (offers || []).map((offer: any) => ({
      ...offer,
      items: (offer.items || []).sort((a: any, b: any) => {
        if (a.category !== b.category) {
          return a.category.localeCompare(b.category);
        }
        return (a.sort_order || 0) - (b.sort_order || 0);
      }),
    }));

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
      ProjectPdfDocument({
        project: offerSet,
        offers: offersWithSortedItems,
        directItems,
        logoBase64,
      })
    );

    // Create filename - use offer number format like single offers
    const offerNum = offerSet.offer_number || 1;
    const offerYear = offerSet.year || new Date().getFullYear();
    const filename = `nabidka-${formatOfferNumber(offerNum, offerYear).replace('/', '-')}.pdf`;

    // Convert Buffer to Uint8Array for NextResponse compatibility
    const pdfUint8Array = new Uint8Array(pdfBuffer);

    return new NextResponse(pdfUint8Array, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Project PDF generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}

// =====================================================
// OFFERS API - Project PDF Export Route
// =====================================================
// Generate combined PDF for all offers in a project (set)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { ProjectPdfDocument } from '@/components/offers/ProjectPdfDocument';
import fs from 'fs';
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

    // Fetch the offer set
    const { data: offerSet, error: setError } = await supabase
      .from('offer_sets')
      .select('*')
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

    if (!offers || offers.length === 0) {
      return NextResponse.json({ error: 'No offers in this project' }, { status: 400 });
    }

    // Sort items in each offer by category and sort_order
    const offersWithSortedItems = offers.map((offer: any) => ({
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
      const logoBuffer = fs.readFileSync(logoPath);
      logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    } catch (e) {
      console.warn('Logo not found, using placeholder');
    }

    // Generate PDF
    const pdfBuffer = await renderToBuffer(
      ProjectPdfDocument({
        project: offerSet,
        offers: offersWithSortedItems,
        logoBase64,
      })
    );

    // Create filename
    const safeName = offerSet.name.replace(/[^a-zA-Z0-9-_]/g, '-').substring(0, 50);
    const filename = `projekt-${safeName}.pdf`;

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

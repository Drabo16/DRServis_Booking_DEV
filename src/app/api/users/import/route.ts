import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthContext, createServiceRoleClient } from '@/lib/supabase/server';
import * as XLSX from 'xlsx';

interface ImportedUser {
  full_name: string;
  email: string;
  phone: string | null;
  is_drservis: boolean;
  company: string | null;
  specialization: string[] | null;
  note: string | null;
}

// Map position names to role type values
const POSITION_MAP: Record<string, string> = {
  'zvukař': 'sound',
  'zvukar': 'sound',
  'sound': 'sound',
  'světla': 'lights',
  'svetla': 'lights',
  'lights': 'lights',
  'vizuál': 'video',
  'vizual': 'video',
  'video': 'video',
  'pódium': 'stage',
  'podium': 'stage',
  'stage': 'stage',
  'podiový technik': 'stage',
  'podiovy technik': 'stage',
  'rigger': 'other',
  'rigger a': 'other',
  'rigger b': 'other',
  'řidič': 'other',
  'ridic': 'other',
  'řidič b': 'other',
  'ridic b': 'other',
  'driver': 'other',
};

function normalizePosition(position: string): string | null {
  const normalized = position.toLowerCase().trim();
  return POSITION_MAP[normalized] || 'other';
}

function parsePositions(positionsStr: string): string[] {
  if (!positionsStr || typeof positionsStr !== 'string') return [];

  // Split by comma, semicolon, or slash
  const positions = positionsStr.split(/[,;\/]/).map(p => p.trim()).filter(Boolean);

  // Map to role type values and deduplicate
  const mapped = positions.map(normalizePosition).filter((p): p is string => p !== null);
  return [...new Set(mapped)];
}

function parseBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    return lower === 'ano' || lower === 'yes' || lower === '1' || lower === 'true' || lower === 'x';
  }
  return false;
}

function formatPhone(phone: unknown): string | null {
  if (!phone) return null;
  // Remove spaces and non-numeric characters except +
  const cleaned = String(phone).replace(/[^\d+]/g, '');
  return cleaned || null;
}

/**
 * POST /api/users/import
 * Import users from XLSX file
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { user, profile, isSupervisor } = await getAuthContext(supabase);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check permission to manage users - only admins/supervisors can import
    const isAdmin = profile.role === 'admin';

    if (!isAdmin && !isSupervisor) {
      return NextResponse.json(
        { error: 'Forbidden - pouze administrátoři mohou importovat uživatele' },
        { status: 403 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const updateExisting = formData.get('updateExisting') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Read file as buffer
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });

    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Convert to JSON - row by row
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      header: 'A',
      defval: ''
    });

    // Skip header row if present
    const dataRows = rows.slice(1);

    const serviceClient = createServiceRoleClient();
    const results = {
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 2; // +2 because we skip header and arrays are 0-indexed

      try {
        // Extract fields based on column letters
        // A = Jméno, B = Příjmení, C = Je DRServis, E = Firma, F = Pozice, G = Telefon, H = Email, J = Poznámka
        const firstName = String(row['A'] || '').trim();
        const lastName = String(row['B'] || '').trim();
        const isDrservis = parseBoolean(row['C']);
        const company = String(row['E'] || '').trim() || null;
        const positions = parsePositions(String(row['F'] || ''));
        const phone = formatPhone(row['G']);
        const email = String(row['H'] || '').trim().toLowerCase();
        const note = String(row['J'] || '').trim() || null;

        // Skip empty rows
        if (!firstName && !lastName && !email) {
          continue;
        }

        // Validate email
        if (!email) {
          results.errors.push(`Řádek ${rowNum}: Chybí email`);
          results.skipped++;
          continue;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          results.errors.push(`Řádek ${rowNum}: Neplatný email "${email}"`);
          results.skipped++;
          continue;
        }

        // Validate name
        const fullName = `${firstName} ${lastName}`.trim();
        if (!fullName) {
          results.errors.push(`Řádek ${rowNum}: Chybí jméno`);
          results.skipped++;
          continue;
        }

        // Check if user exists
        const { data: existingUser } = await serviceClient
          .from('profiles')
          .select('id')
          .eq('email', email)
          .single();

        const userData: ImportedUser = {
          full_name: fullName,
          email,
          phone,
          is_drservis: isDrservis,
          company: isDrservis ? null : company,
          specialization: positions.length > 0 ? positions : null,
          note,
        };

        if (existingUser) {
          if (updateExisting) {
            // Update existing user
            const { error } = await serviceClient
              .from('profiles')
              .update({
                full_name: userData.full_name,
                phone: userData.phone,
                is_drservis: userData.is_drservis,
                company: userData.company,
                specialization: userData.specialization,
                note: userData.note,
              })
              .eq('id', existingUser.id);

            if (error) {
              results.errors.push(`Řádek ${rowNum}: Chyba při aktualizaci - ${error.message}`);
              results.skipped++;
            } else {
              results.updated++;
            }
          } else {
            results.errors.push(`Řádek ${rowNum}: Uživatel s emailem "${email}" již existuje`);
            results.skipped++;
          }
        } else {
          // Create new user
          const { error } = await serviceClient
            .from('profiles')
            .insert({
              id: crypto.randomUUID(),
              email: userData.email,
              full_name: userData.full_name,
              phone: userData.phone,
              role: 'technician', // Default role for imported users
              is_active: true,
              is_drservis: userData.is_drservis,
              company: userData.company,
              specialization: userData.specialization,
              note: userData.note,
            });

          if (error) {
            results.errors.push(`Řádek ${rowNum}: Chyba při vytváření - ${error.message}`);
            results.skipped++;
          } else {
            results.imported++;
          }
        }
      } catch (error) {
        results.errors.push(`Řádek ${rowNum}: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
        results.skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      results,
      message: `Import dokončen: ${results.imported} nových, ${results.updated} aktualizovaných, ${results.skipped} přeskočených`,
    });
  } catch (error) {
    console.error('User import error:', error);
    return NextResponse.json(
      {
        error: 'Failed to import users',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

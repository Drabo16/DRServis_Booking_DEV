// Quick script to apply database migration
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = 'https://syqionhhzoihbbebysvy.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5cWlvbmhoem9paGJiZWJ5c3Z5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMyMjMzMCwiZXhwIjoyMDgzODk4MzMwfQ.OQTWmnJS9lZkj0ejS1eoJkEGhz0PFAHiWPWDNLDXBC8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20260124_fix_offer_set_trigger_ambiguous_columns.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('Applying migration: 20260124_fix_offer_set_trigger_ambiguous_columns.sql');

  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql }).catch(() => {
    // If exec_sql doesn't exist, try direct query
    return supabase.from('_').select('*').limit(0).then(() => {
      // Can't execute DDL through Supabase client, need to use SQL editor
      console.error('Cannot execute DDL through Supabase client.');
      console.log('\nPlease apply this migration manually:');
      console.log('1. Go to https://supabase.com/dashboard/project/syqionhhzoihbbebysvy/sql');
      console.log('2. Paste the following SQL:\n');
      console.log(sql);
      process.exit(1);
    });
  });

  if (error) {
    console.error('Migration failed:', error);
    console.log('\nPlease apply this migration manually:');
    console.log('1. Go to https://supabase.com/dashboard/project/syqionhhzoihbbebysvy/sql');
    console.log('2. Paste the following SQL:\n');
    console.log(sql);
    process.exit(1);
  }

  console.log('✅ Migration applied successfully!');
}

applyMigration();

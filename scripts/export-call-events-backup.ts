import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

async function exportAndEncryptBackup() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data, error } = await supabase
    .from('ultaura_call_events_export_backup')
    .select('*');

  if (error) {
    throw error;
  }

  const jsonData = JSON.stringify(data ?? []);
  const key = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(jsonData, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag().toString('base64');

  const payloadPackage = JSON.stringify({
    encrypted,
    iv: iv.toString('base64'),
    authTag,
    recordCount: data?.length ?? 0,
    exportedAt: new Date().toISOString(),
  });

  const filename = `call-events-backup-${Date.now()}.enc.json`;
  const { error: uploadError } = await supabase.storage
    .from('backups')
    .upload(filename, payloadPackage, {
      contentType: 'application/json',
    });

  if (uploadError) {
    throw uploadError;
  }

  console.log('=== ENCRYPTION KEY (STORE SECURELY) ===');
  console.log(key.toString('base64'));
  console.log('=== END KEY ===');
  console.log(`Backup uploaded to: backups/${filename}`);
  console.log(`Record count: ${data?.length ?? 0}`);
}

exportAndEncryptBackup().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

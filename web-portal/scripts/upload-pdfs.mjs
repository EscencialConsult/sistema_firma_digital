import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '..', '.env.local');
const env = fs.readFileSync(envPath, 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.+)/)?.[1]?.trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();
const supabase = createClient(url, key, { realtime: { transport: (await import('ws')).default } });

const PDF_DIR = 'C:\\Users\\santi\\Desktop\\docs';

const SIGNERS = [
  {
    name: 'Juan Jose Gimenez',
    email: 'juanjose.gimenez@ssrmining.com',
    cuil: '30-67989306-4',
    order: 0,
  },
  {
    name: 'Maria Laura Colque',
    email: 'colquemarialaura@hotmail.com',
    cuil: '27-33225668-3',
    order: 1,
  },
];

async function computeSha256(buffer) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

(async () => {
  const { data: login, error: loginErr } = await supabase.auth.signInWithPassword({
    email: 'colquemarialaura@hotmail.com',
    password: 'laura123456'
  });
  if (loginErr || !login?.user) {
    console.log('Login error:', loginErr?.message);
    process.exit(1);
  }
  console.log('Logueado como:', login.user.email);

  const OWNER_ID = login.user.id;
  const files = fs.readdirSync(PDF_DIR).filter(f => f.endsWith('.pdf'));
  console.log('PDFs encontrados:', files.length);

  for (const fileName of files) {
    const filePath = path.join(PDF_DIR, fileName);
    const buffer = fs.readFileSync(filePath);
    const sha256Hash = await computeSha256(buffer);
    const title = fileName.replace(/\.pdf$/i, '');

    console.log('\n--- Subiendo:', title);

    const sanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
    const storagePath = OWNER_ID + '/' + Date.now() + '_' + sanFileName;
    const { error: upErr } = await supabase.storage
      .from('contract-pdfs')
      .upload(storagePath, buffer, { upsert: true, contentType: 'application/pdf' });
    if (upErr) { console.log('  Upload error:', upErr.message); continue; }
    console.log('  Storage OK');

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Create document with total_signers = 2
    const { data: doc, error: docErr } = await supabase
      .from('documents')
      .insert({
        title,
        owner_id: OWNER_ID,
        template_id: 'custom',
        template_fields: {
          nombre_firmante: SIGNERS[0].name,
          email_firmante: SIGNERS[0].email,
          cuil_firmante: SIGNERS[0].cuil,
          nombre_firmante_2: SIGNERS[1].name,
          email_firmante_2: SIGNERS[1].email,
          cuil_firmante_2: SIGNERS[1].cuil,
        },
        total_signers: 2,
        status: 'SENT',
      })
      .select()
      .single();
    if (docErr || !doc) { console.log('  Doc error:', docErr?.message); continue; }
    console.log('  Document ID:', doc.id);

    // Create document version
    const { error: verErr } = await supabase.from('document_versions').insert({
      document_id: doc.id,
      version_number: 1,
      file_name: fileName,
      storage_path: storagePath,
      sha256_hash: sha256Hash,
      file_size: buffer.length,
      uploaded_by: OWNER_ID,
    });
    if (verErr) { console.log('  Version error:', verErr.message); continue; }
    console.log('  Version OK');

    // Create 2 signature_requests
    for (const signer of SIGNERS) {
      const { data: sr, error: srErr } = await supabase
        .from('signature_requests')
        .insert({
          document_id: doc.id,
          signer_email: signer.email,
          signer_name: signer.name,
          signer_cuil: signer.cuil,
          status: 'PENDING',
          expires_at: expiresAt,
          signing_order: signer.order,
        })
        .select('id')
        .single();
      if (srErr || !sr) { console.log('  SR error for', signer.name, ':', srErr?.message); continue; }
      console.log('  SR creado para', signer.name, '->', sr.id);

      await supabase.functions.invoke('send-signing-email', {
        body: { signerEmail: signer.email, signerName: signer.name, documentTitle: title, requestId: sr.id }
      }).catch(() => {});
    }

    console.log('  OK:', title);
  }

  console.log('\n=== Todos los PDFs subidos con doble firma ===');
})().catch(e => console.error('FATAL:', e.message));

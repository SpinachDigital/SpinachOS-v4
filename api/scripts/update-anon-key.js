// Update SUPABASE_ANON_KEY in api/.env from a temp file (key never enters chat/logs).
// Usage: node scripts/update-anon-key.js <temp-file-with-key>
const fs = require('fs');
const path = require('path');

const tmpFile = process.argv[2];
if (!tmpFile || !fs.existsSync(tmpFile)) {
  console.log('usage: node scripts/update-anon-key.js <temp-file-with-key>');
  process.exit(1);
}

const newKey = fs.readFileSync(tmpFile, 'utf8').trim();
if (!newKey.startsWith('sb_publishable_')) {
  console.log('ERROR: key does not start with sb_publishable_ — not updating');
  process.exit(2);
}

const envPath = path.join(__dirname, '..', '.env');
const content = fs.readFileSync(envPath, 'utf8');
const lines = content.split('\n');
let found = false;
const updated = lines.map(l => {
  if (l.startsWith('SUPABASE_ANON_KEY=')) {
    found = true;
    return 'SUPABASE_ANON_KEY=' + newKey;
  }
  return l;
});
if (!found) updated.push('SUPABASE_ANON_KEY=' + newKey);
fs.writeFileSync(envPath, updated.join('\n'));
// delete the temp file immediately
fs.unlinkSync(tmpFile);
console.log('SUPABASE_ANON_KEY updated:', newKey.slice(0, 14) + '…' + newKey.slice(-6), '(temp file deleted)');
console.log('found in env:', found);

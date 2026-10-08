require('fs');
const path = require('path');
const envPath = path.join('C:/Users/Abhishek/SpinachOS-v4/api/scripts', '..', '.env');
for (const line of require('fs').readFileSync(envPath,'utf8').split('\n')) { const m=line.match(/^([A-Z_]+)=(.*)$/); if(m && !process.env[m[1]]) process.env[m[1]]=m[2]; }
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  // Print the portal invite/magic-link state needed for the screenshot session:
  // 1. an active client invite (or create one) with its redeem link
  const { data: clients } = await sb.from('clients').select('id, name, status').limit(5);
  console.log('clients:', JSON.stringify(clients));
  const { data: invites } = await sb.from('client_invites').select('id, client_id, token_hash, expires_at, redeemed_at').order('created_at', { ascending: false }).limit(5);
  console.log('invites:', JSON.stringify(invites));
})();
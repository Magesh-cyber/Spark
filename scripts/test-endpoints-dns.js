process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const domains = [
  'https://api.rong-api.com',
  'https://api-sg.rongcloud.net',
  'https://api-sg.ronghub.com',
  'https://api.ronghub.com',
  'https://api-na.ronghub.com',
  'https://api-sg.nexconn.ai',
  'https://api.nexconn.ai',
  'https://api-na.nexconn.ai',
  'https://api.sg-light-api.com',
  'https://api-b.sg-light-api.com',
  'https://api.us-light-api.com',
];

async function checkDomains() {
  for (const d of domains) {
    try {
      const res = await fetch(`${d}/user/getToken.json`, { method: 'POST' });
      const text = await res.text();
      const isBlocked = text.includes('Fortinet') || text.includes('Blocked');
      console.log(`Domain: ${d.padEnd(35)} | Status: ${res.status} | Blocked: ${isBlocked} | Response: ${text.substring(0, 60).replace(/\n/g, '')}`);
    } catch (e) {
      console.log(`Domain: ${d.padEnd(35)} | Error: ${e.message}`);
    }
  }
}

checkDomains();


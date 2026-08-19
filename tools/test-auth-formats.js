const https = require('https');

function testXboxAuth(ticket) {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      Properties: {
        AuthMethod: 'RPS',
        SiteName: 'user.auth.xboxlive.com',
        RpsTicket: ticket
      },
      RelyingParty: 'http://auth.xboxlive.com',
      TokenType: 'JWT'
    });

    const req = https.request({
      hostname: 'user.auth.xboxlive.com',
      port: 443,
      path: '/user/authenticate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-xbl-contract-version': '1',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        resolve({ status: res.statusCode, data });
      });
    });

    req.on('error', (e) => resolve({ error: e.message }));
    req.write(postData);
    req.end();
  });
}

async function run() {
  const dummyRes = await testXboxAuth("test_ticket");
  console.log("Dummy Xbox Auth Response:", dummyRes);
}

run();

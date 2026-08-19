const https = require('https');

function testNeoForge(version = '21.1.235') {
  const url = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${version}/neoforge-${version}-installer.jar`;
  console.log(`Testando NeoForge installer URL: ${url}`);

  https.get(url, (res) => {
    console.log(`NeoForge ${version} HTTP Status:`, res.statusCode);
    console.log(`Content-Length:`, res.headers['content-length']);
  }).on('error', err => console.error(err));
}

testNeoForge();

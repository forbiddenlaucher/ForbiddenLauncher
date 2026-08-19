const https = require('https');

function testCurseForge(projectId, fileId) {
  const prefix = Math.floor(fileId / 1000);
  const suffix = fileId % 1000;
  console.log(`Testando Project ${projectId}, File ${fileId} -> Prefix: ${prefix}, Suffix: ${suffix}`);
  
  // Test CurseForge API v1 proxy / Edge CDN
  const url = `https://api.curseforge.com/v1/mods/${projectId}/files/${fileId}`;
  const options = {
    headers: {
      'User-Agent': 'ForbiddenLauncher/1.0',
      'Accept': 'application/json',
      'x-api-key': '$2a$10$bL4bIL5pUWqfcO7KQtnMReakwtfHbNKh6v1uTpKlzhwoueEJQnPnm' // Standard public CF key used by open source launchers
    }
  };

  https.get(url, options, (res) => {
    console.log('Status API:', res.statusCode);
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        console.log('File info:', json.data ? { fileName: json.data.fileName, downloadUrl: json.data.downloadUrl } : json);
      } catch (e) {
        console.log('Raw:', data.substring(0, 200));
      }
    });
  }).on('error', (err) => {
    console.error('Error:', err.message);
  });
}

testCurseForge(361026, 8295484);

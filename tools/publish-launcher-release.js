/**
 * Forbidden Launcher - Automated Launcher Release & Upload Helper
 * 
 * Usage:
 *   node tools/publish-launcher-release.js --version 1.0.4
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
function getArg(name, def = null) {
  const idx = args.indexOf(`--${name}`);
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  return def;
}

function getGitHubToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN.trim();
  const tokenFile = path.join(__dirname, '../.token');
  if (fs.existsSync(tokenFile)) return fs.readFileSync(tokenFile, 'utf8').trim();
  return '';
}

const GITHUB_TOKEN = getGitHubToken();
const REPO = 'forbiddenlaucher/ForbiddenLauncher';

const newVersion = getArg('version');
if (!newVersion) {
  console.error('❌ Especifique a versão: node tools/publish-launcher-release.js --version 1.0.4');
  process.exit(1);
}

console.log(`\n🚀 [LAUNCHER RELEASE] Iniciando lançamento da versão v${newVersion}...`);

// 1. Git pull rebase first
try {
  console.log(`🔄 Sincronizando com o repositório remoto...`);
  execSync(`git pull origin master --rebase`, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
} catch (e) {}

// 2. Update package.json
const pkgPath = path.join(__dirname, '../package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
console.log(`✅ package.json atualizado para versão: ${newVersion}`);

// 3. Build Executable
console.log(`\n🔨 Compilando o executável (.exe) com electron-builder...`);
execSync('npm run dist', { stdio: 'inherit', cwd: path.join(__dirname, '..') });

const exeName = `Forbidden Requiem Launcher Setup ${newVersion}.exe`;
const exePath = path.join(__dirname, '../dist', exeName);

if (!fs.existsSync(exePath)) {
  console.error(`❌ Arquivo executável não encontrado em: ${exePath}`);
  process.exit(1);
}

const stats = fs.statSync(exePath);
console.log(`\n📦 Instalador pronto: ${exeName} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

// 4. Git Commit & Tag & Push
console.log(`\n🏷️ Criando commit e enviando tag v${newVersion} ao GitHub...`);
try {
  execSync(`git add .`, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  execSync(`git commit -m "Release v${newVersion}"`, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  execSync(`git tag v${newVersion}`, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  execSync(`git push origin master --tags`, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  console.log(`✅ Código e tags enviados ao GitHub!`);
} catch (e) {
  console.log(`⚠️ Commit ou tag já existente, prosseguindo com release...`);
}

// 5. Create GitHub Release & Upload Executable Asset
console.log(`\n🌐 Publicando Release oficial no GitHub Releases...`);
const body = JSON.stringify({
  tag_name: `v${newVersion}`,
  name: `Forbidden Requiem Launcher v${newVersion}`,
  body: `## ⚔️ Forbidden Requiem Launcher v${newVersion}\n\nLançamento oficial da versão v${newVersion}.`,
  draft: false,
  prerelease: false
});

const req = https.request({
  hostname: 'api.github.com',
  path: `/repos/${REPO}/releases`,
  method: 'POST',
  headers: {
    'User-Agent': 'NodeJS',
    'Authorization': `token ${GITHUB_TOKEN}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  }
}, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    let rel = {};
    try { rel = JSON.parse(d); } catch (e) {}
    const releaseId = rel.id;
    if (releaseId) {
      console.log(`✅ Release criado no GitHub (ID: ${releaseId})`);
      console.log(`⬆️ Enviando instalador .exe (${(stats.size / 1024 / 1024).toFixed(2)} MB)...`);

      const fileStream = fs.createReadStream(exePath);
      const upReq = https.request({
        hostname: 'uploads.github.com',
        path: `/repos/${REPO}/releases/${releaseId}/assets?name=Forbidden.Requiem.Launcher.Setup.${newVersion}.exe`,
        method: 'POST',
        headers: {
          'User-Agent': 'NodeJS',
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Content-Type': 'application/octet-stream',
          'Content-Length': stats.size
        }
      }, (upRes) => {
        let d2 = '';
        upRes.on('data', c => d2 += c);
        upRes.on('end', () => {
          console.log(`\n🎉 SUCESSO TOTAL! Release v${newVersion} e instalador .exe publicados com sucesso!`);
          console.log(`🔗 Link: https://github.com/${REPO}/releases/tag/v${newVersion}\n`);
        });
      });
      fileStream.pipe(upReq);
    } else {
      console.log(`⚠️ Release já existe ou resposta da API:`, d);
    }
  });
});
req.write(body);
req.end();

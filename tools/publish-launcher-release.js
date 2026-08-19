/**
 * Forbidden Launcher - Automated Launcher Release & Upload Helper
 * 
 * Usage:
 *   node tools/publish-launcher-release.js --version 1.0.3
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

const newVersion = getArg('version');
if (!newVersion) {
  console.error('❌ Especifique a versão: node tools/publish-launcher-release.js --version 1.0.3');
  process.exit(1);
}

const REPO = 'forbiddenlaucher/ForbiddenLauncher';
const pkgPath = path.join(__dirname, '../package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
console.log(`✅ package.json atualizado para versão: ${newVersion}`);

// 1. Build Executable
console.log(`\n🔨 Compilando o executável com electron-builder...`);
execSync('npm run dist', { stdio: 'inherit', cwd: path.join(__dirname, '..') });

const exeName = `Forbidden Requiem Launcher Setup ${newVersion}.exe`;
const exePath = path.join(__dirname, '../dist', exeName);

if (!fs.existsSync(exePath)) {
  console.error(`❌ Arquivo executável não encontrado em: ${exePath}`);
  process.exit(1);
}

const stats = fs.statSync(exePath);
console.log(`\n📦 Instalador pronto: ${exeName} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

// 2. Git Commit & Tag
console.log(`\n🏷️ Criando commit e tag v${newVersion}...`);
try {
  execSync(`git commit -am "Release v${newVersion}"`, { stdio: 'inherit' });
  execSync(`git tag v${newVersion}`, { stdio: 'inherit' });
  execSync(`git push origin master --tags`, { stdio: 'inherit' });
  console.log(`✅ Tag v${newVersion} enviada ao GitHub com sucesso!`);
} catch (e) {
  console.log(`⚠️ Tag ou commit já existente, prosseguindo...`);
}

console.log(`\n🚀 Concluído! O GitHub Release está disponível para os jogadores.`);

/**
 * Forbidden Launcher - Modpack Release Helper
 * 
 * Usage:
 *   node tools/publish-modpack-update.js --pack forbidden-requiem --version 1.0.1
 *   node tools/publish-modpack-update.js --pack atm10 --version 1.0.1
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const args = process.argv.slice(2);
function getArg(name, def = null) {
  const idx = args.indexOf(`--${name}`);
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  return def;
}

const packId = getArg('pack', 'atm10');
const newVersion = getArg('version', null);

const appData = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + '/.local/share');
const instancePath = path.join(appData, 'ForbiddenLauncher', 'instances', packId);
const modsDir = path.join(instancePath, '.minecraft', 'mods');
const catalogPath = path.join(__dirname, '..', 'catalog.json');

function calculateSha256(filePath) {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

console.log(`\n📦 [MODPACK RELEASE HELPER] Iniciando empacotamento para: ${packId}`);
console.log(`📁 Diretório da instância: ${instancePath}`);

if (!fs.existsSync(modsDir)) {
  console.error(`❌ Diretório de mods não encontrado: ${modsDir}`);
  process.exit(1);
}

// Read all mod files
const modFiles = fs.readdirSync(modsDir).filter(f => f.endsWith('.jar'));
console.log(`🔍 Total de mods encontrados: ${modFiles.length}`);

const manifest = {
  id: packId,
  name: packId === 'atm10' ? 'All The Mods 10 (ATM Brasil)' : 'Forbidden Requiem',
  version: newVersion || '1.0.1',
  minecraft: {
    version: packId === 'atm10' ? '1.21.1' : '1.7.10',
    loader: packId === 'atm10' ? 'neoforge' : 'forge'
  },
  server: {
    ip: packId === 'atm10' ? 'allthemods.com.br' : 'play.forbiddenrequiem.com',
    port: 25565
  },
  files: []
};

for (const modFile of modFiles) {
  const filePath = path.join(modsDir, modFile);
  const stats = fs.statSync(filePath);
  const hash = calculateSha256(filePath);

  manifest.files.push({
    path: `mods/${modFile}`,
    size: stats.size,
    sha256: hash
  });
}

const manifestFileName = `${packId}-manifest.json`;
const manifestOutPath = path.join(__dirname, '..', manifestFileName);
fs.writeFileSync(manifestOutPath, JSON.stringify(manifest, null, 2), 'utf8');
console.log(`✅ Manifesto gerado em: ${manifestOutPath}`);

// Update catalog.json if exists
if (fs.existsSync(catalogPath)) {
  try {
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    const p = (catalog.modpacks || []).find(m => m.id === packId);
    if (p) {
      if (newVersion) p.latestVersion = newVersion;
      fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf8');
      console.log(`✅ catalog.json atualizado com a versão: ${newVersion || p.latestVersion}`);
    }
  } catch (e) {
    console.error('⚠️ Erro ao atualizar catalog.json:', e.message);
  }
}

console.log(`\n🚀 Pronto! Para enviar para os jogadores:`);
console.log(`  1. Faça commit e push no GitHub:`);
console.log(`     git add .`);
console.log(`     git commit -m "Update modpack ${packId} to v${newVersion || '1.0.1'}"`);
console.log(`     git push`);
console.log(`  2. Todos os jogadores receberão o botão [ATUALIZAR] automaticamente no Launcher!\n`);

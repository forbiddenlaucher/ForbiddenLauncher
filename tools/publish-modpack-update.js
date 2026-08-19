/**
 * Forbidden Launcher - Smart Modpack Differential Update Helper
 * 
 * Usage:
 *   node tools/publish-modpack-update.js --pack atm10 --version 10.0.1
 *   node tools/publish-modpack-update.js --pack forbidden-requiem --version 1.0.1
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const AdmZip = require('adm-zip');

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
const manifestFileName = `${packId}-manifest.json`;
const manifestOutPath = path.join(__dirname, '..', manifestFileName);

function calculateSha256(filePath) {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

console.log(`\n======================================================`);
console.log(`  🛡️ FORBIDDEN LAUNCHER - SMART MODPACK DIFF ENGINE`);
console.log(`======================================================`);
console.log(`📦 Modpack: ${packId}`);
console.log(`📁 Pasta de Mods: ${modsDir}`);

if (!fs.existsSync(modsDir)) {
  console.error(`❌ Diretório de mods não encontrado: ${modsDir}`);
  process.exit(1);
}

// 1. Load previous manifest if exists
let oldManifest = null;
if (fs.existsSync(manifestOutPath)) {
  try {
    oldManifest = JSON.parse(fs.readFileSync(manifestOutPath, 'utf8'));
  } catch (e) {}
}

const oldFilesMap = new Map();
if (oldManifest && Array.isArray(oldManifest.files)) {
  for (const f of oldManifest.files) {
    oldFilesMap.set(f.path, f.sha256);
  }
}

// 2. Scan current local mods
const modFiles = fs.readdirSync(modsDir).filter(f => f.endsWith('.jar'));
console.log(`🔍 Total de mods atuais na pasta: ${modFiles.length}`);

const currentFilesMap = new Map();
const newManifestFiles = [];
const addedOrModified = [];

for (const modFile of modFiles) {
  const relPath = `mods/${modFile}`;
  const filePath = path.join(modsDir, modFile);
  const stats = fs.statSync(filePath);
  const hash = calculateSha256(filePath);

  currentFilesMap.set(relPath, hash);

  const oldHash = oldFilesMap.get(relPath);
  if (!oldHash || oldHash !== hash) {
    addedOrModified.push({ file: modFile, fullPath: filePath, size: stats.size, sha256: hash });
  }

  // Base raw URL format for GitHub or CDN
  const rawUrl = `https://raw.githubusercontent.com/forbiddenlaucher/ForbiddenLauncher/master/instances/${packId}/.minecraft/mods/${encodeURIComponent(modFile)}`;

  newManifestFiles.push({
    path: relPath,
    size: stats.size,
    sha256: hash,
    url: rawUrl
  });
}

// 3. Find removed mods
const removedMods = [];
for (const [oldRelPath] of oldFilesMap) {
  if (!currentFilesMap.has(oldRelPath)) {
    removedMods.push(path.basename(oldRelPath));
  }
}

console.log(`\n📊 [RELATÓRIO DE ALTERAÇÕES - DELTA PATCH]:`);
console.log(`  🟢 Mods Novos / Atualizados: ${addedOrModified.length}`);
if (addedOrModified.length > 0) {
  addedOrModified.slice(0, 10).forEach(m => console.log(`     + ${m.file} (${(m.size / 1024 / 1024).toFixed(2)} MB)`));
  if (addedOrModified.length > 10) console.log(`     ... e mais ${addedOrModified.length - 10} mods.`);
}

console.log(`  🔴 Mods Removidos (serão deletados do PC dos players): ${removedMods.length}`);
if (removedMods.length > 0) {
  removedMods.forEach(m => console.log(`     - ${m}`));
}

console.log(`  ⚪ Mods Iguais (não precisarão ser baixados): ${modFiles.length - addedOrModified.length}`);

// 4. Generate new manifest
const manifest = {
  id: packId,
  name: packId === 'atm10' ? 'All The Mods 10 (ATM Brasil)' : 'Forbidden Requiem',
  version: newVersion || (oldManifest ? oldManifest.version : '1.0.1'),
  minecraft: {
    version: packId === 'atm10' ? '1.21.1' : '1.7.10',
    loader: packId === 'atm10' ? 'neoforge' : 'forge',
    loaderVersion: packId === 'atm10' ? 'neoforge-21.1.187' : '10.13.4.1614'
  },
  server: {
    ip: packId === 'atm10' ? 'allthemods.com.br' : 'play.forbiddenrequiem.com',
    port: 25565
  },
  files: newManifestFiles
};

fs.writeFileSync(manifestOutPath, JSON.stringify(manifest, null, 2), 'utf8');
console.log(`\n✅ Novo manifesto gerado em: ${manifestOutPath}`);

// 5. Update catalog.json
if (fs.existsSync(catalogPath)) {
  try {
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    const p = (catalog.modpacks || []).find(m => m.id === packId);
    if (p) {
      if (newVersion) p.latestVersion = newVersion;
      p.totalModsCount = modFiles.length;
      fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf8');
      console.log(`✅ catalog.json atualizado para versão: ${newVersion || p.latestVersion} (${modFiles.length} mods)`);
    }
  } catch (e) {
    console.error('⚠️ Erro ao atualizar catalog.json:', e.message);
  }
}

console.log(`\n======================================================`);
console.log(`🚀 SUCESSO!`);
console.log(`Para publicar a atualização para todos os jogadores:`);
console.log(`  git add .`);
console.log(`  git commit -m "Update ${packId} to v${newVersion || '1.0.1'}: +${addedOrModified.length} mods, -${removedMods.length} mods"`);
console.log(`  git push`);
console.log(`======================================================\n`);

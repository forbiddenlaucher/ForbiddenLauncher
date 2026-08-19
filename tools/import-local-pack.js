const fs = require('fs');
const path = require('path');

// Helper to copy directory recursively
function copyDirSync(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function importLocalAtmPack() {
  const sourceFolder = path.join('C:', 'Users', 'takamura', 'Downloads', 'All The Mods Brasil');
  const appData = process.env.APPDATA || (process.platform === 'darwin' ? path.join(process.env.HOME, 'Library', 'Application Support') : path.join(process.env.HOME, '.config'));
  const targetInstanceDir = path.join(appData, 'ForbiddenLauncher', 'instances', 'atm10');
  const targetGameDir = path.join(targetInstanceDir, '.minecraft');

  console.log(`Verificando pasta de origem: ${sourceFolder}`);
  if (!fs.existsSync(sourceFolder)) {
    console.error(`Pasta de origem não encontrada: ${sourceFolder}`);
    return;
  }

  const overridesFolder = path.join(sourceFolder, 'overrides');
  if (fs.existsSync(overridesFolder)) {
    console.log(`Copiando overrides para ${targetGameDir}...`);
    copyDirSync(overridesFolder, targetGameDir);
    console.log(`✓ Overrides copiados com sucesso!`);
  }

  // Create or copy manifest.json
  const manifestDest = path.join(targetInstanceDir, 'manifest.json');
  const manifestData = {
    schemaVersion: 1,
    id: "atm10",
    name: "All the Mods 10 (ATM Brasil)",
    version: "10.0.0",
    minecraft: {
      version: "1.21.1",
      loader: {
        type: "neoforge",
        version: "21.1.235"
      }
    },
    java: {
      majorVersion: 21,
      distribution: "temurin"
    },
    memory: {
      recommendedMb: 8192,
      minimumMb: 6144
    },
    totalModsCount: 484,
    estimatedSizeMb: 2200,
    server: {
      name: "All The Mods 10 • Servidor Oficial",
      address: "atm.forbiddenrequiem.com",
      port: 25565
    },
    files: []
  };

  fs.writeFileSync(manifestDest, JSON.stringify(manifestData, null, 2), 'utf8');

  // Instance state
  const instanceStateDest = path.join(targetInstanceDir, 'instance.json');
  const instanceStateData = {
    id: "atm10",
    installedVersion: "10.0.0",
    installedAt: new Date().toISOString(),
    lastPlayed: null
  };
  fs.writeFileSync(instanceStateDest, JSON.stringify(instanceStateData, null, 2), 'utf8');

  console.log(`✓ Instância atm10 configurada e vinculada com sucesso em ${targetInstanceDir}`);
}

importLocalAtmPack().catch(console.error);

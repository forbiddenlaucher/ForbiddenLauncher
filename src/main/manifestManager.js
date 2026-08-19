const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const downloader = require('./downloader');
const configStore = require('./configStore');

class ManifestManager {
  constructor() {
    this.defaultCatalog = {
      schemaVersion: 1,
      generatedAt: "2026-08-18T18:00:00Z",
      modpacks: [
        {
          id: "forbidden-requiem",
          name: "Forbidden Requiem",
          minecraftVersion: "1.7.10",
          loader: "forge",
          loaderVersion: "10.13.4.1614",
          latestVersion: "1.0.0",
          totalModsCount: 84,
          tagline: "Comece sua jornada em uma terra de dark fantasy, com os grandes mods da era de ouro do Minecraft 1.7.10.",
          theme: "dark-fantasy",
          javaMajorVersion: 8,
          memory: { recommendedMb: 4096, minimumMb: 2048 },
          server: { name: "Forbidden Requiem • Servidor Oficial", address: "play.forbiddenrequiem.com", port: 25565 },
          manifestUrl: "https://raw.githubusercontent.com/forbiddenlaucher/ForbiddenLauncher/master/forbidden-requiem-manifest.json",
          featuredMods: [
            { name: "Thaumcraft 4", category: "Magia Oculta", description: "Manipule o Vis e desvende os mistérios proibidos da taumaturgia e do vazio." },
            { name: "Blood Magic", category: "Alquimia de Sangue", description: "Sacrifique essência vital em altares de sangue para canalizar magias colossais." },
            { name: "Twilight Forest", category: "Dimensão Sombria", description: "Uma floresta mística governada por titãs e feras lendárias." },
            { name: "Witchery", category: "Bruxaria & Covens", description: "Rituais de invocação, maldições, vampirismo e licantropia nas noites sombrias." },
            { name: "Tinkers' Construct", category: "Forja Medieval", description: "Funda ligas proibidas de metais para forjar armas de corte e destruição." },
            { name: "Grimoire of Gaia 3", category: "Bestiário Sombrio", description: "Criaturas mitológicas implacáveis à espreita na escuridão." }
          ]
        },
        {
          id: "atm10",
          name: "All the Mods 10 (ATM Brasil)",
          minecraftVersion: "1.21.1",
          loader: "neoforge",
          loaderVersion: "21.1.235",
          latestVersion: "10.0.0",
          totalModsCount: 484,
          tagline: "Explore, automatize e avance até conquistar a ATM Star — um objetivo que exige dominar quase todos os mods :D",
          theme: "atm10",
          javaMajorVersion: 21,
          memory: { recommendedMb: 8192, minimumMb: 6144 },
          server: { name: "All The Mods 10 • Servidor Oficial", address: "allthemods.com.br", port: 25565 },
          manifestUrl: "https://raw.githubusercontent.com/forbiddenlaucher/ForbiddenLauncher/master/atm10-manifest.json",
          featuredMods: [
            { name: "Mekanism & Generators", category: "Alta Tecnologia", description: "Processamento avançado de minérios x5, reatores de fusão e energia massiva." },
            { name: "Applied Energistics 2", category: "Armazenamento ME", description: "Redes quânticas de armazenamento digital e autocrafting automatizado." },
            { name: "Ars Nouveau", category: "Magia Personalizada", description: "Crie seus próprios feitiços arcanos, familiares e rituais." },
            { name: "Create & Addons", category: "Engenharia Cinética", description: "Engrenagens, trens customizados, moinhos e esteiras rotativas." },
            { name: "AllTheModium", category: "Metais Místicos", description: "Allthemodium, Vibranium e Unobtainium na jornada para a lendária ATM Star." },
            { name: "Mystical Agriculture", category: "Cultivo de Recursos", description: "Plante e colha todos os minérios e essências do jogo." }
          ]
        }
      ]
    };
  }

  getCatalogCachePath() {
    return path.join(configStore.getBaseDir(), 'cache', 'catalog.json');
  }

  async getCatalog() {
    const catalogUrl = configStore.get('catalogUrl');
    const cachePath = this.getCatalogCachePath();

    if (catalogUrl && catalogUrl.startsWith('http')) {
      try {
        const tempPath = path.join(configStore.getBaseDir(), 'cache', 'temp_catalog.json');
        await downloader.downloadFile(catalogUrl, tempPath, { timeout: 6000 });
        const data = JSON.parse(fs.readFileSync(tempPath, 'utf8'));
        fs.writeFileSync(cachePath, JSON.stringify(data, null, 2), 'utf8');
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        return data;
      } catch (e) {
        console.warn('Falha ao baixar catálogo remoto, usando cache ou padrão:', e.message);
      }
    }

    if (fs.existsSync(cachePath)) {
      try {
        return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      } catch (e) {}
    }

    // Check project catalog.json
    const localProjCatalog = path.join(__dirname, '../../catalog.json');
    if (fs.existsSync(localProjCatalog)) {
      try {
        return JSON.parse(fs.readFileSync(localProjCatalog, 'utf8'));
      } catch (e) {}
    }

    return this.defaultCatalog;
  }

  getInstanceManifestPath(packId) {
    const instConfig = configStore.getInstanceConfig(packId);
    return path.join(path.dirname(instConfig.gameDir), 'manifest.json');
  }

  getLocalManifest(packId) {
    const p = this.getInstanceManifestPath(packId);
    if (fs.existsSync(p)) {
      try {
        return JSON.parse(fs.readFileSync(p, 'utf8'));
      } catch (e) {}
    }
    return null;
  }

  async getRemoteManifest(packId, manifestUrl) {
    if (manifestUrl && manifestUrl.startsWith('http')) {
      try {
        const tempPath = path.join(configStore.getBaseDir(), 'cache', `temp_manifest_${packId}.json`);
        await downloader.downloadFile(manifestUrl, tempPath, { timeout: 8000 });
        const data = JSON.parse(fs.readFileSync(tempPath, 'utf8'));
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        return data;
      } catch (e) {}
    }

    // Check local fallback manifest in project root
    const localFallback = path.join(__dirname, `../../${packId}-manifest.json`);
    if (fs.existsSync(localFallback)) {
      try {
        return JSON.parse(fs.readFileSync(localFallback, 'utf8'));
      } catch (e) {}
    }

    const catalog = await this.getCatalog();
    const entry = catalog.modpacks.find(m => m.id === packId);
    return {
      schemaVersion: 1,
      id: packId,
      name: entry ? entry.name : packId,
      version: entry ? entry.latestVersion : '1.0.0',
      minecraft: { version: entry ? entry.minecraftVersion : '1.7.10', loader: { type: entry ? entry.loader : 'forge', version: entry ? entry.loaderVersion : '10.13.4.1614' } },
      java: { majorVersion: entry ? entry.javaMajorVersion : 8 },
      memory: entry ? entry.memory : { recommendedMb: 4096, minimumMb: 2048 },
      server: entry ? entry.server : { name: "Server", address: "localhost", port: 25565 },
      files: []
    };
  }

  getFolderSizeBytes(dirPath) {
    let total = 0;
    if (!fs.existsSync(dirPath)) return 0;
    try {
      const items = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const item of items) {
        const full = path.join(dirPath, item.name);
        if (item.isDirectory()) {
          total += this.getFolderSizeBytes(full);
        } else if (item.isFile()) {
          total += fs.statSync(full).size;
        }
      }
    } catch (e) {}
    return total;
  }

  async checkModpackStatus(packId) {
    const catalog = await this.getCatalog();
    const packEntry = catalog.modpacks.find(m => m.id === packId) || catalog.modpacks[0];
    const remoteManifest = await this.getRemoteManifest(packId, packEntry.manifestUrl);
    const localManifest = this.getLocalManifest(packId);

    const instConfig = configStore.getInstanceConfig(packId);
    const gameDir = instConfig.gameDir;
    const installedBytes = fs.existsSync(gameDir) ? this.getFolderSizeBytes(gameDir) : 0;

    let installedSizeFormatted = '0 MB';
    if (installedBytes > 1024 * 1024 * 1024) {
      installedSizeFormatted = `${(installedBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    } else if (installedBytes > 0) {
      installedSizeFormatted = `${(installedBytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    if (!localManifest || !fs.existsSync(gameDir)) {
      return {
        installed: false,
        needsUpdate: false,
        packInfo: packEntry,
        manifest: remoteManifest,
        installedBytes: 0,
        installedSizeFormatted: 'Não instalado',
        filesToDownload: remoteManifest.files || []
      };
    }

    if (localManifest.version !== remoteManifest.version) {
      return {
        installed: true,
        needsUpdate: true,
        packInfo: packEntry,
        manifest: remoteManifest,
        installedBytes,
        installedSizeFormatted,
        filesToDownload: remoteManifest.files || []
      };
    }

    const filesToDownload = [];
    for (const file of (remoteManifest.files || [])) {
      const filePath = path.join(gameDir, file.path);
      if (!fs.existsSync(filePath)) {
        filesToDownload.push(file);
      } else if (file.sha256) {
        const localHash = await downloader.getFileHash(filePath, 'sha256');
        if (localHash !== file.sha256.toLowerCase()) {
          filesToDownload.push(file);
        }
      }
    }

    return {
      installed: true,
      needsUpdate: filesToDownload.length > 0,
      packInfo: packEntry,
      manifest: remoteManifest,
      installedBytes,
      installedSizeFormatted,
      filesToDownload
    };
  }

  async syncModpackFiles(packId, manifest, onProgress = () => {}) {
    const instConfig = configStore.getInstanceConfig(packId);
    const gameDir = instConfig.gameDir;
    if (!fs.existsSync(gameDir)) {
      fs.mkdirSync(gameDir, { recursive: true });
    }

    const files = manifest.files || [];
    const downloadQueue = [];

    // 1. Direct .ZIP package download (MediaFire / GitHub / Google Drive)
    const downloadZipUrl = manifest.downloadUrl || (manifest.packInfo && manifest.packInfo.downloadUrl);
    if (downloadZipUrl && downloadZipUrl.startsWith('http') && files.length === 0) {
      const tempZipPath = path.join(configStore.getBaseDir(), 'cache', `${packId}_bundle.zip`);
      onProgress({
        phase: 'sync',
        message: 'Baixando pacote completo do modpack...',
        percentage: 10
      });

      await downloader.downloadFile(downloadZipUrl, tempZipPath, {
        onProgress: (p) => {
          onProgress({
            phase: 'sync',
            message: `Baixando pacote do modpack (${(p.receivedBytes / (1024 * 1024)).toFixed(1)} MB)...`,
            percentage: p.totalBytes > 0 ? (p.receivedBytes / p.totalBytes) * 100 : 50,
            downloadedBytes: p.receivedBytes,
            totalBytes: p.totalBytes,
            speedBytesPerSec: p.speedBytesPerSec
          });
        }
      });

      onProgress({
        phase: 'sync',
        message: 'Extraindo arquivos do modpack...',
        percentage: 90
      });

      try {
        const zip = new AdmZip(tempZipPath);
        zip.extractAllTo(gameDir, true);
      } catch (err) {
        console.error('Erro ao descompactar zip do modpack:', err);
      } finally {
        if (fs.existsSync(tempZipPath)) {
          try { fs.unlinkSync(tempZipPath); } catch (e) {}
        }
      }
    }

    // 2. Individual file synchronization (Incremental mods update)
    for (const file of files) {
      if (!file.url) continue;
      const dest = path.join(gameDir, file.path);
      let needsDownload = true;

      if (fs.existsSync(dest) && file.sha256) {
        const hash = await downloader.getFileHash(dest, 'sha256');
        if (hash === file.sha256.toLowerCase()) {
          needsDownload = false;
        }
      }

      if (needsDownload) {
        downloadQueue.push({
          url: file.url,
          dest,
          hash: file.sha256,
          hashAlgorithm: 'sha256',
          size: file.size || 0
        });
      }
    }

    if (downloadQueue.length > 0) {
      onProgress({
        phase: 'sync',
        message: `Baixando arquivos do modpack (${downloadQueue.length} restantes)...`,
        percentage: 0
      });

      await downloader.downloadBatch(downloadQueue, (p) => {
        onProgress({
          phase: 'sync',
          message: `Baixando ${p.currentFile} (${p.completedItems + 1}/${p.totalItems})`,
          percentage: p.percentage,
          downloadedBytes: p.downloadedBytes,
          totalBytes: p.totalBytes,
          speedBytesPerSec: p.speedBytesPerSec
        });
      });
    }

    // 3. Automatic cleanup of deleted / removed mods (Delta Cleanup)
    const localModsDir = path.join(gameDir, 'mods');
    if (fs.existsSync(localModsDir) && files.length > 0) {
      const validModFileNames = new Set(files.filter(f => f.path.startsWith('mods/')).map(f => path.basename(f.path)));

      try {
        const localModFiles = fs.readdirSync(localModsDir);
        for (const localMod of localModFiles) {
          if (localMod.endsWith('.jar') && !validModFileNames.has(localMod)) {
            const obsoleteFilePath = path.join(localModsDir, localMod);
            try {
              fs.unlinkSync(obsoleteFilePath);
              console.log(`[DELTA CLEANUP] Mod removido com sucesso: ${localMod}`);
            } catch (err) {
              console.warn(`Não foi possível remover mod: ${localMod}`);
            }
          }
        }
      } catch (e) {}
    }

    // Check if local pack overrides exist (e.g. All The Mods Brasil in Downloads)
    if (packId === 'atm10') {
      const localDownloadsPack = path.join(process.env.USERPROFILE || 'C:\\Users\\takamura', 'Downloads', 'All The Mods Brasil', 'overrides');
      if (fs.existsSync(localDownloadsPack)) {
        onProgress({
          phase: 'sync',
          message: 'Sincronizando configurações e mods locais do ATM Brasil...',
          percentage: 50
        });
        const copyDirRecursive = (src, dest) => {
          if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
          const entries = fs.readdirSync(src, { withFileTypes: true });
          for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            if (entry.isDirectory()) {
              copyDirRecursive(srcPath, destPath);
            } else {
              fs.copyFileSync(srcPath, destPath);
            }
          }
        };
        try {
          copyDirRecursive(localDownloadsPack, gameDir);
        } catch (e) {}
      }
    }

    const localManifestPath = this.getInstanceManifestPath(packId);
    const instanceDir = path.dirname(localManifestPath);
    if (!fs.existsSync(instanceDir)) {
      fs.mkdirSync(instanceDir, { recursive: true });
    }
    fs.writeFileSync(localManifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    // Save instance.json state
    const instanceStatePath = path.join(instanceDir, 'instance.json');
    const stateData = {
      id: packId,
      installedVersion: manifest.version || '1.0.0',
      installedAt: new Date().toISOString(),
      lastPlayed: null
    };
    fs.writeFileSync(instanceStatePath, JSON.stringify(stateData, null, 2), 'utf8');

    return true;
  }
}

module.exports = new ManifestManager();

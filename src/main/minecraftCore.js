const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const downloader = require('./downloader');

class MinecraftCore {
  constructor() {
    this.versionManifestUrl = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
  }

  /**
   * Fetches version metadata for any Minecraft version from Mojang
   */
  async getVersionJson(gameDir, versionId = '1.7.10') {
    const versionsDir = path.join(gameDir, 'versions', versionId);
    const localVersionJson = path.join(versionsDir, `${versionId}.json`);

    if (fs.existsSync(localVersionJson)) {
      try {
        return JSON.parse(fs.readFileSync(localVersionJson, 'utf8'));
      } catch (e) {}
    }

    // Fetch Mojang manifest
    const tempManifest = path.join(gameDir, 'temp_manifest.json');
    await downloader.downloadFile(this.versionManifestUrl, tempManifest);
    const manifest = JSON.parse(fs.readFileSync(tempManifest, 'utf8'));
    if (fs.existsSync(tempManifest)) fs.unlinkSync(tempManifest);

    const versionMeta = manifest.versions.find(v => v.id === versionId);
    if (!versionMeta) {
      throw new Error(`Versão ${versionId} não encontrada no repositório da Mojang`);
    }

    if (!fs.existsSync(versionsDir)) {
      fs.mkdirSync(versionsDir, { recursive: true });
    }

    await downloader.downloadFile(versionMeta.url, localVersionJson);
    return JSON.parse(fs.readFileSync(localVersionJson, 'utf8'));
  }

  /**
   * Installs Minecraft client jar, libraries, assets and natives for any version
   */
  async installVanilla(gameDir, versionId = '1.7.10', onProgress = () => {}) {
    const versionsDir = path.join(gameDir, 'versions', versionId);
    const clientJarPath = path.join(versionsDir, `${versionId}.jar`);
    const librariesDir = path.join(gameDir, 'libraries');
    const nativesDir = path.join(gameDir, 'natives');
    const assetsDir = path.join(gameDir, 'assets');

    [versionsDir, librariesDir, nativesDir, assetsDir].forEach(d => {
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    });

    onProgress({ phase: 'init', message: `Obtendo manifesto do Minecraft ${versionId}...`, percentage: 5 });
    const versionJson = await this.getVersionJson(gameDir, versionId);

    // 1. Download Client JAR
    if (!fs.existsSync(clientJarPath)) {
      onProgress({ phase: 'client', message: `Baixando Minecraft ${versionId} Client JAR...`, percentage: 10 });
      await downloader.downloadFile(versionJson.downloads.client.url, clientJarPath, {
        expectedHash: versionJson.downloads.client.sha1,
        hashAlgorithm: 'sha1'
      });
    }

    // 2. Download Libraries & Collect Natives
    const downloadQueue = [];
    const nativeZips = [];

    for (const lib of (versionJson.libraries || [])) {
      // Check OS rules
      let allowed = true;
      if (lib.rules) {
        allowed = false;
        for (const rule of lib.rules) {
          if (rule.action === 'allow') {
            if (!rule.os || rule.os.name === 'windows') allowed = true;
          } else if (rule.action === 'disallow') {
            if (rule.os && rule.os.name === 'windows') allowed = false;
          }
        }
      }
      if (!allowed) continue;

      // Standard artifact
      if (lib.downloads && lib.downloads.artifact) {
        const dest = path.join(librariesDir, lib.downloads.artifact.path);
        if (!fs.existsSync(dest)) {
          downloadQueue.push({
            url: lib.downloads.artifact.url,
            dest,
            hash: lib.downloads.artifact.sha1,
            hashAlgorithm: 'sha1',
            size: lib.downloads.artifact.size
          });
        }
      }

      // Natives for windows
      if (lib.natives && lib.natives.windows && lib.downloads && lib.downloads.classifiers) {
        const classifierKey = lib.natives.windows.replace('${arch}', process.arch === 'x64' ? '64' : '32');
        const nativeDownload = lib.downloads.classifiers[classifierKey];
        if (nativeDownload) {
          const nativeDest = path.join(librariesDir, nativeDownload.path);
          nativeZips.push(nativeDest);
          if (!fs.existsSync(nativeDest)) {
            downloadQueue.push({
              url: nativeDownload.url,
              dest: nativeDest,
              hash: nativeDownload.sha1,
              hashAlgorithm: 'sha1',
              size: nativeDownload.size
            });
          }
        }
      }
    }

    if (downloadQueue.length > 0) {
      onProgress({ phase: 'libraries', message: `Baixando bibliotecas (${downloadQueue.length} arquivos)...`, percentage: 20 });
      await downloader.downloadBatch(downloadQueue, (p) => {
        onProgress({
          phase: 'libraries',
          message: `Baixando bibliotecas: ${p.currentFile}`,
          percentage: 20 + (p.percentage * 0.3),
          downloadedBytes: p.downloadedBytes,
          totalBytes: p.totalBytes,
          speedBytesPerSec: p.speedBytesPerSec
        });
      });
    }

    // 3. Extract Natives
    onProgress({ phase: 'natives', message: 'Extraindo arquivos nativos...', percentage: 55 });
    for (const natZipPath of nativeZips) {
      if (fs.existsSync(natZipPath)) {
        try {
          const zip = new AdmZip(natZipPath);
          const zipEntries = zip.getEntries();
          for (const entry of zipEntries) {
            if (!entry.isDirectory && !entry.entryName.startsWith('META-INF')) {
              const target = path.join(nativesDir, path.basename(entry.entryName));
              fs.writeFileSync(target, entry.getData());
            }
          }
        } catch (e) {
          console.warn(`Erro extraindo nativas de ${natZipPath}:`, e.message);
        }
      }
    }

    // 4. Assets Index & Objects
    if (versionJson.assetIndex) {
      const assetIndexName = versionJson.assets || versionId;
      const assetIndexPath = path.join(assetsDir, 'indexes', `${assetIndexName}.json`);
      if (!fs.existsSync(assetIndexPath)) {
        onProgress({ phase: 'assets_index', message: 'Baixando índice de recursos (assets)...', percentage: 60 });
        await downloader.downloadFile(versionJson.assetIndex.url, assetIndexPath);
      }

      if (fs.existsSync(assetIndexPath)) {
        try {
          const assetIndex = JSON.parse(fs.readFileSync(assetIndexPath, 'utf8'));
          const assetDownloads = [];

          for (const [key, obj] of Object.entries(assetIndex.objects || {})) {
            const hashPrefix = obj.hash.substring(0, 2);
            const objPath = path.join(assetsDir, 'objects', hashPrefix, obj.hash);
            if (!fs.existsSync(objPath)) {
              assetDownloads.push({
                url: `https://resources.download.minecraft.net/${hashPrefix}/${obj.hash}`,
                dest: objPath,
                hash: obj.hash,
                hashAlgorithm: 'sha1',
                size: obj.size
              });
            }
          }

          if (assetDownloads.length > 0) {
            onProgress({ phase: 'assets', message: `Baixando sons e recursos (${assetDownloads.length} arquivos)...`, percentage: 65 });
            await downloader.downloadBatch(assetDownloads, (p) => {
              onProgress({
                phase: 'assets',
                message: `Baixando recursos: ${p.completedItems}/${p.totalItems}`,
                percentage: 65 + (p.percentage * 0.25),
                downloadedBytes: p.downloadedBytes,
                totalBytes: p.totalBytes,
                speedBytesPerSec: p.speedBytesPerSec
              });
            });
          }
        } catch (e) {}
      }
    }

    onProgress({ phase: 'complete', message: `Minecraft ${versionId} pronto!`, percentage: 90 });
    return { clientJarPath, nativesDir, librariesDir, assetsDir };
  }
}

module.exports = new MinecraftCore();

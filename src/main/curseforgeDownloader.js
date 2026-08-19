const fs = require('fs');
const path = require('path');
const https = require('https');
const downloader = require('./downloader');

class CurseforgeDownloader {
  constructor() {
    this.apiKey = '$2a$10$bL4bIL5pUWqfcO7KQtnMReakwtfHbNKh6v1uTpKlzhwoueEJQnPnm';
  }

  async getFileInfo(projectId, fileId) {
    return new Promise((resolve) => {
      const url = `https://api.curseforge.com/v1/mods/${projectId}/files/${fileId}`;
      const options = {
        headers: {
          'User-Agent': 'ForbiddenLauncher/1.0',
          'Accept': 'application/json',
          'x-api-key': this.apiKey
        },
        timeout: 10000
      };

      https.get(url, options, (res) => {
        if (res.statusCode !== 200) {
          return resolve(null);
        }
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(raw);
            if (parsed.data) {
              const file = parsed.data;
              const downloadUrl = file.downloadUrl || `https://edge.forgecdn.net/files/${Math.floor(fileId / 1000)}/${fileId % 1000}/${encodeURIComponent(file.fileName)}`;
              resolve({
                fileName: file.fileName,
                downloadUrl,
                fileLength: file.fileLength || 0,
                hashes: file.hashes || []
              });
            } else {
              resolve(null);
            }
          } catch (e) {
            resolve(null);
          }
        });
      }).on('error', () => resolve(null));
    });
  }

  /**
   * Resolves and downloads all CurseForge mods from manifest.json into gameDir/mods
   */
  async syncCurseForgeMods(gameDir, files = [], onProgress = () => {}) {
    const modsDir = path.join(gameDir, 'mods');
    if (!fs.existsSync(modsDir)) {
      fs.mkdirSync(modsDir, { recursive: true });
    }

    const downloadQueue = [];
    const totalFiles = files.length;

    onProgress({
      phase: 'cf_resolve',
      message: `Consultando links oficiais de ${totalFiles} mods do ATM Brasil...`,
      percentage: 5
    });

    // Resolve URLs in batches of 15
    const batchSize = 15;
    for (let i = 0; i < files.length; i += batchSize) {
      const chunk = files.slice(i, i + batchSize);
      const promises = chunk.map(f => this.getFileInfo(f.projectID, f.fileID));
      const results = await Promise.all(promises);

      results.forEach(res => {
        if (res && res.fileName && res.downloadUrl) {
          const dest = path.join(modsDir, res.fileName);
          if (!fs.existsSync(dest) || (res.fileLength && fs.statSync(dest).size !== res.fileLength)) {
            downloadQueue.push({
              url: res.downloadUrl,
              dest,
              size: res.fileLength || 0
            });
          }
        }
      });

      const pct = 5 + Math.round(((i + chunk.length) / totalFiles) * 20);
      onProgress({
        phase: 'cf_resolve',
        message: `Identificados ${downloadQueue.length} mods para download (${Math.min(i + chunk.length, totalFiles)}/${totalFiles})...`,
        percentage: pct
      });
    }

    if (downloadQueue.length > 0) {
      onProgress({
        phase: 'cf_download',
        message: `Baixando ${downloadQueue.length} mods do All The Mods 10...`,
        percentage: 25
      });

      await downloader.downloadBatch(downloadQueue, (p) => {
        onProgress({
          phase: 'cf_download',
          message: `Baixando mods: ${p.currentFile} (${p.completedItems + 1}/${p.totalItems})`,
          percentage: 25 + (p.percentage * 0.55),
          downloadedBytes: p.downloadedBytes,
          totalBytes: p.totalBytes,
          speedBytesPerSec: p.speedBytesPerSec
        });
      });
    }

    onProgress({
      phase: 'cf_complete',
      message: `Todos os mods do ATM Brasil foram instalados com sucesso!`,
      percentage: 80
    });

    return true;
  }
}

module.exports = new CurseforgeDownloader();

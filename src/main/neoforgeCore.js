const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const downloader = require('./downloader');

class NeoForgeCore {
  constructor() {
    this.defaultVersion = '21.1.235';
    this.mcVersion = '1.21.1';
  }

  async isNeoForgeInstalled(gameDir, version = this.defaultVersion) {
    const versionDir = path.join(gameDir, 'versions', `neoforge-${version}`);
    const versionJson = path.join(versionDir, `neoforge-${version}.json`);
    return fs.existsSync(versionJson);
  }

  async installNeoForge(gameDir, java21Path, version = this.defaultVersion, onProgress = () => {}) {
    const isInstalled = await this.isNeoForgeInstalled(gameDir, version);
    if (isInstalled) {
      onProgress({ phase: 'neoforge', message: `NeoForge ${version} já instalado.`, percentage: 100 });
      return true;
    }

    // NeoForge installer requires launcher_profiles.json to exist in the game directory
    const profilesJson = path.join(gameDir, 'launcher_profiles.json');
    if (!fs.existsSync(profilesJson)) {
      fs.writeFileSync(profilesJson, JSON.stringify({ profiles: {}, version: 3 }, null, 2), 'utf8');
    }

    const tempDir = path.join(gameDir, 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const installerUrl = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${version}/neoforge-${version}-installer.jar`;
    const installerPath = path.join(tempDir, `neoforge-${version}-installer.jar`);

    if (!fs.existsSync(installerPath)) {
      onProgress({ phase: 'neoforge_download', message: `Baixando instalador do NeoForge ${version}...`, percentage: 20 });
      await downloader.downloadFile(installerUrl, installerPath);
    }

    onProgress({ phase: 'neoforge_exec', message: `Instalando e compilando NeoForge ${version}...`, percentage: 50 });

    return new Promise((resolve, reject) => {
      const args = ['-jar', installerPath, '--install-client', gameDir];
      execFile(java21Path, args, { cwd: gameDir }, (error, stdout, stderr) => {
        // Cleanup installer
        if (fs.existsSync(installerPath)) {
          try { fs.unlinkSync(installerPath); } catch (e) {}
        }

        if (error) {
          console.error('Erro instalando NeoForge:', stderr || stdout || error.message);
          return reject(new Error(`Falha no instalador do NeoForge: ${error.message}`));
        }

        onProgress({ phase: 'neoforge_done', message: `NeoForge ${version} instalado com sucesso!`, percentage: 100 });
        resolve(true);
      });
    });
  }
}

module.exports = new NeoForgeCore();

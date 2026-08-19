const { app, shell } = require('electron');
const https = require('https');

// Default GitHub repository for launcher releases
const DEFAULT_REPO = 'forbiddenlaucher/ForbiddenLauncher';

class LauncherUpdater {
  constructor() {
    this.repo = DEFAULT_REPO;
    this.currentVersion = app.isPackaged ? app.getVersion() : require('../../package.json').version;
  }

  setRepository(repoFullName) {
    if (repoFullName) this.repo = repoFullName;
  }

  /**
   * Checks GitHub Releases API for new launcher versions
   */
  async checkForUpdates() {
    return new Promise((resolve) => {
      const options = {
        hostname: 'api.github.com',
        path: `/repos/${this.repo}/releases/latest`,
        method: 'GET',
        headers: {
          'User-Agent': `ForbiddenLauncher/${this.currentVersion}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const release = JSON.parse(data);
              const latestTag = (release.tag_name || '').replace(/^v/, '');
              const currentClean = this.currentVersion.replace(/^v/, '');

              const isNewer = this.compareVersions(latestTag, currentClean) > 0;

              // Find .exe asset if available
              let downloadUrl = release.html_url;
              if (Array.isArray(release.assets)) {
                const exeAsset = release.assets.find(a => a.name.endsWith('.exe'));
                if (exeAsset) {
                  downloadUrl = exeAsset.browser_download_url;
                }
              }

              resolve({
                updateAvailable: isNewer,
                currentVersion: this.currentVersion,
                latestVersion: latestTag,
                releaseName: release.name || `Versão ${latestTag}`,
                releaseNotes: release.body || '',
                downloadUrl: downloadUrl,
                publishedAt: release.published_at
              });
            } else {
              resolve({ updateAvailable: false, currentVersion: this.currentVersion });
            }
          } catch (e) {
            resolve({ updateAvailable: false, error: e.message, currentVersion: this.currentVersion });
          }
        });
      });

      req.on('error', (err) => {
        resolve({ updateAvailable: false, error: err.message, currentVersion: this.currentVersion });
      });

      req.setTimeout(5000, () => {
        req.destroy();
        resolve({ updateAvailable: false, error: 'Timeout ao checar atualizações', currentVersion: this.currentVersion });
      });

      req.end();
    });
  }

  /**
   * Compares semver strings (v1 > v2 => 1, v1 < v2 => -1, v1 == v2 => 0)
   */
  compareVersions(v1, v2) {
    const parts1 = (v1 || '').split('.').map(n => parseInt(n, 10) || 0);
    const parts2 = (v2 || '').split('.').map(n => parseInt(n, 10) || 0);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    return 0;
  }

  openDownloadPage(url) {
    if (url) shell.openExternal(url);
  }
}

module.exports = new LauncherUpdater();

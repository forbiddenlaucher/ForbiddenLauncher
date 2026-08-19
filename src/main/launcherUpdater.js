const { app, shell } = require('electron');
const https = require('https');

// Default GitHub repository for launcher releases
const DEFAULT_REPO = 'forbiddenlaucher/ForbiddenLauncher';

function httpsGet(path) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.github.com',
      path: path,
      method: 'GET',
      headers: {
        'User-Agent': 'ForbiddenLauncher-Updater',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ ok: true, data: JSON.parse(data) });
          } else {
            resolve({ ok: false, status: res.statusCode });
          }
        } catch (e) {
          resolve({ ok: false, error: e.message });
        }
      });
    });

    req.on('error', (err) => resolve({ ok: false, error: err.message }));
    req.setTimeout(6000, () => {
      req.destroy();
      resolve({ ok: false, error: 'Timeout' });
    });
    req.end();
  });
}

class LauncherUpdater {
  constructor() {
    this.repo = DEFAULT_REPO;
    this.currentVersion = (app && app.isPackaged) ? app.getVersion() : require('../../package.json').version;
  }

  setRepository(repoFullName) {
    if (repoFullName) this.repo = repoFullName;
  }

  /**
   * Checks GitHub Releases and GitHub Tags for new launcher versions
   */
  async checkForUpdates() {
    try {
      this.currentVersion = (app && app.isPackaged) ? app.getVersion() : require('../../package.json').version;
      const currentClean = (this.currentVersion || '1.0.0').replace(/^v/, '');

      // 1. Try Releases API
      const releaseRes = await httpsGet(`/repos/${this.repo}/releases/latest`);
      if (releaseRes.ok && releaseRes.data) {
        const release = releaseRes.data;
        const latestTag = (release.tag_name || '').replace(/^v/, '');
        const isNewer = this.compareVersions(latestTag, currentClean) > 0;

        let downloadUrl = release.html_url || `https://github.com/${this.repo}/releases`;
        if (Array.isArray(release.assets)) {
          const exeAsset = release.assets.find(a => a.name.endsWith('.exe'));
          if (exeAsset) downloadUrl = exeAsset.browser_download_url;
        }

        return {
          updateAvailable: isNewer,
          currentVersion: this.currentVersion,
          latestVersion: latestTag,
          releaseName: release.name || `Versão ${latestTag}`,
          releaseNotes: release.body || '',
          downloadUrl: downloadUrl
        };
      }

      // 2. Fallback to Tags API (if no formal release is created yet)
      const tagsRes = await httpsGet(`/repos/${this.repo}/tags?per_page=10`);
      if (tagsRes.ok && Array.isArray(tagsRes.data) && tagsRes.data.length > 0) {
        // Find highest semver tag
        let highestTag = null;
        for (const t of tagsRes.data) {
          const clean = (t.name || '').replace(/^v/, '');
          if (!highestTag || this.compareVersions(clean, highestTag) > 0) {
            highestTag = clean;
          }
        }

        if (highestTag) {
          const isNewer = this.compareVersions(highestTag, currentClean) > 0;
          return {
            updateAvailable: isNewer,
            currentVersion: this.currentVersion,
            latestVersion: highestTag,
            releaseName: `Nova Versão v${highestTag}`,
            releaseNotes: 'Melhorias de desempenho e novas funcionalidades.',
            downloadUrl: `https://github.com/${this.repo}/releases`
          };
        }
      }

      return { updateAvailable: false, currentVersion: this.currentVersion };
    } catch (err) {
      return { updateAvailable: false, error: err.message, currentVersion: this.currentVersion };
    }
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

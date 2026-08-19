const fs = require('fs');
const path = require('path');
const os = require('os');

class ConfigStore {
  constructor() {
    this.defaultBaseDir = path.join(
      process.env.APPDATA || (process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Application Support') : path.join(os.homedir(), '.config')),
      'ForbiddenLauncher'
    );

    this.configPath = path.join(this.defaultBaseDir, 'config.json');
    this.ensureDirectoryExists(this.defaultBaseDir);
    this.ensureDirectoryExists(path.join(this.defaultBaseDir, 'instances'));
    this.ensureDirectoryExists(path.join(this.defaultBaseDir, 'runtimes'));
    this.ensureDirectoryExists(path.join(this.defaultBaseDir, 'cache'));

    this.defaults = {
      username: 'ShadowSeeker',
      authType: 'offline',
      activePack: 'forbidden-requiem',
      catalogUrl: 'https://raw.githubusercontent.com/ForbiddenRequiem/Modpack/main/catalog.json',
      windowWidth: 1240,
      windowHeight: 760,
      fullscreen: false,
      autoCloseOnLaunch: false,
      launchAction: 'minimize-tray', // 'minimize-tray' | 'close' | 'keep'
      ecoMode: false, // Disables particles and heavy visual effects
      closeToTray: false,
      instances: {
        'forbidden-requiem': {
          maxRam: 4096,
          minRam: 2048,
          javaMajor: 8,
          customJavaPath: '',
          gameDir: path.join(this.defaultBaseDir, 'instances', 'forbidden-requiem', '.minecraft'),
          serverHost: 'play.forbiddenrequiem.com',
          serverPort: 25565
        },
        'atm10': {
          maxRam: 8192,
          minRam: 6144,
          javaMajor: 21,
          customJavaPath: '',
          gameDir: path.join(this.defaultBaseDir, 'instances', 'atm10', '.minecraft'),
          serverHost: 'allthemods.com.br',
          serverPort: 25565
        }
      }
    };

    this.config = this.loadConfig();
  }

  ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
      try {
        fs.mkdirSync(dirPath, { recursive: true });
      } catch (err) {
        console.error(`Falha ao criar pasta: ${dirPath}`, err);
      }
    }
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf8');
        const parsed = JSON.parse(raw);
        return {
          ...this.defaults,
          ...parsed,
          instances: {
            ...this.defaults.instances,
            ...(parsed.instances || {})
          }
        };
      }
    } catch (e) {
      console.warn('Usando configurações padrão:', e.message);
    }
    return { ...this.defaults };
  }

  saveConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    try {
      this.ensureDirectoryExists(path.dirname(this.configPath));
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
      return true;
    } catch (e) {
      console.error('Falha ao salvar config:', e);
      return false;
    }
  }

  get(key) {
    return this.config[key] !== undefined ? this.config[key] : this.defaults[key];
  }

  getInstanceConfig(packId) {
    const inst = this.config.instances && this.config.instances[packId];
    return inst || this.defaults.instances[packId] || this.defaults.instances['forbidden-requiem'];
  }

  saveInstanceConfig(packId, instConfig) {
    if (!this.config.instances) this.config.instances = {};
    this.config.instances[packId] = { ...(this.config.instances[packId] || {}), ...instConfig };
    return this.saveConfig(this.config);
  }

  getAll() {
    return { ...this.config };
  }

  getBaseDir() {
    return this.defaultBaseDir;
  }
}

module.exports = new ConfigStore();

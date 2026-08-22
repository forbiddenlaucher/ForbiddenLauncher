const { ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const configStore = require('./configStore');
const javaManager = require('./javaManager');
const minecraftCore = require('./minecraftCore');
const forgeCore = require('./forgeCore');
const neoforgeCore = require('./neoforgeCore');
const curseforgeDownloader = require('./curseforgeDownloader');
const manifestManager = require('./manifestManager');
const gameLauncher = require('./gameLauncher');
const serverPing = require('./serverPing');
const microsoftAuth = require('./microsoftAuth');
const launcherUpdater = require('./launcherUpdater');

function registerIpcHandlers(mainWindow) {
  const sendToWindow = (channel, data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, data);
    }
  };

  // 1. Config Handlers
  ipcMain.handle('config:get', () => {
    return configStore.getAll();
  });

  ipcMain.handle('config:save', (event, newConfig) => {
    return configStore.saveConfig(newConfig);
  });

  ipcMain.handle('config:save-instance', (event, packId, instConfig) => {
    return configStore.saveInstanceConfig(packId, instConfig);
  });

  // 2. Catalog & Status
  ipcMain.handle('catalog:get', async () => {
    return await manifestManager.getCatalog();
  });

  ipcMain.handle('instance:check-status', async (event, packId) => {
    return await manifestManager.checkModpackStatus(packId);
  });

  // 3. Install Instance (Forbidden Requiem or ATM 10)
  ipcMain.handle('instance:install', async (event, packId) => {
    const catalog = await manifestManager.getCatalog();
    const packEntry = catalog.modpacks.find(m => m.id === packId);
    if (!packEntry) {
      throw new Error(`Modpack ${packId} não encontrado no catálogo`);
    }

    const instConfig = configStore.getInstanceConfig(packId);
    const gameDir = instConfig.gameDir;
    const targetJavaMajor = packEntry.javaMajorVersion || 8;

    try {
      sendToWindow('install:log', { level: 'INFO', message: `Iniciando preparação de ${packEntry.name}...` });

      // Step 1: Java Runtime
      sendToWindow('install:progress', { packId, phase: 'java', message: `Verificando Java ${targetJavaMajor}...`, percentage: 5 });
      let javaPath = await javaManager.getBestJavaPath(targetJavaMajor);
      if (!javaPath) {
        sendToWindow('install:log', { level: 'INFO', message: `Baixando Java ${targetJavaMajor} (Adoptium Temurin)...` });
        javaPath = await javaManager.installBundledJava(targetJavaMajor, (p) => {
          sendToWindow('install:progress', {
            packId,
            phase: 'java',
            message: p.message,
            percentage: 5 + (p.percentage * 0.15),
            speedBytesPerSec: p.speedBytesPerSec
          });
        });
      }
      sendToWindow('install:log', { level: 'INFO', message: `Java ${targetJavaMajor} pronto em: ${javaPath}` });

      // Step 2: Minecraft Vanilla Core (Supports 1.7.10, 1.21.1, etc.)
      sendToWindow('install:progress', { packId, phase: 'minecraft', message: `Instalando base do Minecraft ${packEntry.minecraftVersion}...`, percentage: 20 });
      await minecraftCore.installVanilla(gameDir, packEntry.minecraftVersion, (p) => {
        sendToWindow('install:progress', {
          packId,
          phase: 'minecraft',
          message: p.message,
          percentage: 20 + (p.percentage * 0.3),
          downloadedBytes: p.downloadedBytes,
          totalBytes: p.totalBytes,
          speedBytesPerSec: p.speedBytesPerSec
        });
      });

      // Step 2.5: Loader installation (Forge 1.7.10 or NeoForge 1.21.1)
      if (packEntry.minecraftVersion === '1.7.10' && packEntry.loader === 'forge') {
        sendToWindow('install:progress', { packId, phase: 'forge', message: 'Instalando Forge 10.13.4.1614...', percentage: 50 });
        await forgeCore.installForge(gameDir, (p) => {
          sendToWindow('install:progress', {
            packId,
            phase: 'forge',
            message: p.message,
            percentage: 50 + (p.percentage * 0.15),
            downloadedBytes: p.downloadedBytes,
            totalBytes: p.totalBytes,
            speedBytesPerSec: p.speedBytesPerSec
          });
        });
      } else if (packEntry.loader === 'neoforge') {
        const neoVer = packEntry.loaderVersion || '21.1.235';
        sendToWindow('install:progress', { packId, phase: 'neoforge', message: `Instalando NeoForge ${neoVer}...`, percentage: 50 });
        await neoforgeCore.installNeoForge(gameDir, javaPath, neoVer, (p) => {
          sendToWindow('install:progress', {
            packId,
            phase: 'neoforge',
            message: p.message,
            percentage: 50 + (p.percentage * 0.15)
          });
        });
      }

      // Step 3: Modpack Files & CurseForge Mods Sync
      const remoteManifest = await manifestManager.getRemoteManifest(packId, packEntry.manifestUrl);

      // Check if manifest has CurseForge mods to download (like ATM 10)
      const cfManifestPath = path.join(process.env.USERPROFILE || 'C:\\Users\\takamura', 'Downloads', 'All The Mods Brasil', 'manifest.json');
      let curseFiles = (remoteManifest && remoteManifest.files) || [];
      if (curseFiles.length === 0 && fs.existsSync(cfManifestPath)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(cfManifestPath, 'utf8'));
          curseFiles = parsed.files || [];
        } catch (e) {}
      }

      if (curseFiles.length > 0 && curseFiles[0].projectID) {
        sendToWindow('install:progress', { packId, phase: 'cf_mods', message: 'Baixando mods do All The Mods 10...', percentage: 65 });
        await curseforgeDownloader.syncCurseForgeMods(gameDir, curseFiles, (p) => {
          sendToWindow('install:progress', {
            packId,
            phase: 'cf_mods',
            message: p.message,
            percentage: 65 + (p.percentage * 0.25),
            downloadedBytes: p.downloadedBytes,
            totalBytes: p.totalBytes,
            speedBytesPerSec: p.speedBytesPerSec
          });
        });
      }

      sendToWindow('install:progress', { packId, phase: 'mods', message: 'Sincronizando configurações e overrides...', percentage: 90 });
      await manifestManager.syncModpackFiles(packId, remoteManifest, (p) => {
        sendToWindow('install:progress', {
          packId,
          phase: 'mods',
          message: p.message,
          percentage: 90 + (p.percentage * 0.1)
        });
      });

      sendToWindow('install:log', { level: 'INFO', message: `Instalação de ${packEntry.name} concluída com sucesso!` });
      sendToWindow('install:progress', { packId, phase: 'done', message: 'Pronto para Jogar!', percentage: 100 });
      return { success: true };
    } catch (err) {
      console.error(`Erro instalando ${packId}:`, err);
      sendToWindow('install:log', { level: 'ERROR', message: `Erro ao instalar: ${err.message}` });
      throw err;
    }
  });

  // 4. Launch Game
  ipcMain.handle('instance:launch', async (event, packId) => {
    const catalog = await manifestManager.getCatalog();
    const packEntry = catalog.modpacks.find(m => m.id === packId);
    const instConfig = configStore.getInstanceConfig(packId);
    const autoClose = configStore.get('autoCloseOnLaunch');

    try {
      sendToWindow('game:log', { packId, level: 'INFO', message: `Iniciando preparação de execução de ${packEntry ? packEntry.name : packId}...` });
      await gameLauncher.launch(
        instConfig.gameDir,
        {
          minRam: instConfig.minRam,
          maxRam: instConfig.maxRam,
          javaPathOverride: instConfig.customJavaPath
        },
        (log) => {
          sendToWindow('game:log', { packId, ...log });
        },
        (status) => {
          sendToWindow('game:status', { packId, status });
          const launchAction = configStore.get('launchAction') || 'minimize-tray';
          if (status === 'running') {
            if (launchAction === 'close') {
              const { app } = require('electron');
              app.isQuitting = true;
              app.quit();
            } else if (launchAction === 'minimize-tray') {
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.hide();
              }
            } else if (launchAction === 'minimize') {
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.minimize();
              }
            }
          } else if (status === 'idle') {
            if (launchAction === 'minimize-tray' || launchAction === 'minimize') {
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.show();
                mainWindow.focus();
              }
            }
          }
        }
      );
      return { success: true };
    } catch (err) {
      sendToWindow('game:log', { packId, level: 'ERROR', message: `Falha ao iniciar ${packEntry ? packEntry.name : packId}: ${err.message}` });
      dialog.showErrorBox('Erro ao Iniciar o Jogo', `Não foi possível iniciar ${packEntry ? packEntry.name : packId}:\n\n${err.message}\n\nAbra a aba REGISTROS para visualizar os detalhes.`);
      throw err;
    }
  });

  // 5. Server Ping
  ipcMain.handle('server:ping', async (event, host, port) => {
    return await serverPing.ping(host, port || 25565);
  });

  // 6. Authentication (Microsoft & Offline)
  ipcMain.handle('auth:microsoft-login', async () => {
    try {
      const profile = await microsoftAuth.loginWithPopup(mainWindow);
      configStore.saveConfig({
        username: profile.username,
        authType: 'microsoft',
        microsoftAccount: {
          username: profile.username,
          uuid: profile.uuid,
          accessToken: profile.accessToken,
          avatarUrl: profile.avatarUrl,
          isPremium: true
        }
      });
      return { success: true, profile };
    } catch (err) {
      console.error('Erro no login Microsoft:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('auth:verify-original', async (event, username) => {
    try {
      const profile = await microsoftAuth.verifyOriginalUsername(username);
      configStore.saveConfig({
        username: profile.username,
        authType: 'microsoft',
        microsoftAccount: profile
      });
      return { success: true, profile };
    } catch (err) {
      console.error('Erro na verificação Mojang:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('auth:logout', async () => {
    configStore.saveConfig({
      authType: 'offline',
      microsoftAccount: null
    });
    return { success: true };
  });

  // 7. Native Dialogs
  ipcMain.handle('dialog:select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Selecionar Diretório da Instância'
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  // 8. Launcher Auto-Updater
  ipcMain.handle('updater:check', async () => {
    return await launcherUpdater.checkForUpdates();
  });

  ipcMain.handle('updater:install', async (event, url) => {
    try {
      return await launcherUpdater.downloadAndInstallUpdate(url, (progress) => {
        sendToWindow('updater:progress', progress);
      });
    } catch (err) {
      console.error('Erro na atualização do launcher:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('updater:open-download', (event, url) => {
    launcherUpdater.openDownloadPage(url);
  });

  ipcMain.handle('shell:open-external', (event, url) => {
    if (url) shell.openExternal(url);
  });

  ipcMain.handle('shell:open-instance-folder', (event, packId) => {
    const instConfig = configStore.getInstanceConfig(packId);
    if (!fs.existsSync(instConfig.gameDir)) {
      fs.mkdirSync(instConfig.gameDir, { recursive: true });
    }
    shell.openPath(instConfig.gameDir);
  });

  // 8. Window Controls
  ipcMain.on('window:minimize', () => { if (mainWindow) mainWindow.minimize(); });
  ipcMain.on('window:maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) mainWindow.unmaximize();
      else mainWindow.maximize();
    }
  });
  ipcMain.on('window:close', () => { if (mainWindow) mainWindow.close(); });
}

module.exports = { registerIpcHandlers };

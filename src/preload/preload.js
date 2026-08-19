const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcherAPI', {
  // Configuration
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (config) => ipcRenderer.invoke('config:save', config),
  saveInstanceConfig: (packId, config) => ipcRenderer.invoke('config:save-instance', packId, config),

  // Catalog & Instances
  getCatalog: () => ipcRenderer.invoke('catalog:get'),
  checkInstanceStatus: (packId) => ipcRenderer.invoke('instance:check-status', packId),
  installInstance: (packId) => ipcRenderer.invoke('instance:install', packId),
  launchInstance: (packId) => ipcRenderer.invoke('instance:launch', packId),

  // Server Ping
  pingServer: (host, port) => ipcRenderer.invoke('server:ping', host, port),

  // Authentication
  loginMicrosoft: () => ipcRenderer.invoke('auth:microsoft-login'),
  verifyOriginalAccount: (username) => ipcRenderer.invoke('auth:verify-original', username),
  logoutMicrosoft: () => ipcRenderer.invoke('auth:logout'),

  // Native Dialogs & Shell
  selectFolder: () => ipcRenderer.invoke('dialog:select-folder'),
  openInstanceFolder: (packId) => ipcRenderer.invoke('shell:open-instance-folder', packId),

  // Launcher Updater
  checkForLauncherUpdates: () => ipcRenderer.invoke('updater:check'),
  installLauncherUpdate: (url) => ipcRenderer.invoke('updater:install', url),
  openDownloadPage: (url) => ipcRenderer.invoke('updater:open-download', url),
  onUpdaterProgress: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('updater:progress', handler);
    return () => ipcRenderer.removeListener('updater:progress', handler);
  },

  // Window Controls
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),

  // Event Listeners
  onInstallProgress: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('install:progress', handler);
    return () => ipcRenderer.removeListener('install:progress', handler);
  },
  onInstallLog: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('install:log', handler);
    return () => ipcRenderer.removeListener('install:log', handler);
  },
  onGameLog: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('game:log', handler);
    return () => ipcRenderer.removeListener('game:log', handler);
  },
  onGameStatus: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('game:status', handler);
    return () => ipcRenderer.removeListener('game:status', handler);
  }
});

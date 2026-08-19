const { app, BrowserWindow, Menu, Tray, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const configStore = require('./configStore');
const { registerIpcHandlers } = require('./ipcHandlers');

// Disable security warnings & optimize Chromium memory
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=128');
app.commandLine.appendSwitch('disable-breakpad');
app.commandLine.appendSwitch('disable-component-update');

let mainWindow = null;
let tray = null;
app.isQuitting = false;

function createTray() {
  const iconPath = path.join(__dirname, '../renderer/assets/icon.png');
  let trayIcon = null;
  if (fs.existsSync(iconPath)) {
    trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  } else {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);

  function updateTrayMenu() {
    const isEco = configStore.get('ecoMode') || false;
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Abrir Forbidden Launcher',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      },
      {
        label: 'Modo Econômico (Baixo Consumo)',
        type: 'checkbox',
        checked: isEco,
        click: (menuItem) => {
          configStore.saveConfig({ ecoMode: menuItem.checked });
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('config:updated', configStore.getAll());
          }
          updateTrayMenu();
        }
      },
      { type: 'separator' },
      {
        label: 'Sair do Launcher',
        click: () => {
          app.isQuitting = true;
          app.quit();
        }
      }
    ]);
    tray.setContextMenu(contextMenu);
  }

  tray.setToolTip('Forbidden Launcher');
  updateTrayMenu();

  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 720,
    minWidth: 1020,
    minHeight: 640,
    frame: false, // Frameless for custom Dark Fantasy titlebar & borders
    backgroundColor: '#070709',
    resizable: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: true
    }
  });

  Menu.setApplicationMenu(null);

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', (event) => {
    if (!app.isQuitting && configStore.get('closeToTray')) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  registerIpcHandlers(mainWindow);
}

app.whenReady().then(() => {
  createTray();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && (!configStore.get('closeToTray') || app.isQuitting)) {
    app.quit();
  }
});

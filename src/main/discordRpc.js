const net = require('net');
const path = require('path');
const os = require('os');
const EventEmitter = require('events');

const OPCODES = {
  HANDSHAKE: 0,
  FRAME: 1,
  CLOSE: 2,
  PING: 3,
  PONG: 4
};

const DEFAULT_CLIENT_ID = '1541166175218831501';
const DISCORD_INVITE_URL = 'https://discord.gg/eS8sxZESW';
const LOGO_URL = 'https://raw.githubusercontent.com/forbiddenlaucher/ForbiddenLauncher/master/src/renderer/assets/icon.png';
const ATM_LOGO_URL = 'https://raw.githubusercontent.com/forbiddenlaucher/ForbiddenLauncher/master/src/renderer/assets/atm10_logo.png';

class DiscordRpc extends EventEmitter {
  constructor(options = {}) {
    super();
    this.clientId = options.clientId || DEFAULT_CLIENT_ID;
    this.socket = null;
    this.connected = false;
    this.enabled = true;
    this.currentActivity = null;
    this.reconnectTimer = null;
    this.activePack = 'forbidden-requiem';
    this.gameStartTime = null;
    this.inGameData = null;
  }

  init(enabled = true) {
    this.enabled = enabled;
    if (!this.enabled) return;
    this.connect();
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!this.enabled) {
      this.clearActivity();
      this.disconnect();
    } else {
      this.connect();
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      try { this.socket.destroy(); } catch (e) {}
      this.socket = null;
    }
    this.connected = false;
  }

  connect() {
    if (this.connected || this.socket) return;

    const pipePath = this._getIpcPath();
    if (!pipePath) {
      this._scheduleReconnect();
      return;
    }

    try {
      this.socket = net.createConnection(pipePath);

      this.socket.on('connect', () => {
        this.connected = true;
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        this._sendHandshake();
        this.emit('connected');

        if (this.currentActivity) {
          this._sendActivity(this.currentActivity);
        } else {
          this.setLauncherIdle(this.activePack);
        }
      });

      this.socket.on('data', (data) => {
        this._handleData(data);
      });

      this.socket.on('error', () => {
        this.connected = false;
        this.socket = null;
        this._scheduleReconnect();
      });

      this.socket.on('close', () => {
        this.connected = false;
        this.socket = null;
        this._scheduleReconnect();
      });
    } catch (e) {
      this.connected = false;
      this.socket = null;
      this._scheduleReconnect();
    }
  }


  _scheduleReconnect() {
    if (!this.enabled || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.enabled && !this.connected) {
        this.connect();
      }
    }, 10000);
  }

  _getIpcPath(id = 0) {
    if (process.platform === 'win32') {
      return `\\\\.\\pipe\\discord-ipc-${id}`;
    }

    const { env: { XDG_RUNTIME_DIR, TMPDIR, TMP, TEMP } } = process;
    const prefix = XDG_RUNTIME_DIR || TMPDIR || TMP || TEMP || '/tmp';
    return path.join(prefix, `discord-ipc-${id}`);
  }

  _sendHandshake() {
    const payload = JSON.stringify({
      v: 1,
      client_id: this.clientId
    });
    this._sendPacket(OPCODES.HANDSHAKE, payload);
  }

  _sendPacket(opcode, payloadStr) {
    if (!this.socket || !this.connected) return;
    try {
      const payloadBuf = Buffer.from(payloadStr, 'utf8');
      const headerBuf = Buffer.alloc(8);
      headerBuf.writeInt32LE(opcode, 0);
      headerBuf.writeInt32LE(payloadBuf.length, 4);
      this.socket.write(Buffer.concat([headerBuf, payloadBuf]));
    } catch (err) {
      console.error('[Discord RPC] Erro ao enviar pacote:', err.message);
    }
  }

  _handleData(data) {
    if (data.length < 8) return;
    try {
      const length = data.readInt32LE(4);
      const payloadStr = data.toString('utf8', 8, 8 + length);
      const payload = JSON.parse(payloadStr);
      if (payload.evt === 'READY') {
        this.emit('ready', payload.data);
      }
    } catch (e) {}
  }

  _sendActivity(activity) {
    if (!this.enabled) return;
    this.currentActivity = activity;
    if (!this.connected) {
      this.connect();
      return;
    }

    const packet = {
      cmd: 'SET_ACTIVITY',
      args: {
        pid: process.pid,
        activity: activity
      },
      nonce: Date.now() + '_' + Math.random().toString(36).substring(2, 8)
    };

    this._sendPacket(OPCODES.FRAME, JSON.stringify(packet));
  }

  setClientId(clientId) {
    const newId = (clientId && clientId.trim()) ? clientId.trim() : DEFAULT_CLIENT_ID;
    if (this.clientId !== newId) {
      this.clientId = newId;
      if (this.connected) {
        this.disconnect();
        this.connect();
      }
    }
  }

  _getPackMeta(packId) {
    if (packId === 'atm10') {
      return {
        name: 'All The Mods 10',
        version: '1.21.1',
        loader: 'NeoForge',
        largeImage: ATM_LOGO_URL,
        largeText: 'All The Mods 10 • NeoForge 1.21.1',
        smallImage: LOGO_URL,
        smallText: 'ATM 10 Universe',
        button1Label: 'Comunidade Discord',
        button2Label: 'Servidor ATM 10',
        defaultServer: 'allthemods.com.br'
      };
    }
    return {
      name: 'Forbidden Requiem',
      version: '1.7.10',
      loader: 'Forge',
      largeImage: LOGO_URL,
      largeText: 'Forbidden Requiem 1.7.10 • Dark Fantasy RPG',
      smallImage: LOGO_URL,
      smallText: 'Forge 1.7.10',
      button1Label: 'Comunidade Discord',
      button2Label: 'Servidor 1.7.10',
      defaultServer: 'play.forbiddenrequiem.com'
    };
  }

  setLauncherIdle(packId = 'forbidden-requiem') {
    this.activePack = packId;
    this.gameStartTime = null;
    this.inGameData = null;
    const meta = this._getPackMeta(packId);
    const isFr = packId === 'forbidden-requiem';
    const activity = {
      details: isFr ? '🏰 Explorando Forbidden Requiem' : '🌌 Explorando All The Mods 10',
      state: '📖 Grimório • ' + meta.name + ' (' + meta.version + ')',
      assets: {
        large_image: meta.largeImage,
        large_text: meta.largeText,
        small_image: LOGO_URL,
        small_text: 'Forbidden Launcher'
      },
      buttons: [
        { label: 'Comunidade Discord', url: DISCORD_INVITE_URL },
        { label: 'Baixar Launcher', url: 'https://github.com/forbiddenlaucher/ForbiddenLauncher/releases' }
      ]
    };
    this._sendActivity(activity);
  }

  setInstalling(packId = 'forbidden-requiem', progress = 0, speed = '') {
    this.activePack = packId;
    const meta = this._getPackMeta(packId);
    const pct = Math.min(100, Math.max(0, Math.round(progress)));
    const stateStr = speed ? 'Baixando mods (' + pct + '% • ' + speed + ')' : 'Instalando arquivos (' + pct + '%)';
    const activity = {
      details: '📦 Instalando ' + meta.name,
      state: stateStr,
      assets: {
        large_image: meta.largeImage,
        large_text: meta.name + ' (' + meta.version + ')',
        small_image: LOGO_URL,
        small_text: pct + '% Concluído'
      },
      buttons: [
        { label: 'Comunidade Discord', url: DISCORD_INVITE_URL }
      ]
    };
    this._sendActivity(activity);
  }

  setGameLoading(packId = 'forbidden-requiem', stage = 'Carregando mods...') {
    this.activePack = packId;
    if (!this.gameStartTime) {
      this.gameStartTime = Math.floor(Date.now() / 1000);
    }
    const meta = this._getPackMeta(packId);
    const activity = {
      details: '⚡ Inicializando ' + meta.name,
      state: stage || 'Carregando modificações...',
      timestamps: {
        start: this.gameStartTime
      },
      assets: {
        large_image: meta.largeImage,
        large_text: meta.largeText,
        small_image: LOGO_URL,
        small_text: 'Carregando mods...'
      },
      buttons: [
        { label: 'Comunidade Discord', url: DISCORD_INVITE_URL },
        { label: meta.button2Label, url: DISCORD_INVITE_URL }
      ]
    };
    this._sendActivity(activity);
  }

  setInGame(packId = 'forbidden-requiem', options = {}) {
    this.activePack = packId;
    if (!this.gameStartTime) {
      this.gameStartTime = Math.floor(Date.now() / 1000);
    }
    const meta = this._getPackMeta(packId);
    if (options.inMenu) {
      this.inGameData = { inMenu: true };
    } else if (options.isSingleplayer) {
      this.inGameData = { isSingleplayer: true, dimension: options.dimension || 'Overworld', ...options };
      delete this.inGameData.serverIp;
    } else if (options.serverIp) {
      this.inGameData = { ...(this.inGameData || {}), ...options };
      delete this.inGameData.isSingleplayer;
    } else {
      this.inGameData = { ...(this.inGameData || {}), ...options };
    }

    let details = '⚔️ ' + meta.name + ' (' + meta.version + ')';
    let state = '🏠 No Menu Principal';
    let party = undefined;

    if (this.inGameData.serverIp) {
      state = '🌐 ' + this.inGameData.serverIp;
      if (this.inGameData.playersOnline !== undefined && this.inGameData.maxPlayers) {
        party = {
          id: 'srv_' + packId,
          size: [this.inGameData.playersOnline, this.inGameData.maxPlayers]
        };
      }
    } else if (this.inGameData.isSingleplayer) {
      const dim = this.inGameData.dimension || 'Overworld';
      let dimIcon = '🌲';
      if (dim === 'Nether') dimIcon = '🔥';
      else if (dim === 'The End') dimIcon = '🌌';
      else if (dim === 'Twilight Forest') dimIcon = '🦌';
      else if (dim === 'Deep Dark') dimIcon = '🌑';
      else if (dim === 'Outer Lands') dimIcon = '👁️';
      else if (dim === 'Pocket Plane') dimIcon = '🚪';
      else if (dim === 'Aether') dimIcon = '☁️';
      else if (dim.includes('The Other')) dimIcon = '⚡';
      else if (dim.includes('Mineração') || dim.includes('Mining')) dimIcon = '⛏️';
      else if (dim.includes('Lua') || dim.includes('Moon')) dimIcon = '🌕';
      else if (dim.includes('Marte') || dim.includes('Mars')) dimIcon = '🪐';

      state = dimIcon + ' Modo Solo • ' + dim;
    } else if (this.inGameData.dimension) {
      state = '🗺️ Explorando: ' + this.inGameData.dimension;
    }

    const activity = {
      details: details,
      state: state,
      timestamps: {
        start: this.gameStartTime
      },
      assets: {
        large_image: meta.largeImage,
        large_text: meta.largeText,
        small_image: meta.smallImage,
        small_text: meta.smallText
      },
      party: party,
      buttons: [
        { label: meta.button1Label || 'Comunidade Discord', url: DISCORD_INVITE_URL },
        { label: meta.button2Label || 'Conectar ao Servidor', url: DISCORD_INVITE_URL }
      ]
    };
    this._sendActivity(activity);
  }

  clearActivity() {
    this.currentActivity = null;
    this.gameStartTime = null;
    this.inGameData = null;
    if (!this.connected) return;
    const packet = {
      cmd: 'SET_ACTIVITY',
      args: {
        pid: process.pid,
        activity: null
      },
      nonce: Date.now() + '_' + Math.random().toString(36).substring(2, 8)
    };
    this._sendPacket(OPCODES.FRAME, JSON.stringify(packet));
  }

  destroy() {
    this.clearActivity();
    this.disconnect();
  }
}

const discordRpc = new DiscordRpc();
module.exports = discordRpc;

const { BrowserWindow } = require('electron');
const https = require('https');

// Official Microsoft Azure Xbox Client ID for Minecraft
const CLIENT_ID = '000000004C12AE6F';
const REDIRECT_URI = 'https://login.live.com/oauth20_desktop.srf';
const SCOPE = 'service::user.auth.xboxlive.com::MBI_SSL';

function httpRequest(url, options = {}, postData = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const bodyStr = postData ? (typeof postData === 'object' ? JSON.stringify(postData) : String(postData)) : null;

    const reqOptions = {
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method: options.method || (bodyStr ? 'POST' : 'GET'),
      headers: {
        'User-Agent': 'ForbiddenLauncher/1.0',
        'Accept': 'application/json',
        ...(bodyStr ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
        ...(options.headers || {})
      }
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(json);
          } else {
            resolve({ error: true, status: res.statusCode, body: json, raw: data });
          }
        } catch (e) {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            resolve({ error: true, status: res.statusCode, raw: data });
          }
        }
      });
    });

    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

class MicrosoftAuth {
  /**
   * Verifies an official Minecraft username directly with Mojang API
   */
  async verifyOriginalUsername(username) {
    const cleanUser = (username || '').trim();
    if (!cleanUser) {
      throw new Error('Por favor, digite um nome de usuário válido.');
    }

    const mojangRes = await httpRequest(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(cleanUser)}`);

    if (mojangRes.error || !mojangRes.id || !mojangRes.name) {
      throw new Error(`A conta "${cleanUser}" não foi encontrada como conta Minecraft Original nos servidores da Mojang.`);
    }

    return {
      authType: 'microsoft',
      username: mojangRes.name,
      uuid: mojangRes.id,
      accessToken: '00000000000000000000000000000000',
      avatarUrl: `https://minotar.net/avatar/${encodeURIComponent(mojangRes.name)}/64`,
      isPremium: true,
      verifiedVia: 'Mojang Official API'
    };
  }

  /**
   * Opens an Electron popup for Microsoft Account OAuth Login
   */
  async loginWithPopup(parentWindow) {
    const authUrl = `https://login.live.com/oauth20_authorize.srf?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=token&scope=${encodeURIComponent(SCOPE)}&prompt=select_account`;

    return new Promise((resolve, reject) => {
      const loginWin = new BrowserWindow({
        width: 520,
        height: 660,
        parent: parentWindow || undefined,
        modal: true,
        resizable: false,
        backgroundColor: '#0d0c11',
        title: 'Login Microsoft • Minecraft Original',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      loginWin.setMenuBarVisibility(false);
      loginWin.loadURL(authUrl);

      let handled = false;

      const handleCallback = async (url) => {
        if (!url.startsWith(REDIRECT_URI)) return;
        handled = true;

        try {
          const hashIdx = url.indexOf('#');
          const queryIdx = url.indexOf('?');
          let paramsStr = '';

          if (hashIdx !== -1) {
            paramsStr = url.substring(hashIdx + 1);
          } else if (queryIdx !== -1) {
            paramsStr = url.substring(queryIdx + 1);
          }

          const params = new URLSearchParams(paramsStr);
          const accessToken = params.get('access_token');
          const error = params.get('error');
          const errorDesc = params.get('error_description');

          if (error) {
            loginWin.close();
            return reject(new Error(`Login cancelado ou recusado pela Microsoft: ${errorDesc || error}`));
          }

          if (accessToken) {
            loginWin.close();
            const profile = await this.authenticateWithLiveToken(accessToken);
            return resolve(profile);
          } else {
            loginWin.close();
            return reject(new Error('Token de autenticação da Microsoft não encontrado no retorno.'));
          }
        } catch (err) {
          if (!loginWin.isDestroyed()) loginWin.close();
          reject(err);
        }
      };

      loginWin.webContents.on('will-redirect', (event, newUrl) => {
        handleCallback(newUrl);
      });

      loginWin.webContents.on('will-navigate', (event, newUrl) => {
        handleCallback(newUrl);
      });

      loginWin.webContents.on('did-navigate', (event, newUrl) => {
        if (newUrl.startsWith(REDIRECT_URI)) {
          handleCallback(newUrl);
        }
      });

      loginWin.on('closed', () => {
        if (!handled) {
          reject(new Error('A janela de login da Microsoft foi fechada antes da autenticação.'));
        }
      });
    });
  }

  /**
   * Authenticates directly using the Live Access Token with multi-format ticket fallback
   */
  async authenticateWithLiveToken(liveAccessToken) {
    const ticketFormats = [
      liveAccessToken,
      `d=${liveAccessToken}`,
      `t=${liveAccessToken}`
    ];

    let xblRes = null;
    let successfulTicket = null;

    for (const ticket of ticketFormats) {
      const payload = {
        Properties: {
          AuthMethod: 'RPS',
          SiteName: 'user.auth.xboxlive.com',
          RpsTicket: ticket
        },
        RelyingParty: 'http://auth.xboxlive.com',
        TokenType: 'JWT'
      };

      xblRes = await httpRequest('https://user.auth.xboxlive.com/user/authenticate', {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'x-xbl-contract-version': '1'
        }
      }, payload);

      if (!xblRes.error && xblRes.Token) {
        successfulTicket = ticket;
        break;
      }
    }

    if (!xblRes || xblRes.error || !xblRes.Token) {
      throw new Error(`Falha na autenticação Xbox Live (${xblRes ? xblRes.status : 'desconhecido'}). Você também pode usar a verificação direta de Nickname Original.`);
    }

    const uhs = xblRes.DisplayClaims.xui[0].uhs;

    // 2. XSTS Token
    const xstsPayload = {
      Properties: {
        SandboxId: 'RETAIL',
        UserTokens: [xblRes.Token]
      },
      RelyingParty: 'rp://api.minecraftservices.com/',
      TokenType: 'JWT'
    };

    const xstsRes = await httpRequest('https://xsts.auth.xboxlive.com/xsts/authorize', {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-xbl-contract-version': '1'
      }
    }, xstsPayload);

    if (xstsRes.error || !xstsRes.Token) {
      if (xstsRes.body && xstsRes.body.XErr === 2148916238) {
        throw new Error('Esta conta Microsoft não possui uma conta Xbox criada ou possui restrições de idade.');
      }
      throw new Error(`Falha ao obter token XSTS (${xstsRes.status}): ${JSON.stringify(xstsRes.body || xstsRes.raw || xstsRes)}`);
    }

    // 3. Minecraft Login with Xbox
    const mcPayload = {
      identityToken: `XBL3.0 x=${uhs};${xstsRes.Token}`
    };

    const mcRes = await httpRequest('https://api.minecraftservices.com/authentication/login_with_xbox', {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    }, mcPayload);

    if (mcRes.error || !mcRes.access_token) {
      throw new Error(`Falha no login da API do Minecraft (${mcRes.status}): ${JSON.stringify(mcRes.body || mcRes.raw || mcRes)}`);
    }

    // 4. Get Minecraft Profile
    const profileRes = await httpRequest('https://api.minecraftservices.com/minecraft/profile', {
      headers: {
        'Authorization': `Bearer ${mcRes.access_token}`,
        'Accept': 'application/json'
      }
    });

    if (profileRes.error || !profileRes.name) {
      throw new Error('Esta conta Microsoft não possui o Minecraft Java Edition adquirido.');
    }

    return {
      authType: 'microsoft',
      username: profileRes.name,
      uuid: profileRes.id,
      accessToken: mcRes.access_token,
      skins: profileRes.skins || [],
      capes: profileRes.capes || [],
      avatarUrl: `https://minotar.net/avatar/${encodeURIComponent(profileRes.name)}/64`,
      isPremium: true
    };
  }
}

module.exports = new MicrosoftAuth();

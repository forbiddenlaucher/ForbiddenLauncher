// Universal Hub Controller for Forbidden Launcher
document.addEventListener('DOMContentLoaded', async () => {
  const api = window.launcherAPI;

  // State maps per instance
  const instanceStates = {
    'forbidden-requiem': 'uninstalled', // 'uninstalled' | 'installing' | 'installed' | 'needs_update' | 'running'
    'atm10': 'uninstalled'
  };

  let currentCatalog = null;
  let currentConfig = null;
  let logsBuffer = [];
  let currentSelectedModpackTab = 'forbidden-requiem';

  // DOM Elements - Window Controls
  const btnWindowMin = document.getElementById('btn-window-min');
  const btnWindowMax = document.getElementById('btn-window-max');
  const btnWindowClose = document.getElementById('btn-window-close');
  const btnOpenExitModal = document.getElementById('btn-open-exit-modal');
  const modalExit = document.getElementById('modal-exit');
  const btnModalCancel = document.getElementById('btn-modal-cancel');
  const btnModalConfirmExit = document.getElementById('btn-modal-confirm-exit');

  // Navigation
  const navItems = document.querySelectorAll('.nav-item');
  const viewSections = document.querySelectorAll('.view-section');

  // Forbidden Requiem Card
  const btnActionForbidden = document.getElementById('btn-action-forbidden');
  const textActionForbidden = document.getElementById('text-action-forbidden');
  const progboxForbidden = document.getElementById('progbox-forbidden');
  const progmsgForbidden = document.getElementById('progmsg-forbidden');
  const progpctForbidden = document.getElementById('progpct-forbidden');
  const progfillForbidden = document.getElementById('progfill-forbidden');
  const progdetailForbidden = document.getElementById('progdetail-forbidden');
  const progspeedForbidden = document.getElementById('progspeed-forbidden');
  const dotForbidden = document.getElementById('dot-forbidden');
  const serverTxtForbidden = document.getElementById('server-txt-forbidden');

  // ATM 10 Card
  const btnActionAtm10 = document.getElementById('btn-action-atm10');
  const textActionAtm10 = document.getElementById('text-action-atm10');
  const progboxAtm10 = document.getElementById('progbox-atm10');
  const progmsgAtm10 = document.getElementById('progmsg-atm10');
  const progpctAtm10 = document.getElementById('progpct-atm10');
  const progfillAtm10 = document.getElementById('progfill-atm10');
  const progdetailAtm10 = document.getElementById('progdetail-atm10');
  const progspeedAtm10 = document.getElementById('progspeed-atm10');
  const dotAtm10 = document.getElementById('dot-atm10');
  const serverTxtAtm10 = document.getElementById('server-txt-atm10');

  // Sidebar Player
  const sidebarAvatar = document.getElementById('sidebar-avatar');
  const sidebarUsername = document.getElementById('sidebar-username');

  // Modpacks & Grimoire View
  const tabBtnForbidden = document.getElementById('tab-btn-forbidden');
  const tabBtnAtm10 = document.getElementById('tab-btn-atm10');
  const packLoreBox = document.getElementById('pack-lore-box');
  const modpackModsContainer = document.getElementById('modpack-mods-container');
  const inputSearchMods = document.getElementById('input-search-mods');

  // Servers View
  const btnRefreshAllServers = document.getElementById('btn-refresh-all-servers');
  const btnCopyIpFr = document.getElementById('btn-copy-ip-fr');
  const btnCopyIpAtm = document.getElementById('btn-copy-ip-atm');
  const ipFrVal = document.getElementById('ip-fr-val');
  const ipAtmVal = document.getElementById('ip-atm-val');
  const srvStatusFr = document.getElementById('srv-status-fr');
  const srvPingFr = document.getElementById('srv-ping-fr');
  const srvPlayersFr = document.getElementById('srv-players-fr');
  const srvStatusAtm = document.getElementById('srv-status-atm');
  const srvPingAtm = document.getElementById('srv-ping-atm');
  const srvPlayersAtm = document.getElementById('srv-players-atm');
  const dotIndicatorFr = document.getElementById('dot-indicator-fr');
  const dotIndicatorAtm = document.getElementById('dot-indicator-atm');

  // Logs View
  const consoleLogsContainer = document.getElementById('console-logs-container');
  const btnClearLogs = document.getElementById('btn-clear-logs');
  const btnExportLogs = document.getElementById('btn-export-logs');

  // Settings View
  const settingUsername = document.getElementById('setting-username');
  const sliderRamFr = document.getElementById('slider-ram-fr');
  const ramValFr = document.getElementById('ram-val-fr');
  const sliderRamAtm = document.getElementById('slider-ram-atm');
  const ramValAtm = document.getElementById('ram-val-atm');
  const btnOpenFolderFr = document.getElementById('btn-open-folder-fr');
  const btnOpenFolderAtm = document.getElementById('btn-open-folder-atm');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const settingEcoMode = document.getElementById('setting-eco-mode');
  const settingLaunchAction = document.getElementById('setting-launch-action');
  const settingCloseToTray = document.getElementById('setting-close-to-tray');

  // Auth & Profile
  const btnTypeOffline = document.getElementById('btn-type-offline');
  const btnTypeMicrosoft = document.getElementById('btn-type-microsoft');
  const sectionAuthOffline = document.getElementById('section-auth-offline');
  const sectionAuthMicrosoft = document.getElementById('section-auth-microsoft');
  const avatarFrameWrap = document.getElementById('avatar-frame-wrap');
  const avatarBadgeStatus = document.getElementById('avatar-badge-status');
  const btnMsLoginAction = document.getElementById('btn-ms-login-action');
  const btnMsLogoutAction = document.getElementById('btn-ms-logout-action');
  const msLoggedOutBox = document.getElementById('ms-logged-out-box');
  const msLoggedInBox = document.getElementById('ms-logged-in-box');
  const msPlayerName = document.getElementById('ms-player-name');
  const msPlayerUuid = document.getElementById('ms-player-uuid');

  function updateInstanceButtonUI(packId, state) {
    instanceStates[packId] = state;
    const isFr = packId === 'forbidden-requiem';
    const btn = isFr ? btnActionForbidden : btnActionAtm10;
    const txt = isFr ? textActionForbidden : textActionAtm10;
    const box = isFr ? progboxForbidden : progboxAtm10;

    btn.classList.remove('state-running');
    btn.disabled = false;

    switch (state) {
      case 'uninstalled':
        txt.textContent = 'INSTALAR';
        box.classList.remove('active');
        break;
      case 'installing':
        txt.textContent = 'INSTALANDO...';
        btn.disabled = true;
        btn.classList.add('state-running');
        box.classList.add('active');
        break;
      case 'installed':
        txt.textContent = 'JOGAR';
        box.classList.remove('active');
        break;
      case 'needs_update':
        txt.textContent = 'ATUALIZAR';
        box.classList.remove('active');
        break;
      case 'running':
        txt.textContent = 'EXECUTANDO...';
        btn.disabled = true;
        btn.classList.add('state-running');
        box.classList.remove('active');
        break;
    }
  }

  // --- Window Controls ---
  if (btnWindowMin) btnWindowMin.onclick = () => api.minimizeWindow();
  if (btnWindowMax) btnWindowMax.onclick = () => api.maximizeWindow();
  if (btnWindowClose) btnWindowClose.onclick = () => api.closeWindow();

  if (btnOpenExitModal) btnOpenExitModal.onclick = () => modalExit.classList.add('active');
  if (btnModalCancel) btnModalCancel.onclick = () => modalExit.classList.remove('active');
  if (btnModalConfirmExit) btnModalConfirmExit.onclick = () => api.closeWindow();

  // --- Navigation Switch ---
  navItems.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-view');
      navItems.forEach(n => n.classList.remove('active'));
      viewSections.forEach(v => v.classList.remove('active'));

      btn.classList.add('active');
      const view = document.getElementById(`view-${target}`);
      if (view) view.classList.add('active');
    });
  });

  // --- Load Config & Catalog ---
  async function init() {
    currentConfig = await api.getConfig();
    currentCatalog = await api.getCatalog();

    // Profile
    settingUsername.value = currentConfig.username || 'ShadowSeeker';
    updatePlayerAvatar(currentConfig.username);

    // RAM sliders
    const frCfg = currentConfig.instances['forbidden-requiem'] || { maxRam: 4096 };
    const atmCfg = currentConfig.instances['atm10'] || { maxRam: 8192 };

    sliderRamFr.value = frCfg.maxRam || 4096;
    ramValFr.textContent = `${frCfg.maxRam || 4096} MB (${((frCfg.maxRam || 4096)/1024).toFixed(0)} GB)`;

    sliderRamAtm.value = atmCfg.maxRam || 8192;
    ramValAtm.textContent = `${atmCfg.maxRam || 8192} MB (${((atmCfg.maxRam || 8192)/1024).toFixed(0)} GB)`;

    // Profile & Auth State
    const isMs = currentConfig.authType === 'microsoft' && currentConfig.microsoftAccount;
    switchAuthMode(isMs ? 'microsoft' : 'offline');
    if (isMs) {
      const msAcc = currentConfig.microsoftAccount;
      updatePlayerAvatar(msAcc.username, true);
      if (msPlayerName) msPlayerName.textContent = msAcc.username;
      if (msPlayerUuid) msPlayerUuid.textContent = `UUID: ${msAcc.uuid || '...'}`;
      if (msLoggedOutBox) msLoggedOutBox.style.display = 'none';
      if (msLoggedInBox) msLoggedInBox.style.display = 'block';
    } else {
      settingUsername.value = currentConfig.username || 'ShadowSeeker';
      updatePlayerAvatar(currentConfig.username || 'ShadowSeeker', false);
      if (msLoggedOutBox) msLoggedOutBox.style.display = 'block';
      if (msLoggedInBox) msLoggedInBox.style.display = 'none';
    }

    // Performance & Tray Settings
    if (settingEcoMode) {
      settingEcoMode.checked = currentConfig.ecoMode || false;
      if (currentConfig.ecoMode && window.particleSystem) {
        window.particleSystem.pause();
      }
    }
    if (settingLaunchAction) {
      settingLaunchAction.value = currentConfig.launchAction || 'minimize-tray';
    }
    if (settingCloseToTray) {
      settingCloseToTray.checked = currentConfig.closeToTray || false;
    }

    // Check status of both modpacks
    await loadFullModLists();
    await checkAllStatuses();
    refreshAllServers();
    await renderModpackTab(currentSelectedModpackTab);

    // Silent background check for launcher updates
    checkForLauncherUpdate();
  }

  // --- Launcher Updater ---
  const launcherUpdateBanner = document.getElementById('launcher-update-banner');
  const bannerUpdateVersion = document.getElementById('banner-update-version');
  const btnBannerUpdate = document.getElementById('btn-banner-update');
  const btnBannerClose = document.getElementById('btn-banner-close');
  const settingsLauncherVersion = document.getElementById('settings-launcher-version');
  const settingsUpdaterFeedback = document.getElementById('settings-updater-feedback');
  const btnManualCheckUpdate = document.getElementById('btn-manual-check-update');

  async function checkForLauncherUpdate(isManual = false) {
    try {
      if (isManual && btnManualCheckUpdate) {
        btnManualCheckUpdate.innerHTML = '<span>Checando no GitHub...</span>';
        btnManualCheckUpdate.disabled = true;
      }

      const updateInfo = await api.checkForLauncherUpdates();

      if (settingsLauncherVersion && updateInfo && updateInfo.currentVersion) {
        settingsLauncherVersion.textContent = `v${updateInfo.currentVersion}`;
      }

      if (updateInfo && updateInfo.updateAvailable) {
        appendLog('INFO', `Nova versão do Forbidden Launcher disponível: v${updateInfo.latestVersion}`);
        if (launcherUpdateBanner) {
          launcherUpdateBanner.style.display = 'flex';
          if (bannerUpdateVersion) bannerUpdateVersion.textContent = `v${updateInfo.latestVersion}`;
          if (btnBannerUpdate) {
            btnBannerUpdate.onclick = () => api.openDownloadPage(updateInfo.downloadUrl);
          }
          if (btnBannerClose) {
            btnBannerClose.onclick = () => { launcherUpdateBanner.style.display = 'none'; };
          }
        }

        if (settingsUpdaterFeedback) {
          settingsUpdaterFeedback.textContent = `⚡ Nova versão disponível no GitHub: v${updateInfo.latestVersion}!`;
          settingsUpdaterFeedback.style.color = '#60a5fa';
        }
      } else {
        if (isManual && settingsUpdaterFeedback) {
          settingsUpdaterFeedback.textContent = `✅ Seu launcher já está na versão mais recente (v${updateInfo.currentVersion || '1.0.2'}).`;
          settingsUpdaterFeedback.style.color = '#4ade80';
        }
      }
    } catch (e) {
      if (isManual && settingsUpdaterFeedback) {
        settingsUpdaterFeedback.textContent = `Erro ao checar atualizações: ${e.message}`;
        settingsUpdaterFeedback.style.color = '#f87171';
      }
    } finally {
      if (isManual && btnManualCheckUpdate) {
        btnManualCheckUpdate.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg><span>Checar Atualizações Agora</span>`;
        btnManualCheckUpdate.disabled = false;
      }
    }
  }

  if (btnManualCheckUpdate) {
    btnManualCheckUpdate.addEventListener('click', () => checkForLauncherUpdate(true));
  }

  // Check instance status
  async function checkAllStatuses() {
    for (const pack of (currentCatalog.modpacks || [])) {
      try {
        const res = await api.checkInstanceStatus(pack.id);
        const isFr = pack.id === 'forbidden-requiem';
        const sizeChip = document.getElementById(isFr ? 'size-chip-fr' : 'size-chip-atm');

        if (!res.installed) {
          updateInstanceButtonUI(pack.id, 'uninstalled');
          if (sizeChip) {
            sizeChip.textContent = isFr ? '💾 ~850 MB (Instalação)' : '💾 ~2.2 GB (Instalação)';
          }
        } else if (res.needsUpdate) {
          updateInstanceButtonUI(pack.id, 'needs_update');
          if (sizeChip) {
            sizeChip.textContent = `💾 ${res.installedSizeFormatted || 'Instalado'} (Atualização disp.)`;
          }
        } else {
          updateInstanceButtonUI(pack.id, 'installed');
          if (sizeChip) {
            sizeChip.textContent = `💾 ${res.installedSizeFormatted || 'Instalado'}`;
          }
        }
      } catch (e) {
        updateInstanceButtonUI(pack.id, 'uninstalled');
      }
    }
  }

  // Action Click for Forbidden Requiem
  btnActionForbidden.addEventListener('click', async () => {
    handlePackAction('forbidden-requiem');
  });

  // Action Click for ATM 10
  btnActionAtm10.addEventListener('click', async () => {
    handlePackAction('atm10');
  });

  async function handlePackAction(packId) {
    const state = instanceStates[packId];
    if (state === 'uninstalled' || state === 'needs_update') {
      try {
        updateInstanceButtonUI(packId, 'installing');
        appendLog('INFO', `Iniciando instalação de ${packId}...`, packId);
        await api.installInstance(packId);
        appendLog('INFO', `Instalação concluída com sucesso!`, packId);
        await checkAllStatuses();
      } catch (err) {
        appendLog('ERROR', `Erro na instalação: ${err.message}`, packId);
        updateInstanceButtonUI(packId, 'uninstalled');
      }
    } else if (state === 'installed') {
      try {
        updateInstanceButtonUI(packId, 'running');
        appendLog('INFO', `Iniciando Minecraft...`, packId);
        await api.launchInstance(packId);
      } catch (err) {
        appendLog('ERROR', `Erro ao iniciar: ${err.message}`, packId);
        updateInstanceButtonUI(packId, 'installed');
      }
    }
  }

  // Progress events
  api.onInstallProgress((data) => {
    const isFr = data.packId === 'forbidden-requiem';
    const msgEl = isFr ? progmsgForbidden : progmsgAtm10;
    const pctEl = isFr ? progpctForbidden : progpctAtm10;
    const fillEl = isFr ? progfillForbidden : progfillAtm10;
    const detailEl = isFr ? progdetailForbidden : progdetailAtm10;
    const speedEl = isFr ? progspeedForbidden : progspeedAtm10;

    const percent = Math.min(100, Math.max(0, data.percentage || 0));
    msgEl.textContent = data.message || 'Instalando...';
    pctEl.textContent = `${Math.round(percent)}%`;
    fillEl.style.width = `${percent}%`;

    if (data.downloadedBytes !== undefined && data.totalBytes !== undefined) {
      detailEl.textContent = `${formatBytes(data.downloadedBytes)} / ${formatBytes(data.totalBytes)}`;
    }
    if (data.speedBytesPerSec) {
      speedEl.textContent = `${formatBytes(data.speedBytesPerSec)}/s`;
    }
  });

  api.onInstallLog((data) => appendLog(data.level, data.message));
  api.onGameLog((data) => appendLog(data.level, data.message, data.packId));
  api.onGameStatus((data) => {
    if (data.status === 'running') {
      updateInstanceButtonUI(data.packId, 'running');
      if (window.particleSystem) window.particleSystem.pause();
    } else {
      updateInstanceButtonUI(data.packId, 'installed');
      if (window.particleSystem) window.particleSystem.resume();
    }
  });

  // --- Servers Ping ---
  async function refreshAllServers() {
    try {
      if (dotForbidden) dotForbidden.className = 'status-dot checking';
      if (serverTxtForbidden) serverTxtForbidden.textContent = 'Consultando...';
      const frRes = await api.pingServer('play.forbiddenrequiem.com', 25565);
      if (frRes.online) {
        if (dotForbidden) dotForbidden.className = 'status-dot online';
        if (dotIndicatorFr) dotIndicatorFr.className = 'status-dot online';
        if (serverTxtForbidden) serverTxtForbidden.textContent = `play.forbiddenrequiem.com • ${frRes.players.online}/${frRes.players.max} Jogadores • ${frRes.ping}ms`;
        if (srvStatusFr) {
          srvStatusFr.textContent = '● Online';
          srvStatusFr.className = 'server-status-pill online';
        }
        if (srvPingFr) {
          srvPingFr.textContent = `${frRes.ping} ms`;
          srvPingFr.style.color = '#fbbf24';
        }
        if (srvPlayersFr) srvPlayersFr.textContent = `${frRes.players.online} / ${frRes.players.max}`;
      } else {
        if (dotForbidden) dotForbidden.className = 'status-dot offline';
        if (dotIndicatorFr) dotIndicatorFr.className = 'status-dot offline';
        if (serverTxtForbidden) serverTxtForbidden.textContent = 'play.forbiddenrequiem.com • Offline';
        if (srvStatusFr) {
          srvStatusFr.textContent = '● Offline';
          srvStatusFr.className = 'server-status-pill offline';
        }
        if (srvPingFr) {
          srvPingFr.textContent = '--';
          srvPingFr.style.color = 'var(--text-muted)';
        }
        if (srvPlayersFr) srvPlayersFr.textContent = '0 / 0';
      }
    } catch (e) {}

    try {
      if (dotAtm10) dotAtm10.className = 'status-dot checking';
      if (serverTxtAtm10) serverTxtAtm10.textContent = 'Consultando...';
      const atmRes = await api.pingServer('allthemods.com.br', 25565);
      if (atmRes.online) {
        if (dotAtm10) dotAtm10.className = 'status-dot online';
        if (dotIndicatorAtm) dotIndicatorAtm.className = 'status-dot online';
        if (serverTxtAtm10) serverTxtAtm10.textContent = `allthemods.com.br • ${atmRes.players.online}/${atmRes.players.max} Jogadores • ${atmRes.ping}ms`;
        if (srvStatusAtm) {
          srvStatusAtm.textContent = '● Online';
          srvStatusAtm.className = 'server-status-pill online';
        }
        if (srvPingAtm) {
          srvPingAtm.textContent = `${atmRes.ping} ms`;
          srvPingAtm.style.color = '#38bdf8';
        }
        if (srvPlayersAtm) srvPlayersAtm.textContent = `${atmRes.players.online} / ${atmRes.players.max}`;
      } else {
        if (dotAtm10) dotAtm10.className = 'status-dot offline';
        if (dotIndicatorAtm) dotIndicatorAtm.className = 'status-dot offline';
        if (serverTxtAtm10) serverTxtAtm10.textContent = 'allthemods.com.br • Offline';
        if (srvStatusAtm) {
          srvStatusAtm.textContent = '● Offline';
          srvStatusAtm.className = 'server-status-pill offline';
        }
        if (srvPingAtm) {
          srvPingAtm.textContent = '--';
          srvPingAtm.style.color = 'var(--text-muted)';
        }
        if (srvPlayersAtm) srvPlayersAtm.textContent = '0 / 0';
      }
    } catch (e) {}
  }

  btnRefreshAllServers.addEventListener('click', refreshAllServers);
  btnCopyIpFr.addEventListener('click', () => {
    navigator.clipboard.writeText(ipFrVal.value);
    btnCopyIpFr.textContent = 'Copiado!';
    setTimeout(() => btnCopyIpFr.textContent = 'Copiar', 1500);
  });
  btnCopyIpAtm.addEventListener('click', () => {
    navigator.clipboard.writeText(ipAtmVal.value);
    btnCopyIpAtm.textContent = 'Copiado!';
    setTimeout(() => btnCopyIpAtm.textContent = 'Copiar', 1500);
  });

  // --- Modpack Tabs & Full Mod Catalog ---
  let atm10FullMods = [];
  let forbiddenFullMods = [];

  async function loadFullModLists() {
    try {
      const resAtm = await fetch('assets/atm10_full_mods.json');
      if (resAtm.ok) atm10FullMods = await resAtm.json();
    } catch (e) {}

    try {
      const resFr = await fetch('assets/forbidden_full_mods.json');
      if (resFr.ok) forbiddenFullMods = await resFr.json();
    } catch (e) {}
  }

  async function renderModpackTab(packId) {
    currentSelectedModpackTab = packId;
    tabBtnForbidden.classList.toggle('active', packId === 'forbidden-requiem');
    tabBtnAtm10.classList.toggle('active', packId === 'atm10');

    const pack = (currentCatalog.modpacks || []).find(m => m.id === packId);
    if (!pack) return;

    const isAtm = packId === 'atm10';
    const listToRender = (isAtm && atm10FullMods.length > 0)
      ? atm10FullMods
      : (!isAtm && forbiddenFullMods.length > 0)
        ? forbiddenFullMods
        : (pack.featuredMods || []);

    if (packId === 'forbidden-requiem') {
      packLoreBox.innerHTML = `<b>LORE DO FORBIDDEN REQUIEM • ${listToRender.length} MODS:</b> Após a queda dos antigos portais, o mundo foi envolto em trevas arcanas. Forje armas mágicas, domine rituais de sangue e taumaturgia para sobreviver à era clássica do 1.7.10.`;
    } else {
      packLoreBox.innerHTML = `<b>A JORNADA DE ALL THE MODS 10 • ${listToRender.length} MODS:</b> Do zero até o infinito. Automatize usinas quânticas com Mekanism e AE2, domine as artes místicas de Ars Nouveau e extraia metais raros para forjar a lendária <b>ATM Star</b> no 1.21.1.`;
    }

    modpackModsContainer.innerHTML = '';
    listToRender.forEach(m => {
      const card = document.createElement('div');
      card.className = 'mod-card';
      card.innerHTML = `
        <div>
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap: 8px;">
            <span class="mod-name">${m.name}</span>
            <span class="mod-tag">${m.category || m.cat || 'Mod'}</span>
          </div>
          <p class="mod-desc">${m.description || m.desc || 'Adiciona novos recursos e ferramentas ao modpack.'}</p>
        </div>
      `;
      modpackModsContainer.appendChild(card);
    });

    const term = inputSearchMods.value.toLowerCase().trim();
    if (term) {
      const cards = modpackModsContainer.querySelectorAll('.mod-card');
      cards.forEach(c => c.style.display = c.textContent.toLowerCase().includes(term) ? 'flex' : 'none');
    }
  }

  tabBtnForbidden.onclick = () => renderModpackTab('forbidden-requiem');
  tabBtnAtm10.onclick = () => renderModpackTab('atm10');

  inputSearchMods.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    const cards = modpackModsContainer.querySelectorAll('.mod-card');
    cards.forEach(c => c.style.display = c.textContent.toLowerCase().includes(term) ? 'flex' : 'none');
  });

  // --- Settings & Avatar Preview ---
  const settingsAvatarPreview = document.getElementById('settings-avatar-preview');

  function switchAuthMode(mode) {
    if (mode === 'microsoft') {
      if (btnTypeMicrosoft) btnTypeMicrosoft.classList.add('active');
      if (btnTypeOffline) btnTypeOffline.classList.remove('active');
      if (sectionAuthMicrosoft) sectionAuthMicrosoft.style.display = 'block';
      if (sectionAuthOffline) sectionAuthOffline.style.display = 'none';

      const isMs = currentConfig.authType === 'microsoft' && currentConfig.microsoftAccount;
      if (isMs) {
        updatePlayerAvatar(currentConfig.microsoftAccount.username, true);
      }
    } else {
      if (btnTypeOffline) btnTypeOffline.classList.add('active');
      if (btnTypeMicrosoft) btnTypeMicrosoft.classList.remove('active');
      if (sectionAuthOffline) sectionAuthOffline.style.display = 'block';
      if (sectionAuthMicrosoft) sectionAuthMicrosoft.style.display = 'none';
      updatePlayerAvatar(settingUsername.value || currentConfig.username, false);
    }
  }

  if (btnTypeOffline) btnTypeOffline.onclick = () => switchAuthMode('offline');
  if (btnTypeMicrosoft) btnTypeMicrosoft.onclick = () => switchAuthMode('microsoft');

  function updatePlayerAvatar(username, isPremium = false) {
    const name = username || 'ShadowSeeker';
    sidebarUsername.textContent = name;
    const avatarUrl = `https://minotar.net/avatar/${encodeURIComponent(name)}/64`;
    sidebarAvatar.src = avatarUrl;
    if (settingsAvatarPreview) {
      settingsAvatarPreview.src = avatarUrl;
    }

    if (isPremium) {
      if (avatarFrameWrap) avatarFrameWrap.classList.add('golden-crown');
      if (sidebarAvatar) sidebarAvatar.classList.add('golden-crown');
      if (avatarBadgeStatus) {
        avatarBadgeStatus.textContent = '👑 CONTA ORIGINAL • PREMIUM';
        avatarBadgeStatus.className = 'avatar-badge badge-premium';
      }
    } else {
      if (avatarFrameWrap) avatarFrameWrap.classList.remove('golden-crown');
      if (sidebarAvatar) sidebarAvatar.classList.remove('golden-crown');
      if (avatarBadgeStatus) {
        avatarBadgeStatus.textContent = '● MODO OFFLINE';
        avatarBadgeStatus.className = 'avatar-badge';
      }
    }
  }

  // Microsoft Login Button
  if (btnMsLoginAction) {
    btnMsLoginAction.addEventListener('click', async () => {
      btnMsLoginAction.innerHTML = '<span>Autenticando na Microsoft...</span>';
      btnMsLoginAction.disabled = true;

      try {
        const res = await api.loginMicrosoft();
        if (res.success && res.profile) {
          currentConfig.authType = 'microsoft';
          currentConfig.microsoftAccount = res.profile;
          currentConfig.username = res.profile.username;

          updatePlayerAvatar(res.profile.username, true);
          if (msPlayerName) msPlayerName.textContent = res.profile.username;
          if (msPlayerUuid) msPlayerUuid.textContent = `UUID: ${res.profile.uuid || '...'}`;
          if (msLoggedOutBox) msLoggedOutBox.style.display = 'none';
          if (msLoggedInBox) msLoggedInBox.style.display = 'block';

          appendLog('INFO', `Conta Microsoft conectada com sucesso: ${res.profile.username}`);
        } else {
          appendLog('ERROR', `Falha no login Microsoft: ${res.error || 'Cancelado'}`);
        }
      } catch (err) {
        appendLog('ERROR', `Erro ao abrir login Microsoft: ${err.message}`);
      } finally {
        btnMsLoginAction.innerHTML = `<svg width="16" height="16" viewBox="0 0 21 21"><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg><span>Conectar Conta Microsoft</span>`;
        btnMsLoginAction.disabled = false;
      }
    });
  }

  // Direct Mojang Nickname Verification Button
  const inputVerifyOriginalName = document.getElementById('input-verify-original-name');
  const btnVerifyOriginalAction = document.getElementById('btn-verify-original-action');
  const verifyFeedbackMsg = document.getElementById('verify-feedback-msg');

  if (btnVerifyOriginalAction && inputVerifyOriginalName) {
    btnVerifyOriginalAction.addEventListener('click', async () => {
      const name = inputVerifyOriginalName.value.trim();
      if (!name) {
        if (verifyFeedbackMsg) {
          verifyFeedbackMsg.textContent = '⚠️ Por favor, digite o nome da sua conta original.';
          verifyFeedbackMsg.style.color = '#f87171';
        }
        return;
      }

      btnVerifyOriginalAction.innerHTML = '<span>Consultando Mojang...</span>';
      btnVerifyOriginalAction.disabled = true;

      try {
        const res = await api.verifyOriginalAccount(name);
        if (res.success && res.profile) {
          currentConfig.authType = 'microsoft';
          currentConfig.microsoftAccount = res.profile;
          currentConfig.username = res.profile.username;

          updatePlayerAvatar(res.profile.username, true);
          if (msPlayerName) msPlayerName.textContent = res.profile.username;
          if (msPlayerUuid) msPlayerUuid.textContent = `UUID: ${res.profile.uuid || '...'}`;
          if (msLoggedOutBox) msLoggedOutBox.style.display = 'none';
          if (msLoggedInBox) msLoggedInBox.style.display = 'block';

          if (verifyFeedbackMsg) {
            verifyFeedbackMsg.textContent = `✅ Conta original "${res.profile.username}" verificada com sucesso!`;
            verifyFeedbackMsg.style.color = '#4ade80';
          }
          appendLog('INFO', `Conta Minecraft Original verificada com sucesso: ${res.profile.username} (UUID: ${res.profile.uuid})`);
        } else {
          if (verifyFeedbackMsg) {
            verifyFeedbackMsg.textContent = `❌ ${res.error || 'Conta não encontrada nos servidores da Mojang.'}`;
            verifyFeedbackMsg.style.color = '#f87171';
          }
          appendLog('ERROR', `Falha na verificação da conta: ${res.error}`);
        }
      } catch (err) {
        if (verifyFeedbackMsg) {
          verifyFeedbackMsg.textContent = `❌ Erro: ${err.message}`;
          verifyFeedbackMsg.style.color = '#f87171';
        }
      } finally {
        btnVerifyOriginalAction.innerHTML = '<span>👑 Ativar Moldura Real</span>';
        btnVerifyOriginalAction.disabled = false;
      }
    });
  }

  // Microsoft Logout Button
  if (btnMsLogoutAction) {
    btnMsLogoutAction.addEventListener('click', async () => {
      await api.logoutMicrosoft();
      currentConfig.authType = 'offline';
      currentConfig.microsoftAccount = null;

      switchAuthMode('offline');
      if (msLoggedOutBox) msLoggedOutBox.style.display = 'block';
      if (msLoggedInBox) msLoggedInBox.style.display = 'none';
      if (verifyFeedbackMsg) {
        verifyFeedbackMsg.textContent = 'A verificação consulta diretamente os servidores da Mojang para carregar sua skin oficial com a Moldura Dourada Real.';
        verifyFeedbackMsg.style.color = 'var(--text-muted)';
      }
      appendLog('INFO', 'Conta Microsoft desconectada. Modo Offline reativado.');
    });
  }

  function updateRamPresetHighlight(sliderId, value) {
    const presets = document.querySelectorAll(`.btn-ram-preset[data-slider="${sliderId}"]`);
    presets.forEach(p => {
      p.classList.toggle('active', parseInt(p.getAttribute('data-val'), 10) === value);
    });
  }

  sliderRamFr.addEventListener('input', (e) => {
    const v = parseInt(e.target.value, 10);
    ramValFr.textContent = `${v} MB (${(v/1024).toFixed(0)} GB)`;
    updateRamPresetHighlight('slider-ram-fr', v);
  });

  sliderRamAtm.addEventListener('input', (e) => {
    const v = parseInt(e.target.value, 10);
    ramValAtm.textContent = `${v} MB (${(v/1024).toFixed(0)} GB)`;
    updateRamPresetHighlight('slider-ram-atm', v);
  });

  // Wire up RAM Preset Buttons
  document.querySelectorAll('.btn-ram-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const sliderId = btn.getAttribute('data-slider');
      const val = parseInt(btn.getAttribute('data-val'), 10);
      const slider = document.getElementById(sliderId);
      if (slider) {
        slider.value = val;
        if (sliderId === 'slider-ram-fr') {
          ramValFr.textContent = `${val} MB (${(val/1024).toFixed(0)} GB)`;
        } else {
          ramValAtm.textContent = `${val} MB (${(val/1024).toFixed(0)} GB)`;
        }
        updateRamPresetHighlight(sliderId, val);
      }
    });
  });

  if (settingEcoMode) {
    settingEcoMode.addEventListener('change', (e) => {
      if (e.target.checked) {
        if (window.particleSystem) window.particleSystem.pause();
      } else {
        if (window.particleSystem) window.particleSystem.resume();
      }
    });
  }

  settingUsername.addEventListener('input', (e) => {
    updatePlayerAvatar(e.target.value);
  });

  btnOpenFolderFr.onclick = () => api.openInstanceFolder('forbidden-requiem');
  btnOpenFolderAtm.onclick = () => api.openInstanceFolder('atm10');

  btnSaveSettings.addEventListener('click', async () => {
    const newUsername = settingUsername.value.trim() || 'ShadowSeeker';
    const isEco = settingEcoMode ? settingEcoMode.checked : false;
    const lAction = settingLaunchAction ? settingLaunchAction.value : 'minimize-tray';
    const cTray = settingCloseToTray ? settingCloseToTray.checked : false;

    await api.saveConfig({
      username: newUsername,
      ecoMode: isEco,
      launchAction: lAction,
      closeToTray: cTray
    });
    await api.saveInstanceConfig('forbidden-requiem', { maxRam: parseInt(sliderRamFr.value, 10) });
    await api.saveInstanceConfig('atm10', { maxRam: parseInt(sliderRamAtm.value, 10) });

    if (isEco && window.particleSystem) {
      window.particleSystem.pause();
    } else if (!isEco && window.particleSystem) {
      window.particleSystem.resume();
    }

    appendLog('INFO', 'Configurações salvas com sucesso.');
    btnSaveSettings.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> <span>PREFERÊNCIAS SALVAS!</span>`;
    btnSaveSettings.style.background = 'linear-gradient(180deg, #16a34a 0%, #15803d 100%)';
    btnSaveSettings.style.borderColor = '#4ade80';
    btnSaveSettings.style.boxShadow = '0 0 25px rgba(34, 197, 94, 0.7)';

    setTimeout(() => {
      btnSaveSettings.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg> <span>SALVAR PREFERÊNCIAS</span>`;
      btnSaveSettings.style.background = '';
      btnSaveSettings.style.borderColor = '';
      btnSaveSettings.style.boxShadow = '';
    }, 1800);
  });

  // --- Logs Actions ---
  btnClearLogs.onclick = () => {
    consoleLogsContainer.innerHTML = '';
    logsBuffer = [];
  };

  btnExportLogs.onclick = () => {
    navigator.clipboard.writeText(logsBuffer.join('\n'));
    btnExportLogs.textContent = 'Copiado!';
    setTimeout(() => btnExportLogs.textContent = 'Copiar Logs', 1500);
  };

  await init();
  setInterval(refreshAllServers, 30000);
});

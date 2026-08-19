const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');
const configStore = require('./configStore');
const javaManager = require('./javaManager');

class GameLauncher {
  constructor() {
    this.gameProcess = null;
    this.isRunning = false;
  }

  /**
   * Recursively finds all .jar files in a directory
   */
  getAllJarsInDir(dirPath) {
    let results = [];
    if (!fs.existsSync(dirPath)) return results;

    const list = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const item of list) {
      const fullPath = path.join(dirPath, item.name);
      if (item.isDirectory()) {
        results = results.concat(this.getAllJarsInDir(fullPath));
      } else if (item.isFile() && item.name.endsWith('.jar')) {
        results.push(fullPath);
      }
    }
    return results;
  }

  /**
   * Generates a deterministic offline UUID from username
   */
  generateOfflineUuid(username) {
    const hash = crypto.createHash('md5').update('OfflinePlayer:' + username).digest('hex');
    return [
      hash.substring(0, 8),
      hash.substring(8, 12),
      hash.substring(12, 16),
      hash.substring(16, 20),
      hash.substring(20, 32)
    ].join('-');
  }

  buildClasspath(gameDir, activeVersionId, mcVersion, moduleJars = []) {
    const librariesDir = path.join(gameDir, 'libraries');
    const pathSeparator = process.platform === 'win32' ? ';' : ':';
    const jars = new Set();

    const loadLibsFromVersion = (verId) => {
      const vJsonPath = path.join(gameDir, 'versions', verId, `${verId}.json`);
      if (!fs.existsSync(vJsonPath)) return null;
      try {
        const vJson = JSON.parse(fs.readFileSync(vJsonPath, 'utf8'));
        for (const lib of (vJson.libraries || [])) {
          if (lib.rules) {
            let allowed = false;
            for (const r of lib.rules) {
              if (r.action === 'allow' && (!r.os || r.os.name === 'windows')) allowed = true;
              else if (r.action === 'disallow' && r.os && r.os.name === 'windows') allowed = false;
            }
            if (!allowed) continue;
          }

          let relPath = null;
          if (lib.downloads && lib.downloads.artifact && lib.downloads.artifact.path) {
            relPath = lib.downloads.artifact.path;
          } else if (lib.name) {
            const parts = lib.name.split(':');
            const group = parts[0];
            const name = parts[1];
            const version = parts[2];
            relPath = `${group.replace(/\./g, '/')}/${name}/${version}/${name}-${version}.jar`;
          }

          if (relPath) {
            const fullPath = path.join(librariesDir, relPath);
            if (fs.existsSync(fullPath)) {
              jars.add(path.normalize(fullPath));
            }
          }
        }
        return vJson;
      } catch (e) {
        return null;
      }
    };

    const mainVJson = loadLibsFromVersion(activeVersionId);
    if (mainVJson && mainVJson.inheritsFrom) {
      loadLibsFromVersion(mainVJson.inheritsFrom);
    } else if (activeVersionId !== mcVersion) {
      loadLibsFromVersion(mcVersion);
    }

    if (jars.size === 0 || mcVersion === '1.7.10') {
      const allJars = this.getAllJarsInDir(librariesDir);
      for (const j of allJars) jars.add(path.normalize(j));
    }

    const normalizedModuleJars = new Set(moduleJars.map(j => path.normalize(j).toLowerCase()));
    const finalJars = [];
    for (const j of jars) {
      const norm = path.normalize(j);
      const lower = norm.toLowerCase();
      // Filter out duplicate or conflicting module jars
      if (!normalizedModuleJars.has(lower) && !lower.includes('asm-9.3') && !lower.endsWith('asm-9.3.jar')) {
        finalJars.push(norm);
      }
    }

    // Only add vanilla client JAR if not running NeoForge (NeoForge loads its own patched client module)
    if (!activeVersionId.toLowerCase().includes('neoforge')) {
      const clientJar = path.join(gameDir, 'versions', mcVersion, `${mcVersion}.jar`);
      if (fs.existsSync(clientJar)) {
        finalJars.push(path.normalize(clientJar));
      }
    }

    return finalJars.join(pathSeparator);
  }

  /**
   * Launches Minecraft with Forge or NeoForge
   */
  async launch(gameDir, options = {}, onLog = () => {}, onStatusChange = () => {}) {
    if (this.isRunning) {
      throw new Error('O Minecraft já está em execução!');
    }

    const {
      username = configStore.get('username') || 'ShadowSeeker',
      minRam = configStore.get('minRam') || 2048,
      maxRam = configStore.get('maxRam') || 4096,
      jvmArgs = configStore.get('jvmArgs') || '',
      javaPathOverride = null,
      fullscreen = configStore.get('fullscreen') || false,
      windowWidth = configStore.get('windowWidth') || 1280,
      windowHeight = configStore.get('windowHeight') || 720
    } = options;

    // 0. Detect Manifest & Version Info
    let packManifest = null;
    const instManifestPath = path.join(path.dirname(gameDir), 'manifest.json');
    if (fs.existsSync(instManifestPath)) {
      try {
        packManifest = JSON.parse(fs.readFileSync(instManifestPath, 'utf8'));
      } catch (e) {}
    }

    const mcVersion = (packManifest && packManifest.minecraft && packManifest.minecraft.version) || '1.7.10';
    const targetJavaMajor = (packManifest && packManifest.java && packManifest.java.majorVersion) || (mcVersion.startsWith('1.21') ? 21 : 8);

    onLog({ level: 'INFO', message: '═══════════════════════════════════════════════════════════════' });
    onLog({ level: 'INFO', message: `       FORBIDDEN LAUNCHER • INICIALIZANDO MINECRAFT ${mcVersion}       ` });
    onLog({ level: 'INFO', message: '═══════════════════════════════════════════════════════════════' });

    // 1. Resolve Java Path
    let finalJavaPath = javaPathOverride;
    if (!finalJavaPath || !fs.existsSync(finalJavaPath)) {
      onLog({ level: 'INFO', message: `Procurando ambiente Java ${targetJavaMajor} compatível...` });
      finalJavaPath = await javaManager.getBestJavaPath(targetJavaMajor);
    }

    if (!finalJavaPath || !fs.existsSync(finalJavaPath)) {
      onLog({ level: 'WARN', message: `Nenhum Java ${targetJavaMajor} encontrado. Baixando Java ${targetJavaMajor} embutido...` });
      finalJavaPath = await javaManager.installBundledJava(targetJavaMajor, (p) => {
        onLog({ level: 'INFO', message: `[Java ${targetJavaMajor}] ${p.message} (${Math.round(p.percentage)}%)` });
      });
    }

    const javaTest = await javaManager.testJavaExecutable(finalJavaPath);
    onLog({ level: 'INFO', message: `Executável Java selecionado: ${finalJavaPath} (${javaTest.version}, 64-bit: ${javaTest.is64Bit})` });

    // 2. Resolve Paths & Active Version Profile
    let activeVersionId = mcVersion;
    const baseVersionsDir = path.join(gameDir, 'versions');
    if (fs.existsSync(baseVersionsDir)) {
      const subdirs = fs.readdirSync(baseVersionsDir);
      for (const dir of subdirs) {
        if (dir.toLowerCase().includes('neoforge') || (mcVersion === '1.7.10' && dir.toLowerCase().includes('forge'))) {
          activeVersionId = dir;
          break;
        }
      }
    }

    const versionsDir = path.join(gameDir, 'versions', activeVersionId);
    const librariesDir = path.join(gameDir, 'libraries');
    const nativesDir = path.join(gameDir, 'natives');
    const assetsDir = path.join(gameDir, 'assets');
    const pathSeparator = process.platform === 'win32' ? ';' : ':';

    // 3. Resolve Version Hierarchy Chain (e.g. [neoforge-21.1.235, 1.21.1])
    const loadVersionHierarchy = (verId) => {
      const chain = [];
      let currentId = verId;
      while (currentId) {
        const vPath = path.join(gameDir, 'versions', currentId, `${currentId}.json`);
        if (fs.existsSync(vPath)) {
          try {
            const vData = JSON.parse(fs.readFileSync(vPath, 'utf8'));
            chain.push(vData);
            currentId = vData.inheritsFrom || (currentId !== mcVersion ? mcVersion : null);
            if (chain.length > 5) break;
          } catch (e) {
            break;
          }
        } else {
          if (currentId !== mcVersion) currentId = mcVersion;
          else break;
        }
      }
      return chain;
    };

    const versionChain = loadVersionHierarchy(activeVersionId);

    let mainClass = mcVersion === '1.7.10' ? 'net.minecraft.launchwrapper.Launch' : 'net.minecraft.client.main.Main';
    let assetIndexName = mcVersion === '1.7.10' ? '1.7.10' : '17';
    let extraJvmArgs = [];
    let moduleJarsList = [];
    let rawGameArgs = [];
    let legacyMinecraftArgs = '';

    for (const vJson of versionChain) {
      if (vJson.mainClass && !mainClass) mainClass = vJson.mainClass;
      if (vJson.assets) assetIndexName = vJson.assets;
      else if (vJson.assetIndex && vJson.assetIndex.id) assetIndexName = vJson.assetIndex.id;

      if (vJson.minecraftArguments) {
        legacyMinecraftArgs = vJson.minecraftArguments;
      }
    }

    // Top-level version overrides mainClass if set
    if (versionChain.length > 0 && versionChain[0].mainClass) {
      mainClass = versionChain[0].mainClass;
    }

    // Parse JVM Arguments from hierarchy (top-down)
    for (const vJson of versionChain) {
      if (vJson.arguments && Array.isArray(vJson.arguments.jvm)) {
        for (let i = 0; i < vJson.arguments.jvm.length; i++) {
          const arg = vJson.arguments.jvm[i];
          if (typeof arg === 'string') {
            let replaced = arg
              .replace(/\$\{library_directory\}/g, librariesDir)
              .replace(/\$\{classpath_separator\}/g, pathSeparator)
              .replace(/\$\{natives_directory\}/g, nativesDir)
              .replace(/\$\{version_name\}/g, activeVersionId);

            // Detect module path (-p) entries
            if (arg === '-p' && i + 1 < vJson.arguments.jvm.length) {
              const nextVal = vJson.arguments.jvm[i + 1];
              if (typeof nextVal === 'string') {
                const modStr = nextVal.replace(/\$\{library_directory\}/g, librariesDir).replace(/\$\{classpath_separator\}/g, pathSeparator);
                moduleJarsList = modStr.split(pathSeparator);
              }
            }

            extraJvmArgs.push(replaced);
          }
        }
      }
    }

    // Parse Game Arguments from hierarchy (base version first, then loader version)
    for (let i = versionChain.length - 1; i >= 0; i--) {
      const vJson = versionChain[i];
      if (vJson.arguments && Array.isArray(vJson.arguments.game)) {
        for (const arg of vJson.arguments.game) {
          if (typeof arg === 'string') {
            rawGameArgs.push(arg);
          }
        }
      }
    }

    // 4. Assemble clean Classpath without conflicting module-path jars
    onLog({ level: 'INFO', message: `Montando classpath com bibliotecas (Perfil: ${activeVersionId})...` });
    const classPath = this.buildClasspath(gameDir, activeVersionId, mcVersion, moduleJarsList);

    // Replace ${classpath} in extraJvmArgs if present
    for (let i = 0; i < extraJvmArgs.length; i++) {
      if (extraJvmArgs[i] === '${classpath}' || extraJvmArgs[i].includes('${classpath}')) {
        extraJvmArgs[i] = extraJvmArgs[i].replace(/\$\{classpath\}/g, classPath);
      }
    }

    // JVM Arguments
    const userJvmSplits = jvmArgs.trim().split(/\s+/).filter(a => a.length > 0);
    const jvmArguments = [
      `-Xms${minRam}M`,
      `-Xmx${maxRam}M`,
      `-Djava.library.path=${nativesDir}`,
      `-Duser.language=pt`,
      `-Duser.country=BR`,
      ...extraJvmArgs,
      ...userJvmSplits
    ];

    if (mcVersion === '1.7.10') {
      jvmArguments.push('-Dfml.ignoreInvalidMinecraftCertificates=true');
      jvmArguments.push('-Dfml.ignorePatchDiscrepancies=true');
    }

    // If extraJvmArgs didn't contain -cp, add it
    if (!extraJvmArgs.includes('-cp')) {
      jvmArguments.push('-cp', classPath, mainClass);
    } else {
      jvmArguments.push(mainClass);
    }

    // 5. Resolve Template Variables for Version Arguments
    const authType = configStore.get('authType') || 'offline';
    const msAccount = configStore.get('microsoftAccount');
    const uuid = this.generateOfflineUuid(username);

    let finalUsername = username;
    let finalUuid = uuid;
    let finalAccessToken = '00000000000000000000000000000000';
    let userType = 'legacy';

    if (authType === 'microsoft' && msAccount && msAccount.accessToken) {
      finalUsername = msAccount.username;
      finalUuid = msAccount.uuid;
      finalAccessToken = msAccount.accessToken;
      userType = 'msa';
      onLog({ level: 'INFO', message: `Autenticação: Conta Microsoft Original (MSA) • ${finalUsername}` });
    } else {
      onLog({ level: 'INFO', message: `Autenticação: Modo Offline • ${finalUsername}` });
    }

    const templateVars = {
      '${auth_player_name}': finalUsername,
      '${version_name}': activeVersionId,
      '${game_directory}': gameDir,
      '${assets_root}': assetsDir,
      '${game_assets}': assetsDir,
      '${assets_index_name}': assetIndexName,
      '${auth_uuid}': finalUuid,
      '${auth_access_token}': finalAccessToken,
      '${auth_session}': finalAccessToken,
      '${clientid}': '0',
      '${auth_xuid}': '0',
      '${user_type}': userType,
      '${user_properties}': '{}',
      '${version_type}': 'release',
      '${natives_directory}': nativesDir,
      '${launcher_name}': 'ForbiddenLauncher',
      '${launcher_version}': '1.0.3',
      '${classpath}': classPath,
      '${library_directory}': librariesDir,
      '${classpath_separator}': pathSeparator
    };

    // 6. Assemble Game Arguments
    const gameArguments = [];
    if (rawGameArgs.length > 0) {
      for (const arg of rawGameArgs) {
        let replaced = arg;
        for (const [key, val] of Object.entries(templateVars)) {
          replaced = replaced.split(key).join(val);
        }
        gameArguments.push(replaced);
      }
    } else if (legacyMinecraftArgs) {
      // Legacy minecraftArguments string (Forge 1.7.10)
      let replaced = legacyMinecraftArgs;
      for (const [key, val] of Object.entries(templateVars)) {
        replaced = replaced.split(key).join(val);
      }
      gameArguments.push(...replaced.split(/\s+/).filter(a => a.length > 0));
    } else {
      // Direct Fallback
      gameArguments.push(
        '--username', finalUsername,
        '--version', activeVersionId,
        '--gameDir', gameDir,
        '--assetsDir', assetsDir,
        '--assetIndex', assetIndexName,
        '--uuid', finalUuid,
        '--accessToken', finalAccessToken,
        '--userType', userType,
        '--versionType', 'release'
      );
    }

    if (mcVersion === '1.7.10' && !gameArguments.includes('--tweakClass')) {
      gameArguments.push('--tweakClass', 'cpw.mods.fml.common.launcher.FMLTweaker');
    }

    if (fullscreen) {
      gameArguments.push('--fullscreen');
    } else {
      gameArguments.push('--width', String(windowWidth));
      gameArguments.push('--height', String(windowHeight));
    }

    const fullArgs = [...jvmArguments, ...gameArguments];

    onLog({ level: 'INFO', message: `Jogador: ${username} (UUID: ${uuid})` });
    onLog({ level: 'INFO', message: `Memória alocada: ${minRam} MB min / ${maxRam} MB max` });
    onLog({ level: 'INFO', message: `Diretório do jogo: ${gameDir}` });
    onLog({ level: 'INFO', message: `Iniciando processo do Minecraft ${mcVersion}...` });

    this.isRunning = true;
    onStatusChange('running');

    try {
      this.gameProcess = spawn(finalJavaPath, fullArgs, {
        cwd: gameDir,
        env: {
          ...process.env,
          APPDATA: path.dirname(gameDir)
        }
      });

      this.gameProcess.stdout.on('data', (data) => {
        const lines = data.toString('utf8').split(/\r?\n/).filter(l => l.trim().length > 0);
        for (const line of lines) {
          onLog({ level: 'GAME', message: line });
        }
      });

      this.gameProcess.stderr.on('data', (data) => {
        const lines = data.toString('utf8').split(/\r?\n/).filter(l => l.trim().length > 0);
        for (const line of lines) {
          const isWarn = line.includes('WARN') || line.includes('WARNING');
          const isErr = line.includes('ERROR') || line.includes('FATAL') || line.includes('Exception');
          onLog({
            level: isErr ? 'ERROR' : (isWarn ? 'WARN' : 'GAME'),
            message: line
          });
        }
      });

      this.gameProcess.on('error', (err) => {
        onLog({ level: 'ERROR', message: `Falha ao executar o processo Java: ${err.message}` });
        this.isRunning = false;
        onStatusChange('idle');
      });

      this.gameProcess.on('close', (code) => {
        this.isRunning = false;
        this.gameProcess = null;
        onStatusChange('idle');

        if (code === 0) {
          onLog({ level: 'INFO', message: 'Minecraft finalizado com sucesso (código 0).' });
        } else {
          onLog({ level: 'WARN', message: `Minecraft fechou com código de saída: ${code}` });
          if (code === 1) {
            onLog({ level: 'ERROR', message: `DICA: Verifique se a alocação de memória RAM é suficiente e se o Java ${targetJavaMajor} é de 64 bits.` });
          }
        }
      });

      return true;
    } catch (launchErr) {
      this.isRunning = false;
      onStatusChange('idle');
      onLog({ level: 'ERROR', message: `Erro fatal no disparo do jogo: ${launchErr.message}` });
      throw launchErr;
    }
  }

  /**
   * Kills the game process if currently active
   */
  kill() {
    if (this.gameProcess && this.isRunning) {
      try {
        this.gameProcess.kill('SIGKILL');
        this.isRunning = false;
        return true;
      } catch (e) {
        console.error('Erro ao encerrar processo do Minecraft:', e);
      }
    }
    return false;
  }
}

module.exports = new GameLauncher();

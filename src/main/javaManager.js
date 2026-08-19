const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const AdmZip = require('adm-zip');
const downloader = require('./downloader');
const configStore = require('./configStore');

class JavaManager {
  constructor() {
    this.runtimesDir = path.join(configStore.getBaseDir(), 'runtimes');
  }

  getExecutableName() {
    return process.platform === 'win32' ? 'java.exe' : 'java';
  }

  getRuntimeDir(majorVersion = 8) {
    return path.join(this.runtimesDir, `java-${majorVersion}`);
  }

  async testJavaExecutable(javaPath) {
    return new Promise((resolve) => {
      if (!fs.existsSync(javaPath)) {
        return resolve({ valid: false, reason: 'Arquivo não encontrado' });
      }

      execFile(javaPath, ['-version'], (error, stdout, stderr) => {
        const output = (stderr || '') + (stdout || '');
        if (error && !output) {
          return resolve({ valid: false, reason: error.message });
        }

        const versionMatch = output.match(/version "(.*?)"/i) || output.match(/openjdk version "(.*?)"/i);
        const is64Bit = output.includes('64-Bit') || output.includes('x86_64') || output.includes('amd64');
        const versionString = versionMatch ? versionMatch[1] : 'Desconhecida';

        let major = 8;
        if (versionString.startsWith('1.8') || versionString.startsWith('8.')) major = 8;
        else if (versionString.startsWith('21.')) major = 21;
        else if (versionString.startsWith('17.')) major = 17;
        else {
          const firstNum = parseInt(versionString.split('.')[0], 10);
          if (!isNaN(firstNum)) major = firstNum;
        }

        resolve({
          valid: true,
          path: javaPath,
          version: versionString,
          majorVersion: major,
          is64Bit,
          rawOutput: output
        });
      });
    });
  }

  async findAvailableJava(targetMajor = 8) {
    const candidates = [];
    const exeName = this.getExecutableName();

    // 1. Check Bundled runtime in launcher directory
    const bundledPath = path.join(this.getRuntimeDir(targetMajor), 'bin', exeName);
    if (fs.existsSync(bundledPath)) {
      candidates.push({ path: bundledPath, source: `Embutido (Java ${targetMajor})` });
    }

    // 2. Check Standard Windows paths
    if (process.platform === 'win32') {
      const standardRoots = [
        'C:\\Program Files\\Eclipse Adoptium',
        'C:\\Program Files\\Java',
        'C:\\Program Files\\BellSoft',
        'C:\\Program Files\\Amazon Corretto',
        'C:\\Program Files\\Zulu'
      ];

      for (const root of standardRoots) {
        if (fs.existsSync(root)) {
          const direct = path.join(root, 'bin', exeName);
          if (fs.existsSync(direct)) candidates.push({ path: direct, source: root });

          try {
            const subdirs = fs.readdirSync(root);
            for (const sub of subdirs) {
              const subJava = path.join(root, sub, 'bin', exeName);
              if (fs.existsSync(subJava)) {
                candidates.push({ path: subJava, source: path.join(root, sub) });
              }
            }
          } catch (e) {}
        }
      }
    }

    // 3. Check JAVA_HOME
    if (process.env.JAVA_HOME) {
      const homeJava = path.join(process.env.JAVA_HOME, 'bin', exeName);
      if (fs.existsSync(homeJava)) {
        candidates.push({ path: homeJava, source: 'JAVA_HOME' });
      }
    }

    const results = [];
    for (const cand of candidates) {
      const test = await this.testJavaExecutable(cand.path);
      if (test.valid && test.majorVersion === targetMajor) {
        results.push({ ...cand, ...test });
      }
    }

    return results;
  }

  async getBestJavaPath(targetMajor = 8) {
    const list = await this.findAvailableJava(targetMajor);
    const bundled = list.find(j => j.path.includes(`java-${targetMajor}`) && j.majorVersion === targetMajor);
    if (bundled) return bundled.path;

    const matched64 = list.find(j => j.majorVersion === targetMajor && j.is64Bit);
    if (matched64) return matched64.path;

    const matched = list.find(j => j.majorVersion === targetMajor);
    if (matched) return matched.path;

    return null;
  }

  async installBundledJava(targetMajor = 8, onProgress = () => {}) {
    const exeName = this.getExecutableName();
    const runtimeDir = this.getRuntimeDir(targetMajor);
    const targetJavaExe = path.join(runtimeDir, 'bin', exeName);

    if (fs.existsSync(targetJavaExe)) {
      const test = await this.testJavaExecutable(targetJavaExe);
      if (test.valid && test.majorVersion === targetMajor) {
        return targetJavaExe;
      }
    }

    if (!fs.existsSync(this.runtimesDir)) {
      fs.mkdirSync(this.runtimesDir, { recursive: true });
    }

    const zipTempPath = path.join(this.runtimesDir, `java${targetMajor}_download.zip`);
    const downloadUrl = `https://api.adoptium.net/v3/binary/latest/${targetMajor}/ga/windows/x64/jre/hotspot/normal/eclipse?project=jdk`;

    onProgress({
      phase: 'downloading',
      message: `Baixando Java ${targetMajor} (Adoptium Temurin 64-bit)...`,
      percentage: 0
    });

    await downloader.downloadFile(downloadUrl, zipTempPath, {
      onProgress: (p) => {
        onProgress({
          phase: 'downloading',
          message: `Baixando Java ${targetMajor}...`,
          percentage: p.percentage,
          receivedBytes: p.receivedBytes,
          totalBytes: p.totalBytes,
          speedBytesPerSec: p.speedBytesPerSec
        });
      }
    });

    onProgress({
      phase: 'extracting',
      message: `Extraindo Java ${targetMajor}...`,
      percentage: 90
    });

    const zip = new AdmZip(zipTempPath);
    const extractDir = path.join(this.runtimesDir, `temp_extract_${targetMajor}`);
    if (fs.existsSync(extractDir)) {
      fs.rmSync(extractDir, { recursive: true, force: true });
    }
    zip.extractAllTo(extractDir, true);

    const entries = fs.readdirSync(extractDir);
    const rootFolder = entries.find(e => fs.existsSync(path.join(extractDir, e, 'bin', exeName))) || entries[0];
    const sourceDir = path.join(extractDir, rootFolder);

    if (fs.existsSync(runtimeDir)) {
      fs.rmSync(runtimeDir, { recursive: true, force: true });
    }

    fs.renameSync(sourceDir, runtimeDir);

    try {
      if (fs.existsSync(zipTempPath)) fs.unlinkSync(zipTempPath);
      if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true });
    } catch (e) {}

    onProgress({
      phase: 'complete',
      message: `Java ${targetMajor} pronto!`,
      percentage: 100
    });

    return targetJavaExe;
  }
}

module.exports = new JavaManager();

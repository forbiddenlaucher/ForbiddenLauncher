const fs = require('fs');
const path = require('path');
const downloader = require('./downloader');

class ForgeCore {
  constructor() {
    this.forgeVersion = '10.13.4.1614';
    this.mcVersion = '1.7.10';
    this.forgeFullId = `1.7.10-10.13.4.1614-1.7.10`;
  }

  getForgeJarRelativePath() {
    return path.join('net', 'minecraftforge', 'forge', this.forgeFullId, `forge-${this.forgeFullId}-universal.jar`);
  }

  getForgeLibraries() {
    return [
      {
        path: path.join('net', 'minecraftforge', 'forge', this.forgeFullId, `forge-${this.forgeFullId}-universal.jar`),
        url: `https://maven.minecraftforge.net/net/minecraftforge/forge/${this.forgeFullId}/forge-${this.forgeFullId}-universal.jar`
      },
      {
        path: path.join('net', 'minecraft', 'launchwrapper', '1.12', 'launchwrapper-1.12.jar'),
        url: 'https://libraries.minecraft.net/net/minecraft/launchwrapper/1.12/launchwrapper-1.12.jar'
      },
      {
        path: path.join('org', 'ow2', 'asm', 'asm-all', '5.0.3', 'asm-all-5.0.3.jar'),
        url: 'https://repo1.maven.org/maven2/org/ow2/asm/asm-all/5.0.3/asm-all-5.0.3.jar'
      },
      {
        path: path.join('lzma', 'lzma', '0.0.1', 'lzma-0.0.1.jar'),
        url: 'https://libraries.minecraft.net/lzma/lzma/0.0.1/lzma-0.0.1.jar'
      },
      {
        path: path.join('org', 'scala-lang', 'scala-library', '2.11.1', 'scala-library-2.11.1.jar'),
        url: 'https://repo1.maven.org/maven2/org/scala-lang/scala-library/2.11.1/scala-library-2.11.1.jar'
      },
      {
        path: path.join('org', 'scala-lang', 'scala-compiler', '2.11.1', 'scala-compiler-2.11.1.jar'),
        url: 'https://repo1.maven.org/maven2/org/scala-lang/scala-compiler/2.11.1/scala-compiler-2.11.1.jar'
      },
      {
        path: path.join('org', 'scala-lang', 'scala-reflect', '2.11.1', 'scala-reflect-2.11.1.jar'),
        url: 'https://repo1.maven.org/maven2/org/scala-lang/scala-reflect/2.11.1/scala-reflect-2.11.1.jar'
      },
      {
        path: path.join('org', 'scala-lang', 'modules', 'scala-parser-combinators_2.11', '1.0.1', 'scala-parser-combinators_2.11-1.0.1.jar'),
        url: 'https://repo1.maven.org/maven2/org/scala-lang/modules/scala-parser-combinators_2.11/1.0.1/scala-parser-combinators_2.11-1.0.1.jar'
      },
      {
        path: path.join('org', 'scala-lang', 'modules', 'scala-swing_2.11', '1.0.1', 'scala-swing_2.11-1.0.1.jar'),
        url: 'https://repo1.maven.org/maven2/org/scala-lang/modules/scala-swing_2.11/1.0.1/scala-swing_2.11-1.0.1.jar'
      },
      {
        path: path.join('org', 'scala-lang', 'modules', 'scala-xml_2.11', '1.0.2', 'scala-xml_2.11-1.0.2.jar'),
        url: 'https://repo1.maven.org/maven2/org/scala-lang/modules/scala-xml_2.11/1.0.2/scala-xml_2.11-1.0.2.jar'
      },
      {
        path: path.join('com', 'typesafe', 'akka', 'akka-actor_2.11', '2.3.3', 'akka-actor_2.11-2.3.3.jar'),
        url: 'https://repo1.maven.org/maven2/com/typesafe/akka/akka-actor_2.11/2.3.3/akka-actor_2.11-2.3.3.jar'
      },
      {
        path: path.join('com', 'typesafe', 'config', '1.2.1', 'config-1.2.1.jar'),
        url: 'https://repo1.maven.org/maven2/com/typesafe/config/1.2.1/config-1.2.1.jar'
      },
      {
        path: path.join('java3d', 'vecmath', '1.5.2', 'vecmath-1.5.2.jar'),
        url: 'https://libraries.minecraft.net/java3d/vecmath/1.5.2/vecmath-1.5.2.jar'
      },
      {
        path: path.join('com', 'google', 'guava', 'guava', '17.0', 'guava-17.0.jar'),
        url: 'https://repo1.maven.org/maven2/com/google/guava/guava/17.0/guava-17.0.jar'
      },
      {
        path: path.join('org', 'apache', 'commons', 'commons-lang3', '3.12.0', 'commons-lang3-3.12.0.jar'),
        url: 'https://repo1.maven.org/maven2/org/apache/commons/commons-lang3/3.12.0/commons-lang3-3.12.0.jar'
      },
      {
        path: path.join('net', 'sf', 'trove4j', 'trove4j', '3.0.3', 'trove4j-3.0.3.jar'),
        url: 'https://libraries.minecraft.net/net/sf/trove4j/trove4j/3.0.3/trove4j-3.0.3.jar'
      }
    ];
  }

  /**
   * Installs Forge 1.7.10 universal jar and required dependencies
   */
  async installForge(gameDir, onProgress = () => {}) {
    const librariesDir = path.join(gameDir, 'libraries');
    const forgeLibs = this.getForgeLibraries();
    const downloadQueue = [];

    for (const lib of forgeLibs) {
      const dest = path.join(librariesDir, lib.path);
      if (!fs.existsSync(dest)) {
        downloadQueue.push({
          url: lib.url,
          dest
        });
      }
    }

    if (downloadQueue.length > 0) {
      onProgress({
        phase: 'forge',
        message: `Instalando Forge ${this.forgeVersion} (${downloadQueue.length} arquivos)...`,
        percentage: 0
      });

      await downloader.downloadBatch(downloadQueue, (p) => {
        onProgress({
          phase: 'forge',
          message: `Baixando componentes do Forge: ${p.currentFile}`,
          percentage: p.percentage,
          downloadedBytes: p.downloadedBytes,
          totalBytes: p.totalBytes,
          speedBytesPerSec: p.speedBytesPerSec
        });
      });
    }

    // Configure Dark Fantasy Forge splash screen with active progress bars
    const configDir = path.join(gameDir, 'config');
    if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
    const splashPath = path.join(configDir, 'splash.properties');
    const splashContent = [
      '#Splash screen properties',
      'logoTexture=textures/gui/title/mojang.png',
      'background=0x0F0C13',
      'font=0xFFFFFF',
      'barBackground=0x1F1626',
      'barBorder=0xDC2626',
      'rotate=false',
      'bar=0xDC2626',
      'enabled=true',
      'resourcePackPath=resources',
      'logoOffset=0',
      'forgeTexture=fml:textures/gui/forge.gif',
      'fontTexture=textures/font/ascii.png'
    ].join('\n') + '\n';
    try {
      fs.writeFileSync(splashPath, splashContent, 'utf8');
    } catch (e) {}

    const forgeUniversalPath = path.join(librariesDir, this.getForgeJarRelativePath());
    return { forgeUniversalPath };
  }
}

module.exports = new ForgeCore();

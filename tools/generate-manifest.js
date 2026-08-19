#!/usr/bin/env node

/**
 * Forbidden Requiem - Manifest Generator Tool
 * Scans a folder containing 'mods', 'config', 'scripts', 'resourcepacks',
 * calculates SHA-256 hashes for each file, and exports a manifest.json.
 * 
 * Usage:
 *   node tools/generate-manifest.js --input ./my-pack --baseUrl https://seuservidor.com/files/ --version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function getArgs() {
  const args = process.argv.slice(2);
  const params = {
    input: './game',
    output: './manifest.json',
    baseUrl: 'https://seuservidor.com/files/',
    version: '1.0.0',
    name: 'Forbidden Requiem',
    chapter: 'CHAPTER I — THE FALLEN',
    minecraft: '1.7.10',
    forge: '10.13.4.1614'
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && args[i + 1]) params.input = args[++i];
    if (args[i] === '--output' && args[i + 1]) params.output = args[++i];
    if (args[i] === '--baseUrl' && args[i + 1]) params.baseUrl = args[++i];
    if (args[i] === '--version' && args[i + 1]) params.version = args[++i];
  }

  return params;
}

function calculateSha256(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex').toLowerCase();
}

function scanDirectory(dirPath, rootDir) {
  let fileList = [];
  if (!fs.existsSync(dirPath)) return fileList;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      fileList = fileList.concat(scanDirectory(fullPath, rootDir));
    } else if (entry.isFile()) {
      const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
      const stats = fs.statSync(fullPath);
      const sha256 = calculateSha256(fullPath);

      fileList.push({
        path: relativePath,
        sha256: sha256,
        size: stats.size
      });
    }
  }
  return fileList;
}

function main() {
  const params = getArgs();
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   GERADOR DE MANIFESTO DO FORBIDDEN REQUIEM LAUNCHER');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Diretório de origem: ${params.input}`);
  console.log(`Versão do Modpack:   ${params.version}`);
  console.log(`Base URL de download: ${params.baseUrl}\n`);

  const rootInput = path.resolve(params.input);
  if (!fs.existsSync(rootInput)) {
    console.error(`ERRO: Diretório de entrada '${rootInput}' não existe.`);
    process.exit(1);
  }

  // Folders to include in the manifest
  const targetFolders = ['mods', 'config', 'scripts', 'resourcepacks'];
  let allFiles = [];

  for (const folder of targetFolders) {
    const folderPath = path.join(rootInput, folder);
    if (fs.existsSync(folderPath)) {
      const files = scanDirectory(folderPath, rootInput);
      console.log(`✓ Pasta '${folder}': ${files.length} arquivos catalogados.`);
      allFiles = allFiles.concat(files);
    }
  }

  // Map to full URL
  const baseUrlClean = params.baseUrl.endsWith('/') ? params.baseUrl : `${params.baseUrl}/`;
  const manifestFiles = allFiles.map(f => ({
    path: f.path,
    url: `${baseUrlClean}${f.path}`,
    sha256: f.sha256,
    size: f.size
  }));

  const totalBytes = manifestFiles.reduce((acc, f) => acc + f.size, 0);
  const totalMb = (totalBytes / (1024 * 1024)).toFixed(2);
  const modsCount = manifestFiles.filter(f => f.path.startsWith('mods/')).length;

  const manifestData = {
    name: params.name,
    version: params.version,
    chapter: params.chapter,
    subtitle: "O mundo não deveria existir.",
    minecraft: params.minecraft,
    forge: params.forge,
    totalModsCount: modsCount || 84,
    featuredMods: [
      { name: "Thaumcraft 4", category: "Magia Oculta", description: "Manipule o Vis e desvende os mistérios proibidos da taumaturgia." },
      { name: "Blood Magic", category: "Alquimia de Sangue", description: "Sacrifique essência vital em altares de sangue para canalizar magias colossais." },
      { name: "Twilight Forest", category: "Dimensão Sombria", description: "Uma floresta de crepúsculo perpétuo governada por titãs e feras lendárias." },
      { name: "Witchery", category: "Bruxaria", description: "Rituais de invocação, maldições, vampirismo e licantropia." },
      { name: "Tinkers' Construct", category: "Forja Medieval", description: "Funda ligas proibidas de metais para forjar armas de corte." },
      { name: "Grimoire of Gaia 3", category: "Bestiário Hostil", description: "Criaturas mitológicas implacáveis que caçam nas ruínas." }
    ],
    files: manifestFiles
  };

  const outputPath = path.resolve(params.output);
  fs.writeFileSync(outputPath, JSON.stringify(manifestData, null, 2), 'utf8');

  console.log(`\n🎉 Manifesto gerado com sucesso em: ${outputPath}`);
  console.log(`Total de arquivos: ${manifestFiles.length} (${modsCount} mods)`);
  console.log(`Tamanho total:     ${totalMb} MB`);
  console.log('═══════════════════════════════════════════════════════════════');
}

main();

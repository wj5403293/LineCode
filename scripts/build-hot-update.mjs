#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync, statSync } from 'node:fs';
import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const DEFAULT_OUT_DIR = path.join(ROOT, 'dist', 'hot-update');
const DEFAULT_ENTRY = 'index.js';

function parseArgs(argv) {
  const args = {
    outDir: DEFAULT_OUT_DIR,
    entryFile: DEFAULT_ENTRY,
    platform: 'android',
    dev: false,
    sourcemap: false,
    clean: true,
    buildPrompt: true,
    hermesBytecode: 'auto',
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const readValue = () => {
      const value = argv[++i];
      if (!value || value.startsWith('--')) {
        throw new Error(`Missing value for ${arg}`);
      }
      return value;
    };

    if (arg === '--out-dir') args.outDir = path.resolve(ROOT, readValue());
    else if (arg === '--entry-file') args.entryFile = readValue();
    else if (arg === '--platform') args.platform = readValue();
    else if (arg === '--version-code') args.versionCode = Number(readValue());
    else if (arg === '--version-name') args.versionName = readValue();
    else if (arg === '--changelog') args.changelog = readValue();
    else if (arg === '--changelog-file') args.changelog = readFileSync(path.resolve(ROOT, readValue()), 'utf8').trim();
    else if (arg === '--dev') args.dev = true;
    else if (arg === '--sourcemap') args.sourcemap = true;
    else if (arg === '--hermes-bytecode') args.hermesBytecode = true;
    else if (arg === '--no-hermes-bytecode') args.hermesBytecode = false;
    else if (arg === '--no-clean') args.clean = false;
    else if (arg === '--skip-build-prompt') args.buildPrompt = false;
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (args.platform !== 'android') {
    throw new Error('Only android hot updates are supported by the app runtime.');
  }

  const appVersion = JSON.parse(readFileSync(path.join(ROOT, 'version.json'), 'utf8'));
  args.versionName ||= appVersion.version || '0.0.0';
  args.versionCode ||= appVersion.hotUpdateVersionCode || semverToCode(args.versionName);
  args.changelog ||= `Hot update ${args.versionName}`;

  if (!Number.isInteger(args.versionCode) || args.versionCode <= 0) {
    throw new Error('--version-code must be a positive integer.');
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node scripts/build-hot-update.mjs [options]

Options:
  --version-code <number>      Update versionCode. Defaults to version.json hotUpdateVersionCode.
  --version-name <name>        Update versionName. Defaults to version.json version.
  --changelog <text>           Changelog text written after the first two lines of base.zip.txt.
  --changelog-file <path>      Read changelog text from a file.
  --out-dir <path>             Output directory. Default: dist/hot-update
  --entry-file <path>          React Native entry file. Default: index.js
  --dev                        Build a dev bundle.
  --sourcemap                  Emit index.android.bundle.map and include it in manifest.
  --hermes-bytecode            Force compile index.android.bundle to Hermes bytecode.
  --no-hermes-bytecode         Keep index.android.bundle as plain JavaScript.
  --skip-build-prompt          Skip scripts/build-prompt.js.
  --no-clean                   Do not remove the output directory before building.
`);
}

function semverToCode(version) {
  const [major = '0', minor = '0', patch = '0'] = version.split(/[+-]/)[0].split('.');
  return Number(major) * 1_000_000 + Number(minor) * 1_000 + Number(patch);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}`);
  }
}

function reactNativeBin() {
  const bin = path.join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'react-native.cmd' : 'react-native');
  return existsSync(bin) ? bin : 'react-native';
}

function osBin() {
  if (process.platform === 'win32') return 'win64-bin';
  if (process.platform === 'darwin') return 'osx-bin';
  if (process.platform === 'linux' && process.arch === 'x64') return 'linux64-bin';
  return null;
}

function hermesCBin() {
  return process.platform === 'win32' ? 'hermesc.exe' : 'hermesc';
}

function detectHermesc() {
  const override = process.env.REACT_NATIVE_OVERRIDE_HERMES_DIR;
  const candidates = [];
  if (override) {
    candidates.push(path.join(override, 'build', 'bin', hermesCBin()));
  }
  candidates.push(path.join(ROOT, 'node_modules', 'react-native', 'ReactAndroid', 'hermes-engine', 'build', 'hermes', 'bin', hermesCBin()));
  const bin = osBin();
  if (bin) {
    candidates.push(path.join(ROOT, 'node_modules', 'hermes-compiler', 'hermesc', bin, hermesCBin()));
  }
  return candidates.find(candidate => existsSync(candidate)) ?? null;
}

function isAndroidHermesEnabled() {
  const gradlePropertiesPath = path.join(ROOT, 'android', 'gradle.properties');
  if (!existsSync(gradlePropertiesPath)) return false;
  const gradleProperties = readFileSync(gradlePropertiesPath, 'utf8');
  const match = gradleProperties.match(/^\s*hermesEnabled\s*=\s*(.+?)\s*$/m);
  return match ? match[1].trim().toLowerCase() === 'true' : false;
}

function shouldBuildHermesBytecode(args) {
  if (args.hermesBytecode === true) return true;
  if (args.hermesBytecode === false) return false;
  return args.platform === 'android' && !args.dev && isAndroidHermesEnabled();
}

async function collectFiles(root, current = '') {
  const dir = current ? path.join(root, current) : root;
  const items = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const item of items) {
    const relative = current ? `${current}/${item.name}` : item.name;
    const absolute = path.join(root, relative);
    if (item.isDirectory()) {
      files.push(...await collectFiles(root, relative));
    } else if (item.isFile()) {
      files.push({
        path: relative.split(path.sep).join('/'),
        absolute,
      });
    }
  }

  return files.sort((a, b) => a.path.localeCompare(b.path));
}

async function fileMeta(file) {
  const data = await readFile(file.absolute);
  return {
    path: file.path,
    sha256: createHash('sha256').update(data).digest('hex'),
    size: data.length,
  };
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosDate, dosTime };
}

const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c >>> 0;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value) {
  const buffer = Buffer.allocUnsafe(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

function u32(value) {
  const buffer = Buffer.allocUnsafe(4);
  buffer.writeUInt32LE(value >>> 0);
  return buffer;
}

async function writeZip(sourceDir, zipPath) {
  const files = await collectFiles(sourceDir);
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { dosDate, dosTime } = dosDateTime();

  for (const file of files) {
    const name = Buffer.from(file.path, 'utf8');
    const data = await readFile(file.absolute);
    const compressed = deflateRawSync(data, { level: 9 });
    const checksum = crc32(data);

    const localHeader = Buffer.concat([
      u32(0x04034b50),
      u16(20),
      u16(0x0800),
      u16(8),
      u16(dosTime),
      u16(dosDate),
      u32(checksum),
      u32(compressed.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      name,
    ]);
    localParts.push(localHeader, compressed);

    centralParts.push(Buffer.concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0x0800),
      u16(8),
      u16(dosTime),
      u16(dosDate),
      u32(checksum),
      u32(compressed.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      name,
    ]));

    offset += localHeader.length + compressed.length;
  }

  const centralOffset = offset;
  const central = Buffer.concat(centralParts);
  const end = Buffer.concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(central.length),
    u32(centralOffset),
    u16(0),
  ]);

  await writeFile(zipPath, Buffer.concat([...localParts, central, end]));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const payloadDir = path.join(args.outDir, 'payload');
  const intermediateDir = path.join(args.outDir, '.intermediate');
  const bundlePath = path.join(payloadDir, 'index.android.bundle');
  const sourcemapPath = `${bundlePath}.map`;
  const zipPath = path.join(args.outDir, 'base.zip');
  const detailPath = path.join(args.outDir, 'base.zip.txt');

  if (args.clean) {
    rmSync(args.outDir, { recursive: true, force: true });
  }
  rmSync(intermediateDir, { recursive: true, force: true });
  await mkdir(payloadDir, { recursive: true });
  await mkdir(intermediateDir, { recursive: true });

  if (args.buildPrompt) {
    run(process.execPath, [path.join('scripts', 'build-prompt.js')]);
  }

  const useHermesBytecode = shouldBuildHermesBytecode(args);
  const metroBundlePath = useHermesBytecode
    ? path.join(intermediateDir, 'index.android.bundle.js')
    : bundlePath;
  const metroSourcemapPath = useHermesBytecode
    ? path.join(intermediateDir, 'index.android.bundle.packager.map')
    : sourcemapPath;

  const bundleArgs = [
    'bundle',
    '--platform', 'android',
    '--dev', String(Boolean(args.dev)),
    '--entry-file', args.entryFile,
    '--bundle-output', metroBundlePath,
    '--assets-dest', payloadDir,
  ];
  if (args.sourcemap) {
    bundleArgs.push('--sourcemap-output', metroSourcemapPath);
  }
  run(reactNativeBin(), bundleArgs);

  if (useHermesBytecode) {
    const hermesc = detectHermesc();
    if (!hermesc) {
      throw new Error('Hermes is enabled, but hermesc was not found. Run npm install or pass --no-hermes-bytecode to build a plain JS hot update.');
    }

    const bytecodePath = path.join(intermediateDir, 'index.android.bundle.hbc');
    const hermesArgs = [
      '-w',
      '-emit-binary',
      '-max-diagnostic-width=80',
      '-out',
      bytecodePath,
      metroBundlePath,
      '-O',
    ];
    if (args.sourcemap) {
      hermesArgs.push('-output-source-map');
    }
    run(hermesc, hermesArgs);
    await copyFile(bytecodePath, bundlePath);

    if (args.sourcemap) {
      run(process.execPath, [
        path.join('node_modules', 'react-native', 'scripts', 'compose-source-maps.js'),
        metroSourcemapPath,
        `${bytecodePath}.map`,
        '-o',
        sourcemapPath,
      ]);
    }
  }

  const filesBeforeManifest = (await collectFiles(payloadDir))
    .filter(file => file.path !== 'manifest.json');
  const manifestFiles = await Promise.all(filesBeforeManifest.map(fileMeta));
  const bundle = manifestFiles.find(file => file.path === 'index.android.bundle');
  if (!bundle) {
    throw new Error('React Native bundle was not generated.');
  }

  const manifest = {
    versionCode: args.versionCode,
    versionName: args.versionName,
    bundleFormat: useHermesBytecode ? 'hermes-bytecode' : 'js',
    bundle,
    files: manifestFiles,
  };
  await writeFile(path.join(payloadDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await writeZip(payloadDir, zipPath);
  await writeFile(detailPath, `${args.versionCode}\n${args.versionName}\n${args.changelog.trim()}\n`, 'utf8');

  const zipSize = statSync(zipPath).size;
  console.log('');
  console.log('Hot update generated:');
  console.log(`  ${path.relative(ROOT, zipPath)} (${zipSize} bytes)`);
  console.log(`  ${path.relative(ROOT, detailPath)}`);
  console.log(`  versionCode=${args.versionCode}`);
  console.log(`  versionName=${args.versionName}`);
  console.log(`  bundleFormat=${manifest.bundleFormat}`);
  console.log('');
  console.log('Upload these files to the update host:');
  console.log('  base.zip');
  console.log('  base.zip.txt');
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

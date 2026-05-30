import { randomBytes } from 'node:crypto';
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ARTIFACTS_DIR, DEFAULT_ARTIFACT_DIR, MANAGER_ROOT, REPO_ROOT } from './config.js';
import { assertSafeRelativePath, ensureDir, fileSha256Hex, isPathInside, toRelative } from './utils.js';

const INDEX_FILE = 'base.txt';
const LEGACY_INDEX_FILE = 'base.json';
const APK_PACKAGE_FILE_PATTERN = /^base-(remote|local)\.enc$/;

function detailFileForVersion(versionCode) {
  return `base-${versionCode}.txt`;
}

function legacyDetailFileForVersion(versionCode) {
  return `base-${versionCode}.json`;
}

function alternateMetadataFileName(fileName) {
  if (fileName.endsWith('.txt')) return fileName.replace(/\.txt$/, '.json');
  if (fileName.endsWith('.json')) return fileName.replace(/\.json$/, '.txt');
  return fileName;
}

function normalizeDetailMetadataFileName(fileName, versionCode) {
  const raw = String(fileName || '').trim();
  const fallback = detailFileForVersion(versionCode);
  if (!raw) return fallback;
  if (/^base-\d+\.json$/.test(raw)) return raw.replace(/\.json$/, '.txt');
  if (/^base-\d+\.txt$/.test(raw)) return raw;
  return raw;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

async function firstExistingFile(dir, names) {
  for (const name of unique(names)) {
    const absolute = path.join(dir, name);
    try {
      await stat(absolute);
      return { name, absolute };
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  return null;
}

export function resolveArtifactDir(input) {
  const raw = typeof input === 'string' && input.trim() ? input.trim() : DEFAULT_ARTIFACT_DIR;
  const resolved = path.resolve(path.isAbsolute(raw) ? raw : path.join(REPO_ROOT, raw));
  if (!isPathInside(REPO_ROOT, resolved)) {
    throw new Error('Artifact directory must be inside this repository.');
  }
  return resolved;
}

function normalizeReleaseDetail(input) {
  const versionCode = Number(input.versionCode ?? input.version_code);
  if (!Number.isInteger(versionCode) || versionCode <= 0) {
    throw new Error('release detail must contain a positive integer versionCode.');
  }
  return {
    versionCode,
    versionName: String(input.versionName ?? input.version_name ?? `v${versionCode}`),
    changelog: String(input.changelog || '').trim(),
    requiresApk: Boolean(input.requiresApk ?? input.requires_apk),
    apkUrl: String(input.apkUrl ?? input.apk_url ?? ''),
    createdAt: input.createdAt ?? input.created_at ?? new Date().toISOString(),
    zipSha256: input.artifact?.zipSha256 ?? input.zipSha256 ?? input.zip_sha256,
    zipSize: Number(input.artifact?.zipSize ?? input.zipSize ?? input.zip_size ?? 0),
    detailFile: normalizeDetailMetadataFileName(input.artifact?.detailFile ?? input.detailFile ?? input.detail_file, versionCode),
    apkPackages: normalizeApkPackages(input.artifact?.apkPackages ?? input.apkPackages ?? input.apk_packages),
  };
}

function normalizeApkPackages(input) {
  const packages = {};
  if (!input || typeof input !== 'object') return packages;
  for (const [runtime, entry] of Object.entries(input)) {
    if (!entry || typeof entry !== 'object') continue;
    const file = String(entry.file || '').trim();
    if (!APK_PACKAGE_FILE_PATTERN.test(file)) {
      throw new Error(`APK package for ${runtime} must be named base-remote.enc or base-local.enc.`);
    }
    packages[runtime] = {
      file,
      encryption: entry.encryption || 'xor-v1',
      sha256: String(entry.sha256 || '').toLowerCase(),
      size: Number(entry.size || 0),
      apkSha256: String(entry.apkSha256 ?? entry.apk_sha256 ?? '').toLowerCase(),
      apkSize: Number(entry.apkSize ?? entry.apk_size ?? 0),
      ...(entry.url ? { url: String(entry.url) } : {}),
    };
  }
  return packages;
}

export async function inspectArtifactDir(inputDir) {
  const artifactDir = resolveArtifactDir(inputDir);
  const zipPath = path.join(artifactDir, 'base.zip');
  const indexFile = await firstExistingFile(artifactDir, [INDEX_FILE, LEGACY_INDEX_FILE]);
  if (!indexFile) {
    throw new Error(`Artifact directory must contain ${INDEX_FILE}.`);
  }
  const indexPath = indexFile.absolute;
  const manifestPath = path.join(artifactDir, 'payload', 'manifest.json');
  const [zipBuffer, indexText, manifestText] = await Promise.all([
    readFile(zipPath),
    readFile(indexPath, 'utf8'),
    readFile(manifestPath, 'utf8'),
  ]);

  const index = JSON.parse(indexText);
  const currentInput = index.current || {};
  const current = normalizeReleaseDetail(currentInput);
  const rawDetailFile = currentInput.artifact?.detailFile ?? currentInput.detailFile ?? currentInput.detail_file;
  const detailFile = normalizeDetailMetadataFileName(rawDetailFile, current.versionCode);
  const detailFileEntry = await firstExistingFile(artifactDir, [
    rawDetailFile,
    detailFile,
    alternateMetadataFileName(detailFile),
    detailFileForVersion(current.versionCode),
    legacyDetailFileForVersion(current.versionCode),
  ]);
  if (!detailFileEntry) {
    throw new Error(`Artifact directory must contain ${detailFile}.`);
  }
  const detailPath = detailFileEntry.absolute;
  const detailJson = JSON.parse(await readFile(detailPath, 'utf8'));
  const detail = normalizeReleaseDetail(detailJson);
  const normalizedDetailFile = detailFile;
  const manifest = JSON.parse(manifestText);
  const manifestVersionCode = Number(manifest.versionCode ?? manifest.version_code);
  if (manifestVersionCode !== detail.versionCode) {
    throw new Error(`manifest versionCode ${manifestVersionCode} does not match ${normalizedDetailFile} ${detail.versionCode}.`);
  }

  const manifestVersionName = manifest.versionName ?? manifest.version_name;
  if (manifestVersionName && String(manifestVersionName) !== detail.versionName) {
    throw new Error(`manifest versionName ${manifestVersionName} does not match ${normalizedDetailFile} ${detail.versionName}.`);
  }

  const bundlePath = manifest.bundle?.path ?? manifest.bundlePath ?? manifest.bundle_path ?? 'index.android.bundle';
  assertSafeRelativePath(bundlePath);

  const files = new Map();
  for (const file of manifest.files || []) {
    if (!file.path || !file.sha256) continue;
    assertSafeRelativePath(file.path);
    files.set(file.path, file);
  }
  const bundleSha = manifest.bundle?.sha256 ?? manifest.bundleSha256 ?? manifest.bundle_sha256;
  if (bundleSha) files.set(bundlePath, { path: bundlePath, sha256: bundleSha, size: manifest.bundle?.size });
  if (!files.has(bundlePath)) throw new Error('manifest must include bundle sha256.');

  const verifiedFiles = [];
  for (const file of files.values()) {
    const absolute = path.join(artifactDir, 'payload', file.path);
    const buffer = await readFile(absolute);
    const sha256 = fileSha256Hex(buffer);
    if (sha256 !== String(file.sha256).toLowerCase()) {
      throw new Error(`sha256 mismatch for ${file.path}.`);
    }
    verifiedFiles.push({
      path: file.path,
      sha256,
      size: buffer.length,
    });
  }
  const verifiedApkPackages = await verifyApkPackages(artifactDir, detail.apkPackages);
  if (detail.requiresApk && Object.keys(verifiedApkPackages).length === 0 && !detail.apkUrl) {
    throw new Error('APK update requires base-remote.enc/base-local.enc or apkUrl.');
  }

  const zipStat = await stat(zipPath);
  const zipSha256 = fileSha256Hex(zipBuffer);
  return {
    artifactDir,
    artifactDirLabel: toRelative(REPO_ROOT, artifactDir),
    versionCode: detail.versionCode,
    versionName: detail.versionName,
    changelog: detail.changelog,
    requiresApk: detail.requiresApk,
    apkUrl: detail.apkUrl,
    apkPackages: verifiedApkPackages,
    manifest: {
      versionCode: manifestVersionCode,
      versionName: manifestVersionName || detail.versionName,
      bundlePath,
      fileCount: verifiedFiles.length,
      files: verifiedFiles,
    },
    localFiles: {
      zipPath,
      indexPath,
      detailPath,
      detailFile: normalizedDetailFile,
      zipSha256,
      zipSize: zipStat.size,
      indexSize: Buffer.byteLength(indexText, 'utf8'),
      detailSize: Buffer.byteLength(JSON.stringify(detailJson), 'utf8'),
      apkPackages: verifiedApkPackages,
    },
  };
}

async function verifyApkPackages(artifactDir, packages) {
  const verified = {};
  for (const [runtime, entry] of Object.entries(packages || {})) {
    const absolute = path.join(artifactDir, entry.file);
    const buffer = await readFile(absolute);
    const sha256 = fileSha256Hex(buffer);
    if (entry.sha256 && sha256 !== entry.sha256) {
      throw new Error(`sha256 mismatch for ${entry.file}.`);
    }
    verified[runtime] = {
      ...entry,
      sha256,
      size: buffer.length,
      path: absolute,
    };
  }
  return verified;
}

export async function archiveArtifact(inspection, previousReleases = []) {
  const id = `release-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
  const targetDir = path.join(ARTIFACTS_DIR, id);
  await mkdir(targetDir, { recursive: true });

  const zipTarget = path.join(targetDir, 'base.zip');
  const indexTarget = path.join(targetDir, INDEX_FILE);
  const detailTarget = path.join(targetDir, inspection.localFiles.detailFile);
  const apkPackageTargets = {};
  const releaseSummaries = buildReleaseChain(inspection, previousReleases);
  const index = {
    schemaVersion: 2,
    type: 'hot-update-index',
    generatedAt: new Date().toISOString(),
    current: releaseSummaries[releaseSummaries.length - 1],
    releases: releaseSummaries,
  };
  const copyTasks = [
    copyFile(inspection.localFiles.zipPath, zipTarget),
    copyFile(inspection.localFiles.detailPath, detailTarget),
    writeFile(indexTarget, `${JSON.stringify(index, null, 2)}\n`, 'utf8'),
  ];
  for (const [runtime, entry] of Object.entries(inspection.localFiles.apkPackages || {})) {
    const target = path.join(targetDir, entry.file);
    apkPackageTargets[runtime] = target;
    copyTasks.push(copyFile(entry.path, target));
  }
  await Promise.all(copyTasks);

  return {
    id,
    targetDir,
    zipTarget,
    indexTarget,
    detailTarget,
    local: {
      zipPath: toRelative(MANAGER_ROOT, zipTarget),
      indexPath: toRelative(MANAGER_ROOT, indexTarget),
      detailPath: toRelative(MANAGER_ROOT, detailTarget),
      apkPackages: Object.fromEntries(
        Object.entries(apkPackageTargets).map(([runtime, target]) => [runtime, toRelative(MANAGER_ROOT, target)]),
      ),
    },
    updateIndex: index,
  };
}

function buildReleaseChain(inspection, previousReleases) {
  const deletedVersionCodes = new Set(
    previousReleases
      .filter(release => release.status === 'deleted')
      .map(release => release.versionCode),
  );
  const activeOrPublished = previousReleases.flatMap(release => {
    if (release.status === 'deleted') return [];
    if (Array.isArray(release.updateIndex?.releases)) {
      return release.updateIndex.releases
        .map(normalizeChainItem)
        .filter(item => item && !deletedVersionCodes.has(item.versionCode));
    }
    return [releaseToSummary(release)];
  });
  const current = releaseToSummary({
    versionCode: inspection.versionCode,
    versionName: inspection.versionName,
    changelog: inspection.changelog,
    requiresApk: inspection.requiresApk,
    apkUrl: inspection.apkUrl,
    createdAt: new Date().toISOString(),
    local: {
      detailPath: inspection.localFiles.detailFile,
      zipPath: 'base.zip',
    },
    localFiles: inspection.localFiles,
  });
  const byVersion = new Map();
  for (const release of [...activeOrPublished, current]) {
    byVersion.set(release.versionCode, release);
  }
  return [...byVersion.values()].sort((a, b) => a.versionCode - b.versionCode);
}

function normalizeChainItem(item) {
  const versionCode = Number(item.versionCode ?? item.version_code);
  if (!Number.isInteger(versionCode) || versionCode <= 0) return null;
  const detailUrl = item.detailUrl ?? item.detail_url;
  const zipUrl = item.zipUrl ?? item.zip_url;
  return {
    versionCode,
    versionName: String(item.versionName ?? item.version_name ?? `v${versionCode}`),
    createdAt: item.createdAt ?? item.created_at ?? new Date().toISOString(),
    requiresApk: Boolean(item.requiresApk ?? item.requires_apk),
    apkUrl: String(item.apkUrl ?? item.apk_url ?? ''),
    apkPackages: normalizeApkPackages(item.apkPackages ?? item.apk_packages),
    changelog: String(item.changelog || ''),
    detailFile: normalizeDetailMetadataFileName(item.detailFile ?? item.detail_file, versionCode),
    zipFile: item.zipFile ?? item.zip_file ?? 'base.zip',
    zipSha256: item.zipSha256 ?? item.zip_sha256 ?? '',
    zipSize: Number(item.zipSize ?? item.zip_size ?? 0),
    ...(detailUrl ? { detailUrl } : {}),
    ...(zipUrl ? { zipUrl } : {}),
  };
}

function releaseToSummary(release) {
  const detailPath = release.local?.detailPath || release.localFiles?.detailFile || detailFileForVersion(release.versionCode);
  const apkPackages = normalizeApkPackages(release.localFiles?.apkPackages || release.apkPackages || {});
  return {
    versionCode: release.versionCode,
    versionName: release.versionName,
    createdAt: release.createdAt || new Date().toISOString(),
    requiresApk: Boolean(release.requiresApk),
    apkUrl: release.apkUrl || '',
    apkPackages,
    changelog: release.changelog || '',
    detailFile: normalizeDetailMetadataFileName(path.basename(detailPath), release.versionCode),
    zipFile: 'base.zip',
    zipSha256: release.localFiles?.zipSha256 || release.zipSha256 || '',
    zipSize: release.localFiles?.zipSize || release.zipSize || 0,
  };
}

export async function ensureArtifactStorage() {
  await ensureDir(ARTIFACTS_DIR);
}

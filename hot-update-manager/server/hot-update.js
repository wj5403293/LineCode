import { randomBytes } from 'node:crypto';
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ARTIFACTS_DIR, DEFAULT_ARTIFACT_DIR, MANAGER_ROOT, REPO_ROOT } from './config.js';
import { assertSafeRelativePath, ensureDir, fileSha256Hex, isPathInside, toRelative } from './utils.js';

const INDEX_FILE = 'base.txt';
const LEGACY_INDEX_FILE = 'base.json';

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
  };
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
    },
  };
}

export async function archiveArtifact(inspection, previousReleases = []) {
  const id = `release-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
  const targetDir = path.join(ARTIFACTS_DIR, id);
  await mkdir(targetDir, { recursive: true });

  const zipTarget = path.join(targetDir, 'base.zip');
  const indexTarget = path.join(targetDir, INDEX_FILE);
  const detailTarget = path.join(targetDir, inspection.localFiles.detailFile);
  const releaseSummaries = buildReleaseChain(inspection, previousReleases);
  const index = {
    schemaVersion: 2,
    type: 'hot-update-index',
    generatedAt: new Date().toISOString(),
    current: releaseSummaries[releaseSummaries.length - 1],
    releases: releaseSummaries,
  };
  await Promise.all([
    copyFile(inspection.localFiles.zipPath, zipTarget),
    copyFile(inspection.localFiles.detailPath, detailTarget),
    writeFile(indexTarget, `${JSON.stringify(index, null, 2)}\n`, 'utf8'),
  ]);

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
  return {
    versionCode: release.versionCode,
    versionName: release.versionName,
    createdAt: release.createdAt || new Date().toISOString(),
    requiresApk: Boolean(release.requiresApk),
    apkUrl: release.apkUrl || '',
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

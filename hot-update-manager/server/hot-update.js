import { randomBytes } from 'node:crypto';
import { copyFile, mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { ARTIFACTS_DIR, DEFAULT_ARTIFACT_DIR, MANAGER_ROOT, REPO_ROOT } from './config.js';
import { assertSafeRelativePath, ensureDir, fileSha256Hex, isPathInside, toRelative } from './utils.js';

export function resolveArtifactDir(input) {
  const raw = typeof input === 'string' && input.trim() ? input.trim() : DEFAULT_ARTIFACT_DIR;
  const resolved = path.resolve(path.isAbsolute(raw) ? raw : path.join(REPO_ROOT, raw));
  if (!isPathInside(REPO_ROOT, resolved)) {
    throw new Error('Artifact directory must be inside this repository.');
  }
  return resolved;
}

export function parseDetailText(text) {
  const lines = String(text).replace(/\r\n/g, '\n').split('\n');
  const versionCode = Number(lines[0]?.trim());
  if (!Number.isInteger(versionCode) || versionCode <= 0) {
    throw new Error('base.zip.txt first line must be a positive integer versionCode.');
  }
  const versionName = lines[1]?.trim() || `v${versionCode}`;
  return {
    versionCode,
    versionName,
    changelog: lines.slice(2).join('\n').trim(),
  };
}

export async function inspectArtifactDir(inputDir) {
  const artifactDir = resolveArtifactDir(inputDir);
  const zipPath = path.join(artifactDir, 'base.zip');
  const detailPath = path.join(artifactDir, 'base.zip.txt');
  const manifestPath = path.join(artifactDir, 'payload', 'manifest.json');
  const [zipBuffer, detailText, manifestText] = await Promise.all([
    readFile(zipPath),
    readFile(detailPath, 'utf8'),
    readFile(manifestPath, 'utf8'),
  ]);

  const detail = parseDetailText(detailText);
  const manifest = JSON.parse(manifestText);
  const manifestVersionCode = Number(manifest.versionCode ?? manifest.version_code);
  if (manifestVersionCode !== detail.versionCode) {
    throw new Error(`manifest versionCode ${manifestVersionCode} does not match base.zip.txt ${detail.versionCode}.`);
  }

  const manifestVersionName = manifest.versionName ?? manifest.version_name;
  if (manifestVersionName && String(manifestVersionName) !== detail.versionName) {
    throw new Error(`manifest versionName ${manifestVersionName} does not match base.zip.txt ${detail.versionName}.`);
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
  return {
    artifactDir,
    artifactDirLabel: toRelative(REPO_ROOT, artifactDir),
    versionCode: detail.versionCode,
    versionName: detail.versionName,
    changelog: detail.changelog,
    manifest: {
      versionCode: manifestVersionCode,
      versionName: manifestVersionName || detail.versionName,
      bundlePath,
      fileCount: verifiedFiles.length,
      files: verifiedFiles,
    },
    localFiles: {
      zipPath,
      detailPath,
      zipSha256: fileSha256Hex(zipBuffer),
      zipSize: zipStat.size,
      detailSize: Buffer.byteLength(detailText, 'utf8'),
    },
  };
}

export async function archiveArtifact(inspection) {
  const id = `release-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
  const targetDir = path.join(ARTIFACTS_DIR, id);
  await mkdir(targetDir, { recursive: true });

  const zipTarget = path.join(targetDir, 'base.zip');
  const detailTarget = path.join(targetDir, 'base.zip.txt');
  await Promise.all([
    copyFile(inspection.localFiles.zipPath, zipTarget),
    copyFile(inspection.localFiles.detailPath, detailTarget),
  ]);

  return {
    id,
    targetDir,
    zipTarget,
    detailTarget,
    local: {
      zipPath: toRelative(MANAGER_ROOT, zipTarget),
      detailPath: toRelative(MANAGER_ROOT, detailTarget),
    },
  };
}

export async function ensureArtifactStorage() {
  await ensureDir(ARTIFACTS_DIR);
}


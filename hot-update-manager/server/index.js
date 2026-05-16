import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import {
  CLIENT_DIST_DIR,
  DEFAULT_ARTIFACT_DIR,
  MANAGER_ROOT,
  PORT,
  REPO_ROOT,
} from './config.js';
import { assertAuthConfigured, clearSessionCookie, createSessionCookie, verifyAdminPassword, verifySessionFromRequest } from './auth.js';
import { archiveArtifact, ensureArtifactStorage, inspectArtifactDir } from './hot-update.js';
import { deleteFile, uploadReleasePair, verifyLanzouCookie } from './lanzou.js';
import { loadStore, publicStore, saveStore } from './store.js';
import { isPathInside, readJsonBody, sendJson, toRelative } from './utils.js';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.zip': 'application/zip',
  '.txt': 'text/plain; charset=utf-8',
};

assertAuthConfigured();
await ensureArtifactStorage();

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
      return;
    }
    if (url.pathname === '/base.zip' || url.pathname === '/base.zip.txt') {
      await serveActiveReleaseFile(res, url.pathname);
      return;
    }
    await serveClient(res, url);
  } catch (error) {
    const status = error.statusCode || 500;
    sendJson(res, status, {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Hot update manager listening on http://127.0.0.1:${PORT}`);
});

async function handleApi(req, res, url) {
  if (url.pathname === '/api/auth/login' && req.method === 'POST') {
    const body = await readJsonBody(req);
    if (!verifyAdminPassword(body.password)) {
      sendJson(res, 401, { ok: false, error: 'Invalid admin password.' });
      return;
    }
    sendJson(res, 200, { ok: true }, { 'set-cookie': createSessionCookie() });
    return;
  }

  if (!verifySessionFromRequest(req)) {
    sendJson(res, 401, { ok: false, error: 'Authentication required.' });
    return;
  }

  if (url.pathname === '/api/auth/me' && req.method === 'GET') {
    sendJson(res, 200, { ok: true, user: { role: 'admin' } });
    return;
  }

  if (url.pathname === '/api/auth/logout' && req.method === 'POST') {
    sendJson(res, 200, { ok: true }, { 'set-cookie': clearSessionCookie() });
    return;
  }

  if (url.pathname === '/api/summary' && req.method === 'GET') {
    const store = await loadStore();
    sendJson(res, 200, {
      ok: true,
      data: {
        ...publicStore(store),
        defaults: {
          artifactDir: toRelative(REPO_ROOT, DEFAULT_ARTIFACT_DIR),
        },
        updateHost: {
          zipPath: '/base.zip',
          detailPath: '/base.zip.txt',
        },
      },
    });
    return;
  }

  if (url.pathname === '/api/lanzou/connect' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const cookie = String(body.cookie || '').trim();
    const folderId = Number.isFinite(Number(body.folderId)) ? Number(body.folderId) : -1;
    if (!cookie) throw httpError(400, 'Lanzou cookie is required.');
    await verifyLanzouCookie(cookie, folderId);
    const store = await loadStore();
    store.settings.lanzou = {
      cookie,
      folderId,
      lastVerifiedAt: new Date().toISOString(),
      lastError: '',
    };
    await saveStore(store);
    sendJson(res, 200, { ok: true, data: publicStore(store).settings.lanzou });
    return;
  }

  if (url.pathname === '/api/lanzou/test' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const store = await loadStore();
    const cookie = String(body.cookie || '').trim() || store.settings.lanzou.cookie;
    const folderId = Number.isFinite(Number(body.folderId)) ? Number(body.folderId) : store.settings.lanzou.folderId;
    await verifyLanzouCookie(cookie, folderId);
    if (body.cookie) store.settings.lanzou.cookie = cookie;
    store.settings.lanzou.folderId = folderId;
    store.settings.lanzou.lastVerifiedAt = new Date().toISOString();
    store.settings.lanzou.lastError = '';
    await saveStore(store);
    sendJson(res, 200, { ok: true, data: publicStore(store).settings.lanzou });
    return;
  }

  if (url.pathname === '/api/releases/scan' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const store = await loadStore();
    const inspection = await inspectArtifactDir(body.artifactDir || store.settings.artifactDir);
    store.settings.artifactDir = inspection.artifactDirLabel;
    await saveStore(store);
    sendJson(res, 200, { ok: true, data: inspection });
    return;
  }

  if (url.pathname === '/api/releases/publish' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const store = await loadStore();
    const inspection = await inspectArtifactDir(body.artifactDir || store.settings.artifactDir);
    const archived = await archiveArtifact(inspection);
    let cloud = null;
    let status = 'local';

    if (body.uploadToLanzou !== false) {
      const cleanupErrors = await deletePublishedLanzouReleases(store);
      if (cleanupErrors.length) {
        await saveStore(store);
        throw httpError(502, `删除旧蓝奏云文件失败，已停止上传: ${cleanupErrors.join('; ')}`);
      }
      cloud = await uploadReleasePair(store.settings.lanzou.cookie, store.settings.lanzou.folderId, {
        zipPath: archived.zipTarget,
        detailPath: archived.detailTarget,
      });
      status = 'published';
    }

    const release = {
      id: archived.id,
      versionCode: inspection.versionCode,
      versionName: inspection.versionName,
      changelog: inspection.changelog,
      status,
      active: Boolean(body.makeActive),
      createdAt: new Date().toISOString(),
      artifactDir: inspection.artifactDirLabel,
      manifest: inspection.manifest,
      local: archived.local,
      cloud,
    };

    if (release.active) {
      for (const existing of store.releases) existing.active = false;
    }
    store.settings.artifactDir = inspection.artifactDirLabel;
    store.releases.unshift(release);
    await saveStore(store);
    sendJson(res, 200, { ok: true, data: release });
    return;
  }

  const activateMatch = url.pathname.match(/^\/api\/releases\/([^/]+)\/activate$/);
  if (activateMatch && req.method === 'POST') {
    const releaseId = activateMatch[1];
    const store = await loadStore();
    const target = store.releases.find(item => item.id === releaseId);
    if (!target) throw httpError(404, 'Release not found.');
    if (target.status === 'deleted') throw httpError(409, 'Deleted release cannot be activated.');
    for (const release of store.releases) release.active = release.id === releaseId;
    await saveStore(store);
    sendJson(res, 200, { ok: true, data: target });
    return;
  }

  const deleteMatch = url.pathname.match(/^\/api\/releases\/([^/]+)$/);
  if (deleteMatch && req.method === 'DELETE') {
    const body = await readJsonBody(req).catch(() => ({}));
    const releaseId = deleteMatch[1];
    const store = await loadStore();
    const target = store.releases.find(item => item.id === releaseId);
    if (!target) throw httpError(404, 'Release not found.');
    const deleteCloud = body.deleteCloud !== false;
    const deleteErrors = deleteCloud ? await deleteReleaseCloudFiles(store, target) : [];
    target.status = 'deleted';
    target.active = false;
    target.deletedAt = new Date().toISOString();
    target.deleteErrors = deleteErrors;
    await saveStore(store);
    sendJson(res, deleteErrors.length ? 207 : 200, { ok: deleteErrors.length === 0, data: target, errors: deleteErrors });
    return;
  }

  throw httpError(404, 'API route not found.');
}

async function deletePublishedLanzouReleases(store) {
  const cleanupErrors = [];
  for (const release of store.releases) {
    if (release.status === 'deleted' || release.cloud?.provider !== 'lanzou') continue;
    const deleteErrors = await deleteReleaseCloudFiles(store, release);
    release.status = 'deleted';
    release.active = false;
    release.deletedAt = new Date().toISOString();
    release.deleteErrors = deleteErrors;
    cleanupErrors.push(...deleteErrors.map(error => `${release.versionName}: ${error}`));
  }
  return cleanupErrors;
}

async function deleteReleaseCloudFiles(store, release) {
  const deleteErrors = [];
  if (release.cloud?.provider !== 'lanzou') return deleteErrors;
  for (const file of [release.cloud.files?.zip, release.cloud.files?.detail]) {
    if (!file?.fileId) continue;
    try {
      await deleteFile(store.settings.lanzou.cookie, file.fileId, release.cloud.folderId);
    } catch (error) {
      deleteErrors.push(error instanceof Error ? error.message : String(error));
    }
  }
  return deleteErrors;
}

async function serveActiveReleaseFile(res, pathname) {
  const store = await loadStore();
  const active = store.releases.find(item => item.active && item.status !== 'deleted');
  if (!active) throw httpError(404, 'No active release.');
  const relative = pathname === '/base.zip' ? active.local?.zipPath : active.local?.detailPath;
  if (!relative) throw httpError(404, 'Active release file is missing.');
  const absolute = path.resolve(MANAGER_ROOT, relative);
  if (!isPathInside(MANAGER_ROOT, absolute)) throw httpError(403, 'Invalid release path.');
  await streamFile(res, absolute);
}

async function serveClient(res, url) {
  const requested = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  let target = path.resolve(CLIENT_DIST_DIR, `.${requested}`);
  if (!isPathInside(CLIENT_DIST_DIR, target)) throw httpError(403, 'Forbidden.');
  try {
    const fileStat = await stat(target);
    if (fileStat.isDirectory()) target = path.join(target, 'index.html');
  } catch {
    target = path.join(CLIENT_DIST_DIR, 'index.html');
  }
  await streamFile(res, target);
}

async function streamFile(res, absolute) {
  const fileStat = await stat(absolute);
  const ext = path.extname(absolute);
  res.writeHead(200, {
    'content-type': MIME_TYPES[ext] || 'application/octet-stream',
    'content-length': fileStat.size,
    'cache-control': ext === '.html' ? 'no-cache' : 'private, max-age=60',
  });
  createReadStream(absolute).pipe(res);
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

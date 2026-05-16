import { basename } from 'node:path';
import { readFile, stat } from 'node:fs/promises';

const PC_ORIGIN = 'https://pc.woozooo.com';
const DOUpload_URL = `${PC_ORIGIN}/doupload.php`;
const HTML5UP_URL = `${PC_ORIGIN}/html5up.php`;
const FILEUP_URL = `${PC_ORIGIN}/fileup.php`;
const FILEUP_FALLBACK_URL = 'https://up.woozooo.com/fileup.php';
const JSON_AJAX_ACCEPT = 'application/json, text/javascript, */*; q=0.01';

const COMMON_HEADERS = {
  accept: JSON_AJAX_ACCEPT,
  'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'cache-control': 'no-cache',
  pragma: 'no-cache',
  origin: PC_ORIGIN,
  referer: `${PC_ORIGIN}/mydisk.php`,
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  'user-agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:150.0) Gecko/20100101 Firefox/150.0',
  'x-requested-with': 'XMLHttpRequest',
};

async function fetchJson(url, options, action = 'Lanzou request') {
  const response = await fetch(url, options);
  const raw = await response.text();
  let json;
  try {
    json = JSON.parse(raw.replace(/^\uFEFF/, '').trim());
  } catch {
    const details = describeNonJsonResponse(response, raw);
    throw new Error(`${action} returned non-JSON response: HTTP ${response.status}. ${details}`);
  }
  if (!response.ok) {
    throw new Error(`${action} failed: HTTP ${response.status}`);
  }
  if (Object.prototype.hasOwnProperty.call(json, 'zt') && json.zt === undefined) {
    json.zt = 0;
  }
  return json;
}

async function postTask(cookie, body, options = {}) {
  if (!cookie) throw new Error('Lanzou cookie is not configured.');
  const requestCookie = options.folderId === undefined || options.folderId === null
    ? cookie
    : cookieForFolder(cookie, normalizeFolderId(options.folderId));
  return fetchJson(DOUpload_URL, {
    method: 'POST',
    headers: {
      ...COMMON_HEADERS,
      cookie: requestCookie,
      referer: options.referer || refererForUser(cookie),
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    body: new URLSearchParams(Object.entries(body).map(([key, value]) => [key, String(value)])),
  }, options.action || 'Lanzou task');
}

function assertLanzouSuccess(response, action) {
  if (response?.zt === 1) return response;
  const info = typeof response?.info === 'string' ? response.info : '';
  const text = typeof response?.text === 'string' ? response.text : '';
  throw new Error(`${action} failed: ${info || text || 'unknown Lanzou response'}`);
}

export async function verifyLanzouCookie(cookie, folderId = -1) {
  const response = await getFiles(cookie, folderId, 1);
  assertLanzouSuccess(response, 'Verify Lanzou cookie');
  return response;
}

export async function getFiles(cookie, folderId = -1, page = 1) {
  return postTask(cookie, {
    task: 5,
    folder_id: folderId || -1,
    pg: page,
  }, {
    folderId: folderId || -1,
  });
}

export async function shareFile(cookie, fileId) {
  const response = await postTask(cookie, {
    task: 22,
    file_id: fileId,
  });
  return assertLanzouSuccess(response, 'Share file');
}

export async function deleteFile(cookie, fileId, folderId) {
  const response = await postTask(cookie, {
    task: 6,
    file_id: fileId,
  }, {
    action: 'Delete file',
    folderId,
    referer: refererForUser(cookie),
  });
  return assertLanzouSuccess(response, 'Delete file');
}

export async function uploadFile(cookie, folderId, filePath) {
  if (!cookie) throw new Error('Lanzou cookie is not configured.');
  const filename = basename(filePath);
  const [data, fileStat] = await Promise.all([readFile(filePath), stat(filePath)]);
  const normalizedFolderId = normalizeFolderId(folderId);
  const response = await uploadWithFallback(cookie, normalizedFolderId, filename, data, fileStat);
  assertLanzouSuccess(response, `Upload ${filename}`);
  const uploaded = Array.isArray(response.text) ? response.text[0] : null;
  if (!uploaded?.id) throw new Error(`Upload ${filename} did not return file id.`);
  return uploaded;
}

export async function uploadAndShareFile(cookie, folderId, filePath) {
  const uploaded = await uploadFile(cookie, folderId, filePath);
  const shared = await shareFile(cookie, uploaded.id);
  const shareUrl = buildShareUrl(shared.info, uploaded);
  return {
    fileId: String(uploaded.id),
    shareId: String(shared.info?.f_id || uploaded.f_id || ''),
    name: uploaded.name_all || uploaded.name || basename(filePath),
    sizeLabel: uploaded.size || '',
    shareUrl,
    password: shared.info?.pwd || '',
    rawUpload: uploaded,
  };
}

export async function uploadReleasePair(cookie, folderId, releaseFiles) {
  const zip = await uploadAndShareFile(cookie, folderId, releaseFiles.zipPath);
  const detail = await uploadAndShareFile(cookie, folderId, releaseFiles.detailPath);
  return {
    provider: 'lanzou',
    folderId,
    uploadedAt: new Date().toISOString(),
    files: { zip, detail },
  };
}

function buildShareUrl(info, uploaded) {
  const base = String(info?.is_newd || uploaded?.is_newd || '').replace(/\/$/, '');
  const code = info?.f_id || uploaded?.f_id;
  if (!base || !code) return '';
  return `${base}/${code}`;
}

async function uploadWithFallback(cookie, folderId, filename, data, fileStat) {
  const strategies = [
    {
      label: 'pc-html5up folder_id_bb_n',
      url: HTML5UP_URL,
      origin: PC_ORIGIN,
      folderField: 'folder_id_bb_n',
      includeVie: true,
      includeVe: true,
      includeType: true,
      includeLastModifiedDate: true,
      includeSize: true,
      includeXRequestedWith: false,
      refererMode: 'user',
      accept: '*/*',
    },
    {
      label: 'pc-fileup folder_id_bb_n',
      url: FILEUP_URL,
      origin: PC_ORIGIN,
      folderField: 'folder_id_bb_n',
      includeVe: true,
      includeXRequestedWith: true,
      refererMode: 'folder',
      accept: 'application/json, text/javascript, */*; q=0.01',
    },
    {
      label: 'up-fileup folder_id',
      url: FILEUP_FALLBACK_URL,
      origin: 'https://up.woozooo.com',
      folderField: 'folder_id',
      includeVe: false,
      includeXRequestedWith: true,
      refererMode: 'folder',
      accept: 'application/json, text/javascript, */*; q=0.01',
    },
  ];
  const errors = [];

  for (const strategy of strategies) {
    try {
      return await uploadWithStrategy(strategy, cookie, folderId, filename, data, fileStat);
    } catch (error) {
      errors.push(`${strategy.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`Upload ${filename} failed after ${strategies.length} strategies.\n${errors.join('\n')}`);
}

async function uploadWithStrategy(strategy, cookie, folderId, filename, data, fileStat) {
  const type = contentTypeFor(filename);
  const form = new FormData();
  form.append('task', '1');
  if (strategy.includeVie) form.append('vie', '2');
  if (strategy.includeVe) form.append('ve', '2');
  form.append('id', 'WU_FILE_0');
  form.append('name', filename);
  if (strategy.includeType) form.append('type', type);
  if (strategy.includeLastModifiedDate) form.append('lastModifiedDate', formatLanzouDate(fileStat.mtime));
  if (strategy.includeSize) form.append('size', String(data.length));
  form.append(strategy.folderField, String(folderId));
  form.append('upload_file', new File([data], filename, { type }));

  const headers = {
    accept: strategy.accept,
    'accept-language': COMMON_HEADERS['accept-language'],
    'cache-control': COMMON_HEADERS['cache-control'],
    pragma: COMMON_HEADERS.pragma,
    origin: strategy.origin,
    referer: refererForStrategy(strategy, folderId, cookie),
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': COMMON_HEADERS['user-agent'],
    cookie: cookieForFolder(cookie, folderId),
  };
  if (strategy.includeXRequestedWith) {
    headers['x-requested-with'] = 'XMLHttpRequest';
  }

  return fetchJson(strategy.url, {
    method: 'POST',
    headers,
    body: form,
  }, `Upload ${filename} via ${strategy.label}`);
}

function normalizeFolderId(folderId) {
  const value = Number(folderId);
  return Number.isFinite(value) && value !== 0 ? value : -1;
}

function refererForFolder(folderId, origin = PC_ORIGIN) {
  if (folderId === -1) return `${origin}/mydisk.php`;
  return `${origin}/mydisk.php?item=files&action=index&folder_id=${encodeURIComponent(String(folderId))}`;
}

function refererForStrategy(strategy, folderId, cookie) {
  if (strategy.refererMode === 'user') {
    return refererForUser(cookie, strategy.origin);
  }
  return refererForFolder(folderId, strategy.origin);
}

function refererForUser(cookie, origin = PC_ORIGIN) {
  const userId = cookieValue(cookie, 'ylogin');
  if (!userId) return `${origin}/mydisk.php`;
  return `${origin}/mydisk.php?item=files&action=index&u=${encodeURIComponent(userId)}`;
}

function cookieForFolder(cookie, folderId) {
  const parts = String(cookie)
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)
    .filter(part => !part.toLowerCase().startsWith('folder_id_c='));
  parts.push(`folder_id_c=${folderId}`);
  return parts.join('; ');
}

function contentTypeFor(filename) {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.zip')) return 'application/zip';
  if (lower.endsWith('.txt')) return 'text/plain; charset=utf-8';
  return 'application/octet-stream';
}

function formatLanzouDate(date) {
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function cookieValue(cookie, name) {
  const prefix = `${name}=`;
  return String(cookie)
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(prefix))
    ?.slice(prefix.length) || '';
}

function describeNonJsonResponse(response, raw) {
  const title = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const text = stripHtml(raw)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 360);
  const contentType = response.headers.get('content-type') || 'unknown content-type';
  const finalUrl = response.url && response.url !== HTML5UP_URL && response.url !== FILEUP_URL && response.url !== FILEUP_FALLBACK_URL ? ` finalUrl=${response.url}` : '';
  const preview = title || text || raw.slice(0, 180).replace(/\s+/g, ' ');
  return `${contentType}.${finalUrl} preview="${preview}"`;
}

function stripHtml(value) {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ');
}

import RNFS from 'react-native-fs';

export const LANZOU_HOT_UPDATE_FOLDER_URL = 'https://wwbpm.lanzoue.com/b00tci5mxg';
export const LANZOU_HOT_UPDATE_PASSWORD = 'dfaj';

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_FOLDER_PAGES = 5;
const NATIVE_TEXT_DOWNLOAD_PREFIX = 'linecode_lanzou_text';
const DESKTOP_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const ACW_KEY = '3000176000856006061501533003690027800375';
const ACW_BOX = [
  0x0f, 0x23, 0x1d, 0x18, 0x21, 0x10, 0x01, 0x26, 0x0a, 0x09,
  0x13, 0x1f, 0x28, 0x1b, 0x16, 0x17, 0x19, 0x0d, 0x06, 0x0b,
  0x27, 0x12, 0x14, 0x08, 0x0e, 0x15, 0x20, 0x1a, 0x02, 0x1e,
  0x07, 0x04, 0x11, 0x05, 0x03, 0x1c, 0x22, 0x25, 0x0c, 0x24,
];

export interface LanzouSharedFile {
  fileId: string;
  name: string;
  sizeLabel: string;
  shareUrl: string;
}

export interface LanzouHotUpdateFiles {
  detail: LanzouSharedFile;
  zip: LanzouSharedFile;
}

interface FetchLike {
  (input: string, init?: RequestInit): Promise<Response>;
}

interface FolderParams {
  origin: string;
  folderId: string;
  uid: string;
  tokenTime: string;
  tokenKey: string;
}

interface LanzouFolderResponse {
  zt: number | string;
  info?: string;
  text?: Array<{
    id?: string;
    name?: string;
    name_all?: string;
    size?: string;
    t?: number | string;
  }>;
}

interface LanzouAjaxResponse {
  zt: number | string;
  info?: string;
  dom?: string | null;
  url?: string;
}

export async function resolveLanzouHotUpdateFiles(
  folderUrl = LANZOU_HOT_UPDATE_FOLDER_URL,
  password = LANZOU_HOT_UPDATE_PASSWORD,
  fetcher: FetchLike = fetch,
): Promise<LanzouHotUpdateFiles> {
  const files = await listLanzouFolderFiles(folderUrl, password, fetcher);
  const detail = files.find(file => file.name === 'base.zip.txt');
  const zip = files.find(file => file.name === 'base.zip');
  if (!detail || !zip) {
    const names = files.map(file => file.name).join(', ') || '空目录';
    throw new Error(`蓝奏云目录缺少 base.zip 或 base.zip.txt，当前文件: ${names}`);
  }
  return { detail, zip };
}

export async function fetchLanzouTextFile(fileUrl: string, fetcher: FetchLike = fetch): Promise<string> {
  const downloadUrl = await resolveLanzouDownloadUrl(fileUrl, fetcher);
  const init = {
    method: 'GET',
    headers: {
      ...baseHeaders(),
      Accept: 'text/plain, */*; q=0.8',
    },
  };
  const response = await fetchWithTimeout(downloadUrl, init, fetcher);
  if (!response.ok) {
    throw new Error(`下载蓝奏云文本失败: HTTP ${response.status}`);
  }
  const text = await readFetchedText(downloadUrl, init, response, fetcher);
  if (!text.trim()) {
    throw new Error(`下载蓝奏云文本返回空内容: HTTP ${response.status}, url=${downloadUrl}`);
  }
  return text;
}

export async function resolveLanzouDownloadUrl(fileUrl: string, fetcher: FetchLike = fetch): Promise<string> {
  const origin = originFromUrl(fileUrl);
  let cookie = '';
  let fileHtml = await fetchText(fileUrl, {
    headers: htmlHeaders(origin),
  }, fetcher);

  const acwArg = parseAcwArg(fileHtml);
  if (acwArg) {
    cookie = `acw_sc__v2=${computeAcwScV2(acwArg)}`;
    fileHtml = await fetchText(fileUrl, {
      headers: {
        ...htmlHeaders(origin),
        Cookie: cookie,
      },
    }, fetcher);
  }

  const iframePath = matchRequired(fileHtml, /<iframe[^>]+src=["']([^"']+)["']/i, '蓝奏云文件下载 iframe');
  const iframeUrl = resolveRelativeUrl(fileUrl, decodeHtml(iframePath));
  const iframeOrigin = originFromUrl(iframeUrl);
  const iframeHtml = await fetchText(iframeUrl, {
    headers: {
      ...htmlHeaders(iframeOrigin),
      Referer: fileUrl,
      ...(cookie ? { Cookie: cookie } : {}),
    },
  }, fetcher);

  const ajaxFileId = matchLastRequired(iframeHtml, /url\s*:\s*['"]\/ajaxm\.php\?file=(\d+)/gi, '蓝奏云 ajax 文件 ID');
  const sign = parseJsStringVar(iframeHtml, 'wp_sign');
  const ajaxData = parseJsStringVar(iframeHtml, 'ajaxdata');
  const kd = matchOptional(iframeHtml, /var\s+kdns\s*=\s*(\d+)/) || '1';
  const ajaxResponse = await postFormJson<LanzouAjaxResponse>(
    `${iframeOrigin}/ajaxm.php?file=${encodeURIComponent(ajaxFileId)}`,
    {
      action: 'downprocess',
      websignkey: ajaxData,
      signs: ajaxData,
      sign,
      websign: '',
      kd,
      ves: '1',
    },
    {
      Origin: iframeOrigin,
      Referer: iframeUrl,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    fetcher,
    '蓝奏云直链解析',
  );
  assertLanzouOk(ajaxResponse, '蓝奏云直链解析');

  const gatewayUrl = buildGatewayUrl(ajaxResponse);
  return resolveLanrarGatewayUrl(gatewayUrl, fetcher, ajaxResponse.url);
}

export function computeAcwScV2(arg1: string): string {
  const reordered: string[] = [];
  for (let i = 0; i < arg1.length; i += 1) {
    for (let j = 0; j < ACW_BOX.length; j += 1) {
      if (ACW_BOX[j] === i + 1) {
        reordered[j] = arg1[i];
      }
    }
  }

  const source = reordered.join('');
  let result = '';
  for (let i = 0; i < source.length && i < ACW_KEY.length; i += 2) {
    let value = (parseInt(source.slice(i, i + 2), 16) ^ parseInt(ACW_KEY.slice(i, i + 2), 16)).toString(16);
    if (value.length === 1) value = `0${value}`;
    result += value;
  }
  return result;
}

export function parseLanzouFolderParams(html: string, folderUrl: string): FolderParams {
  const origin = originFromUrl(folderUrl);
  assertNoAcwChallenge(html, '蓝奏云目录页');
  const folderId = firstMatchRequired(html, [
    /filemoreajax\.php\?file=(\d+)/i,
    /['"]fid['"]\s*:\s*['"]?(\d+)['"]?/i,
    /[?&]f=(\d+)(?:&|["'])/i,
    /[?&]id=(\d+)(?:&|["'])/i,
  ], '蓝奏云目录 ID');
  const uid = firstMatchRequired(html, [
    /['"]uid['"]\s*:\s*['"]([^'"]+)['"]/i,
    /['"]uid['"]\s*:\s*(\d+)/i,
  ], '蓝奏云用户 ID');
  const tokenTimeVar = matchRequired(html, /['"]t['"]\s*:\s*([A-Za-z_$][\w$]*)/i, '蓝奏云目录 t 参数');
  const tokenKeyVar = matchRequired(html, /['"]k['"]\s*:\s*([A-Za-z_$][\w$]*)/i, '蓝奏云目录 k 参数');
  return {
    origin,
    folderId,
    uid,
    tokenTime: parseJsStringVar(html, tokenTimeVar),
    tokenKey: parseJsStringVar(html, tokenKeyVar),
  };
}

async function listLanzouFolderFiles(
  folderUrl: string,
  password: string,
  fetcher: FetchLike,
): Promise<LanzouSharedFile[]> {
  const html = await fetchText(folderUrl, {
    headers: htmlHeaders(originFromUrl(folderUrl)),
  }, fetcher);
  const acwArg = parseAcwArg(html);
  const folderHtml = acwArg
    ? await fetchText(folderUrl, {
      headers: {
        ...htmlHeaders(originFromUrl(folderUrl)),
        Cookie: `acw_sc__v2=${computeAcwScV2(acwArg)}`,
      },
    }, fetcher)
    : html;
  const params = parseLanzouFolderParams(folderHtml, folderUrl);
  const result: LanzouSharedFile[] = [];

  for (let page = 1; page <= MAX_FOLDER_PAGES; page += 1) {
    const response = await postFormJson<LanzouFolderResponse>(
      `${params.origin}/filemoreajax.php?file=${encodeURIComponent(params.folderId)}`,
      {
        lx: '2',
        fid: params.folderId,
        uid: params.uid,
        pg: String(page),
        rep: '0',
        t: params.tokenTime,
        k: params.tokenKey,
        up: '1',
        ls: '1',
        pwd: password,
      },
      {
        Origin: params.origin,
        Referer: folderUrl,
      },
      fetcher,
      '蓝奏云目录列表',
    );

    if (String(response.zt) === '2') break;
    if (String(response.zt) === '3') {
      throw new Error(`蓝奏云目录密码错误: ${response.info || '请检查访问密码'}`);
    }
    assertLanzouOk(response, '蓝奏云目录列表');

    const pageFiles = Array.isArray(response.text) ? response.text : [];
    for (const item of pageFiles) {
      if (!item.id || item.id === '-1' || String(item.t) === '1') continue;
      const name = cleanFileName(item.name_all || item.name || '');
      if (!name) continue;
      result.push({
        fileId: item.id,
        name,
        sizeLabel: item.size || '',
        shareUrl: resolveRelativeUrl(folderUrl, `/${item.id}`),
      });
    }
    if (pageFiles.length < 50) break;
  }

  return result;
}

async function resolveLanrarGatewayUrl(
  gatewayUrl: string,
  fetcher: FetchLike,
  fallbackUrl?: string,
): Promise<string> {
  const origin = originFromUrl(gatewayUrl);
  const init = {
    method: 'GET',
    headers: htmlHeaders(origin),
  };
  const response = await fetchWithTimeout(gatewayUrl, init, fetcher);
  if (!response.ok) {
    throw new Error(`请求蓝奏云下载网关失败: HTTP ${response.status}`);
  }
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html') && response.url?.startsWith('https://')) {
    return response.url;
  }
  const html = await readFetchedText(gatewayUrl, init, response, fetcher);
  if (fallbackUrl?.startsWith('https://') && /系统发现您的网络异常|验证并下载/.test(html)) {
    return fallbackUrl;
  }
  if (!/ajax\.php/i.test(html)) {
    return response.url?.startsWith('https://') ? response.url : gatewayUrl;
  }

  const ajaxPath = matchOptional(html, /url\s*:\s*['"]([^'"]*ajax\.php)['"]/i) || 'ajax.php';
  const file = matchRequired(html, /['"]file['"]\s*:\s*['"]([^'"]+)['"]/i, '蓝奏云下载验证 file');
  const sign = matchRequired(html, /['"]sign['"]\s*:\s*['"]([^'"]+)['"]/i, '蓝奏云下载验证 sign');
  const verifyResponse = await postFormJson<LanzouAjaxResponse>(
    resolveRelativeUrl(`${origin}/file/`, ajaxPath),
    { file, el: '2', sign },
    {
      Origin: origin,
      Referer: gatewayUrl,
    },
    fetcher,
    '蓝奏云下载验证',
  );
  assertLanzouOk(verifyResponse, '蓝奏云下载验证');
  if (!verifyResponse.url || !verifyResponse.url.startsWith('https://')) {
    throw new Error('蓝奏云下载验证未返回 HTTPS 下载地址');
  }
  return verifyResponse.url;
}

async function fetchText(url: string, init: RequestInit, fetcher: FetchLike): Promise<string> {
  const requestInit = { method: 'GET', ...init };
  if (fetcher === fetch && hasHeader(requestInit.headers, 'Cookie')) {
    const text = await downloadTextWithRNFS(url, requestInit);
    if (!text.trim()) {
      throw new Error(`请求蓝奏云返回空内容: url=${url}`);
    }
    return text;
  }

  const response = await fetchWithTimeout(url, requestInit, fetcher);
  if (!response.ok) {
    throw new Error(`请求蓝奏云失败: HTTP ${response.status}`);
  }
  const text = await readFetchedText(url, requestInit, response, fetcher);
  if (!text.trim()) {
    const contentType = response.headers.get('content-type') || 'unknown';
    throw new Error(`请求蓝奏云返回空内容: HTTP ${response.status}, content-type=${contentType}, url=${url}`);
  }
  return text;
}

async function postFormJson<T>(
  url: string,
  body: Record<string, string>,
  headers: Record<string, string>,
  fetcher: FetchLike,
  action: string,
): Promise<T> {
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      ...jsonHeaders(originFromUrl(url)),
      ...headers,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    body: encodeForm(body),
  }, fetcher);
  const raw = await readResponseText(response);
  if (!response.ok) {
    throw new Error(`${action}失败: HTTP ${response.status}`);
  }
  try {
    return JSON.parse(raw.replace(/^\uFEFF/, '').trim()) as T;
  } catch {
    throw new Error(`${action}返回非 JSON: ${stripHtml(raw).slice(0, 160)}`);
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, fetcher: FetchLike): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    return await fetcher(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function readFetchedText(
  url: string,
  init: RequestInit,
  response: Response,
  fetcher: FetchLike,
): Promise<string> {
  const text = await readResponseText(response);
  if (text.trim() || fetcher !== fetch) return text;

  try {
    return await downloadTextWithRNFS(url, init);
  } catch (err) {
    console.warn('[LineCode] Lanzou native text fallback failed:', err);
    return text;
  }
}

async function readResponseText(response: Response): Promise<string> {
  const streamText = await readResponseStreamText(response);
  if (streamText !== null) return streamText;
  return response.text();
}

async function readResponseStreamText(response: Response): Promise<string | null> {
  const TextDecoderCtor = (globalThis as any).TextDecoder;
  const reader = (response as any).body?.getReader?.();
  if (!TextDecoderCtor || !reader) return null;

  const decoder = new TextDecoderCtor();
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return text;
}

async function downloadTextWithRNFS(url: string, init: RequestInit): Promise<string> {
  if (typeof RNFS.downloadFile !== 'function') {
    throw new Error('RNFS.downloadFile 不可用');
  }

  const baseDir = RNFS.TemporaryDirectoryPath || RNFS.CachesDirectoryPath || RNFS.DocumentDirectoryPath;
  const cleanDir = baseDir.replace(/\/$/, '');
  const targetPath = `${cleanDir}/${NATIVE_TEXT_DOWNLOAD_PREFIX}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}.txt`;

  try {
    const result = await RNFS.downloadFile({
      fromUrl: url,
      toFile: targetPath,
      headers: normalizeHeaders(init.headers),
      background: false,
      discretionary: false,
      connectionTimeout: DEFAULT_TIMEOUT_MS,
      readTimeout: DEFAULT_TIMEOUT_MS,
    }).promise;

    if (result.statusCode < 200 || result.statusCode >= 300) {
      throw new Error(`HTTP ${result.statusCode}`);
    }
    return RNFS.readFile(targetPath, 'utf8');
  } finally {
    if (await RNFS.exists(targetPath)) {
      await RNFS.unlink(targetPath);
    }
  }
}

function normalizeHeaders(headers: RequestInit['headers']): Record<string, string> | undefined {
  if (!headers) return undefined;
  const normalized: Record<string, string> = {};

  if (Array.isArray(headers)) {
    for (const [key, value] of headers) {
      normalized[String(key)] = String(value);
    }
    return normalized;
  }

  const forEach = (headers as any).forEach;
  if (typeof forEach === 'function') {
    forEach.call(headers, (value: unknown, key: unknown) => {
      normalized[String(key)] = String(value);
    });
    return normalized;
  }

  for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
    if (value !== undefined) {
      normalized[key] = String(value);
    }
  }
  return normalized;
}

function hasHeader(headers: RequestInit['headers'], targetName: string): boolean {
  const normalized = normalizeHeaders(headers);
  if (!normalized) return false;
  const target = targetName.toLowerCase();
  return Object.keys(normalized).some(key => key.toLowerCase() === target);
}

function buildGatewayUrl(response: LanzouAjaxResponse): string {
  const dom = response.dom?.replace(/\/$/, '');
  if (!dom || !response.url) {
    throw new Error('蓝奏云直链解析未返回下载网关地址');
  }
  if (response.url.startsWith('http://') || response.url.startsWith('https://')) {
    return response.url;
  }
  return `${dom}/file/${response.url}`;
}

function parseAcwArg(html: string): string | null {
  return matchOptional(html, /var\s+arg1\s*=\s*['"]([0-9a-fA-F]+)['"]/);
}

function parseJsStringVar(html: string, name: string): string {
  return matchRequired(html, new RegExp(`var\\s+${escapeRegExp(name)}\\s*=\\s*['"]([^'"]*)['"]`), `蓝奏云变量 ${name}`);
}

function matchRequired(html: string, pattern: RegExp, label: string): string {
  const value = matchOptional(html, pattern);
  if (value === null) {
    throw new Error(`无法解析${label}: ${htmlPreview(html)}`);
  }
  return value;
}

function firstMatchRequired(html: string, patterns: RegExp[], label: string): string {
  for (const pattern of patterns) {
    const value = matchOptional(html, pattern);
    if (value !== null) return value;
  }
  throw new Error(`无法解析${label}: ${htmlPreview(html)}`);
}

function matchLastRequired(html: string, pattern: RegExp, label: string): string {
  const matches = [...html.matchAll(pattern)];
  const value = matches[matches.length - 1]?.[1];
  if (!value) {
    throw new Error(`无法解析${label}`);
  }
  return decodeHtml(value);
}

function matchOptional(html: string, pattern: RegExp): string | null {
  const match = html.match(pattern);
  return match?.[1] ? decodeHtml(match[1]) : null;
}

function assertLanzouOk(response: { zt?: number | string; info?: string }, action: string): void {
  if (String(response.zt) === '1') return;
  throw new Error(`${action}失败: ${response.info || '未知响应'}`);
}

function assertNoAcwChallenge(html: string, label: string): void {
  if (parseAcwArg(html)) {
    throw new Error(`${label}仍在要求浏览器验证，无法解析蓝奏云目录 ID: ${htmlPreview(html)}`);
  }
}

function htmlPreview(html: string): string {
  return stripHtml(html)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240) || `empty html, length=${html.length}`;
}

function htmlHeaders(origin: string): Record<string, string> {
  return {
    ...baseHeaders(),
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    Referer: origin,
  };
}

function jsonHeaders(origin: string): Record<string, string> {
  return {
    ...baseHeaders(),
    Accept: 'application/json, text/javascript, */*; q=0.01',
    Origin: origin,
    Referer: origin,
    'X-Requested-With': 'XMLHttpRequest',
  };
}

function baseHeaders(): Record<string, string> {
  return {
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'User-Agent': DESKTOP_USER_AGENT,
  };
}

function encodeForm(body: Record<string, string>): string {
  return Object.entries(body)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

function cleanFileName(value: string): string {
  return stripHtml(decodeHtml(value)).trim();
}

function stripHtml(value: string): string {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ');
}

function decodeHtml(value: string): string {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function originFromUrl(url: string): string {
  const match = String(url).match(/^(https?:\/\/[^/]+)/i);
  if (!match) throw new Error(`非法 URL: ${url}`);
  return match[1].replace(/\/$/, '');
}

function resolveRelativeUrl(baseUrl: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const origin = originFromUrl(baseUrl);
  if (path.startsWith('/')) return `${origin}${path}`;
  const basePath = baseUrl.replace(/[?#].*$/, '').replace(/\/[^/]*$/, '/');
  return `${basePath}${path}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

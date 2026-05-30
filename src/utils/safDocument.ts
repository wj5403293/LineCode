export interface SafDocumentLike {
  uri?: string | null;
  name?: string | null;
}

interface SafDocumentNameOptions {
  preferredExtensions?: string[];
  fallbackName?: string;
}

function stripUriSuffix(value: string): string {
  return value.split(/[?#]/)[0];
}

function safeDecode(value: string): string {
  let decoded = value;
  for (let i = 0; i < 3; i += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }
  return decoded;
}

function stripKnownDocumentPrefix(value: string): string {
  const match = value.match(/^(primary|home|raw|msf|downloads?|[0-9a-f]{4}-[0-9a-f]{4}):(.+)$/i);
  return match ? match[2] : value;
}

function looksLikeSafDocumentId(value: string): boolean {
  return /^(primary|home|raw|msf|downloads?|[0-9a-f]{4}-[0-9a-f]{4}):/i.test(value)
    || /%2f/i.test(value)
    || /[\\/]/.test(value);
}

function displayNameFromCandidate(value?: string | null): string {
  const clean = stripUriSuffix((value || '').trim());
  if (!clean) return '';
  const decoded = safeDecode(clean).replace(/\\/g, '/');
  const withoutPrefix = stripKnownDocumentPrefix(decoded);
  const segments = withoutPrefix.split('/').filter(Boolean);
  const basename = segments.length > 0 ? segments[segments.length - 1] : withoutPrefix;
  return stripKnownDocumentPrefix(basename).trim();
}

function documentIdFromUri(uri: string): string {
  const cleanUri = stripUriSuffix(uri);
  for (const marker of ['/document/', '/tree/']) {
    const index = cleanUri.indexOf(marker);
    if (index >= 0) {
      return cleanUri.slice(index + marker.length);
    }
  }
  return cleanUri.split('/').pop() || '';
}

function normalizeExtensions(extensions: string[] | undefined): string[] {
  return (extensions || [])
    .map(ext => ext.trim().toLowerCase())
    .filter(Boolean)
    .map(ext => ext.startsWith('.') ? ext : `.${ext}`);
}

function hasPreferredExtension(name: string, extensions: string[]): boolean {
  const lowerName = name.trim().toLowerCase();
  return !!lowerName && extensions.some(ext => lowerName.endsWith(ext));
}

export function getSafUriDisplayName(uri?: string | null): string {
  if (!uri) return '';
  return displayNameFromCandidate(documentIdFromUri(uri));
}

export function getSafDocumentDisplayName(
  document: SafDocumentLike,
  options: SafDocumentNameOptions = {},
): string {
  const rawName = (document.name || '').trim();
  const name = displayNameFromCandidate(rawName);
  const uriName = getSafUriDisplayName(document.uri);
  const preferredExtensions = normalizeExtensions(options.preferredExtensions);

  if (preferredExtensions.length > 0) {
    if (hasPreferredExtension(name, preferredExtensions)) return name;
    if (hasPreferredExtension(uriName, preferredExtensions)) return uriName;
  }

  if (rawName && looksLikeSafDocumentId(rawName) && uriName) return uriName;
  return name || uriName || options.fallbackName || '';
}

export function hasSafDocumentExtension(document: SafDocumentLike, extensions: string[]): boolean {
  const preferredExtensions = normalizeExtensions(extensions);
  if (preferredExtensions.length === 0) return false;
  return hasPreferredExtension(displayNameFromCandidate(document.name), preferredExtensions)
    || hasPreferredExtension(getSafUriDisplayName(document.uri), preferredExtensions);
}

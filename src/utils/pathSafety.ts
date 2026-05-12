export function normalizePath(path: string): string {
  const isAbsolute = path.startsWith('/');
  const parts: string[] = [];

  for (const rawPart of path.split('/')) {
    const part = rawPart.trim();
    if (!part || part === '.') continue;
    if (part === '..') {
      parts.pop();
      continue;
    }
    parts.push(part);
  }

  return `${isAbsolute ? '/' : ''}${parts.join('/')}` || (isAbsolute ? '/' : '.');
}

export function resolvePathWithinRoot(inputPath: string | undefined, rootPath: string): string | null {
  const root = normalizePath(rootPath);
  const trimmed = (inputPath || '').trim();
  const combined = trimmed
    ? (trimmed.startsWith('/') ? trimmed : `${root}/${trimmed}`)
    : root;
  const resolved = normalizePath(combined);
  return isPathInsideRoot(resolved, root) ? resolved : null;
}

export function isPathInsideRoot(path: string, rootPath: string): boolean {
  const root = normalizePath(rootPath).replace(/\/+$/, '');
  const target = normalizePath(path).replace(/\/+$/, '');
  return target === root || target.startsWith(`${root}/`);
}

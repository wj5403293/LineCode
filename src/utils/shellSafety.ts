const DANGEROUS_SHELL_PATTERNS: RegExp[] = [
  /\brm\b/i,
  /\b(rmdir|unlink|shred)\b/i,
  /\bfind\b[\s\S]*\s-delete\b/i,
  /\b(dd|mkfs(?:\.\w+)?|fdisk|parted|sfdisk|wipefs)\b/i,
  /\b(shutdown|reboot|poweroff|halt)\b/i,
  /\b(kill|killall|pkill)\b/i,
  /(^|[;&|]\s*)(sudo|su)\b/i,
  /\bchmod\b[\s\S]*(\b777\b|\b666\b|\s-R\b|--recursive)/i,
  /\b(chown|chgrp)\b/i,
  /\bgit\s+(reset\s+--hard|clean\b|push\b[\s\S]*--force|branch\s+-D|checkout\s+-f|restore\b)/i,
  /\b(pkg|apt|apt-get|dnf|yum|brew|pacman)\s+(remove|purge|autoremove|uninstall)\b/i,
  /\bnpm\s+(uninstall|remove|rm)\b/i,
  /\b(pnpm|yarn)\s+(remove|unlink)\b/i,
  /\b(curl|wget)\b[\s\S]*\|\s*(sh|bash|zsh|python|python3|perl|ruby)\b/i,
  /(^|[;&|]\s*)(:>|truncate\s+-s\s+0)\b/i,
  />\s*\/(etc|bin|sbin|usr|var|boot|system)\b/i,
];

export function isDangerousShellCommand(command: string): boolean {
  const normalized = command
    .replace(/\\\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return false;
  return DANGEROUS_SHELL_PATTERNS.some(pattern => pattern.test(normalized));
}

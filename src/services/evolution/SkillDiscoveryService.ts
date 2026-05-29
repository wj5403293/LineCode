import RNFS from 'react-native-fs';
import { projectService } from '../ProjectService';
import { DiscoveredSkill, SkillLocation } from './types';

const MAX_SCAN_DEPTH = 4;

interface SkillRoot {
  path: string;
  location: SkillLocation;
}

function skillId(location: SkillLocation, skillMdPath: string): string {
  return `${location}:${skillMdPath}`.replace(/[^a-zA-Z0-9_:/.-]/g, '_');
}

function parseFrontmatterValue(content: string, key: string): string | undefined {
  const frontmatter = content.match(/^---\s*\n([\s\S]*?)\n---/);
  const source = frontmatter?.[1] || content;
  const match = source.match(new RegExp(`^${key}\\s*:\\s*["']?([^"'\\n]+)["']?\\s*$`, 'im'));
  return match?.[1]?.trim();
}

function parseSkillMarkdown(content: string, fallbackName: string): Pick<DiscoveredSkill, 'name' | 'description'> {
  const name = parseFrontmatterValue(content, 'name')
    || content.match(/^#\s+(.+)$/m)?.[1]?.trim()
    || fallbackName;
  const description = parseFrontmatterValue(content, 'description')
    || content.match(/^description\s*:\s*(.+)$/im)?.[1]?.trim()
    || content.split('\n').map(line => line.trim()).find(line => line && !line.startsWith('---') && !line.startsWith('#'));
  return { name, description };
}

export class SkillDiscoveryService {
  async getSkillRoots(homePath?: string): Promise<SkillRoot[]> {
    const roots: SkillRoot[] = [
      { path: `${projectService.getLinecodeRoot()}/skills`, location: 'app' },
    ];
    if (homePath) {
      roots.push({ path: `${homePath}/.linecode/skills`, location: 'project' });
    }
    return roots;
  }

  async discoverSkills(homePath?: string): Promise<DiscoveredSkill[]> {
    const roots = await this.getSkillRoots(homePath);
    const all: DiscoveredSkill[] = [];
    for (const root of roots) {
      all.push(...await this.scanRoot(root));
    }
    return all;
  }

  private async scanRoot(root: SkillRoot): Promise<DiscoveredSkill[]> {
    if (!await RNFS.exists(root.path)) return [];
    const found: DiscoveredSkill[] = [];
    await this.scanDir(root.path, root, found, 0);
    return found;
  }

  private async scanDir(path: string, root: SkillRoot, found: DiscoveredSkill[], depth: number): Promise<void> {
    if (depth > MAX_SCAN_DEPTH) return;
    let items: Awaited<ReturnType<typeof RNFS.readDir>>;
    try {
      items = await RNFS.readDir(path);
    } catch {
      return;
    }

    const directSkill = items.find(item => !item.isDirectory() && item.name.toLowerCase() === 'skill.md');
    if (directSkill) {
      const content = await RNFS.readFile(directSkill.path, 'utf8').catch(() => '');
      const parsed = parseSkillMarkdown(content, path.split('/').filter(Boolean).pop() || 'Skill');
      const now = Date.now();
      found.push({
        id: skillId(root.location, directSkill.path),
        name: parsed.name,
        description: parsed.description,
        rootPath: path,
        skillMdPath: directSkill.path,
        location: root.location,
        enabled: true,
        discoveredAt: now,
        updatedAt: now,
      });
      return;
    }

    for (const item of items) {
      if (item.isDirectory()) {
        await this.scanDir(item.path, root, found, depth + 1);
      }
    }
  }
}

export const skillDiscoveryService = new SkillDiscoveryService();

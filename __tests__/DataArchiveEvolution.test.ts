import RNFS from 'react-native-fs';
import { zipWithPassword } from 'react-native-zip-archive';
import { dataArchiveService } from '../src/services/DataArchiveService';

const files = new Map<string, string>();
const dirs = new Set<string>();
let capturedPayloadFiles: string[] = [];

function parentPath(path: string): string {
  const index = path.lastIndexOf('/');
  return index > 0 ? path.slice(0, index) : '';
}

function addDir(path: string): void {
  if (!path) return;
  dirs.add(path);
  const parent = parentPath(path);
  if (parent && parent !== path) addDir(parent);
}

function addFile(path: string, content: string): void {
  addDir(parentPath(path));
  files.set(path, content);
}

describe('DataArchiveService evolution export', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    files.clear();
    dirs.clear();
    capturedPayloadFiles = [];
    addDir('/tmp/lineai-test/.linecode');
    addDir('/tmp/lineai-test/.linecode/home');
    addDir('/tmp/lineai-test/.linecode/conversations');
    addDir('/tmp/lineai-test/.linecode/diffs');
    addFile('/tmp/lineai-test/.linecode/skills/demo/SKILL.md', 'name: demo');
    addFile('/tmp/lineai-test/.linecode/evolution/evolution-db.json', '{"schemaVersion":1}');

    (RNFS.exists as jest.Mock).mockImplementation((path: string) => Promise.resolve(files.has(path) || dirs.has(path)));
    (RNFS.mkdir as jest.Mock).mockImplementation((path: string) => {
      addDir(path);
      return Promise.resolve();
    });
    (RNFS.unlink as jest.Mock).mockImplementation((path: string) => {
      const prefix = `${path}/`;
      for (const file of [...files.keys()]) {
        if (file === path || file.startsWith(prefix)) files.delete(file);
      }
      for (const dir of [...dirs]) {
        if (dir === path || dir.startsWith(prefix)) dirs.delete(dir);
      }
      return Promise.resolve();
    });
    (RNFS.copyFile as jest.Mock).mockImplementation((source: string, target: string) => {
      addFile(target, files.get(source) || '');
      return Promise.resolve();
    });
    (RNFS.writeFile as jest.Mock).mockImplementation((path: string, content: string) => {
      addFile(path, content);
      return Promise.resolve();
    });
    (RNFS.readFile as jest.Mock).mockImplementation((path: string) => Promise.resolve(files.get(path) || ''));
    (RNFS.hash as jest.Mock).mockResolvedValue('hash');
    (RNFS.readDir as jest.Mock).mockImplementation((path: string) => {
      const prefix = `${path}/`;
      const entries = new Map<string, { path: string; directory: boolean; size: number }>();
      for (const dir of dirs) {
        if (!dir.startsWith(prefix)) continue;
        const rest = dir.slice(prefix.length);
        if (!rest || rest.includes('/')) continue;
        entries.set(rest, { path: dir, directory: true, size: 0 });
      }
      for (const [file, content] of files) {
        if (!file.startsWith(prefix)) continue;
        const rest = file.slice(prefix.length);
        if (!rest || rest.includes('/')) continue;
        entries.set(rest, { path: file, directory: false, size: content.length });
      }
      return Promise.resolve([...entries].map(([name, entry]) => ({
        name,
        path: entry.path,
        size: entry.size,
        isDirectory: () => entry.directory,
      })));
    });
    (zipWithPassword as jest.Mock).mockImplementation((sourceDir: string, zipPath: string) => {
      const prefix = `${sourceDir}/`;
      capturedPayloadFiles = [...files.keys()]
        .filter(path => path.startsWith(prefix))
        .map(path => path.slice(prefix.length));
      addFile(zipPath, 'zip');
      return Promise.resolve();
    });
  });

  it('includes global skills and evolution db in .linecode exports', async () => {
    await dataArchiveService.exportAllData();

    expect(capturedPayloadFiles).toContain('skills/demo/SKILL.md');
    expect(capturedPayloadFiles).toContain('evolution/evolution-db.json');
  });
});

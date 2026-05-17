import AsyncStorage from '@react-native-async-storage/async-storage';
import { diffService, DIFF_FILES_DIR } from '../src/services/DiffService';

describe('diffService file-backed storage', () => {
  let files: Map<string, string>;
  let dirs: Set<string>;

  beforeEach(async () => {
    const RNFS = require('react-native-fs');
    files = new Map();
    dirs = new Set(['/tmp/lineai-test']);
    RNFS.exists.mockImplementation((path: string) => Promise.resolve(files.has(path) || dirs.has(path)));
    RNFS.mkdir.mockImplementation((path: string) => {
      dirs.add(path);
      return Promise.resolve();
    });
    RNFS.writeFile.mockImplementation((path: string, content: string) => {
      files.set(path, content);
      return Promise.resolve();
    });
    RNFS.readFile.mockImplementation((path: string) => {
      if (!files.has(path)) return Promise.reject(new Error(`ENOENT ${path}`));
      return Promise.resolve(files.get(path));
    });
    RNFS.unlink.mockImplementation((path: string) => {
      files.delete(path);
      dirs.delete(path);
      return Promise.resolve();
    });
    await AsyncStorage.clear();
  });

  it('keeps large diff content out of AsyncStorage', async () => {
    const oldContent = 'old\n';
    const newContent = 'x'.repeat(1024 * 1024);
    const record = await diffService.recordDiff('/tmp/project/big.txt', oldContent, newContent, true);

    const manifest = await AsyncStorage.getItem('@linecode_diffs');
    expect(manifest).toContain('"storage":"file"');
    expect(manifest).not.toContain(newContent.slice(0, 128));
    expect(files.get(`${DIFF_FILES_DIR}/${record.id}.old.txt`)).toBe(oldContent);
    expect(files.get(`${DIFF_FILES_DIR}/${record.id}.new.txt`)).toBe(newContent);

    const restored = await diffService.getDiff(record.id);
    expect(restored?.oldContent).toBe(oldContent);
    expect(restored?.newContent).toBe(newContent);
  });
});

import { FileReadTool } from '../src/mcp/tools/builtins/FileReadTool';
import { FileWriteTool } from '../src/mcp/tools/builtins/FileWriteTool';

const RNFS = require('react-native-fs');

describe('file tools large file handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    RNFS.exists.mockResolvedValue(true);
    RNFS.stat.mockResolvedValue({ isDirectory: () => false, size: 0 });
    RNFS.readDir.mockResolvedValue([]);
    RNFS.readFile.mockResolvedValue('');
    RNFS.read.mockResolvedValue('');
    RNFS.writeFile.mockResolvedValue(undefined);
    RNFS.appendFile = jest.fn(() => Promise.resolve());
  });

  it('reads an inclusive start/end line range with 1-based line numbers', async () => {
    RNFS.readFile.mockResolvedValue('one\ntwo\nthree\nfour');
    RNFS.stat.mockResolvedValue({ isDirectory: () => false, size: 18 });

    const result = await new FileReadTool().execute(
      { file_path: 'notes.txt', start_line: 2, end_line: 3 },
      { homePath: '/workspace', toolCallId: '' },
    );

    expect(result.isError).toBeUndefined();
    expect(result.content).toContain('2\ttwo');
    expect(result.content).toContain('3\tthree');
    expect(result.content).not.toContain('1\tone');
    expect(result.content).not.toContain('4\tfour');
  });

  it('does not read oversized files without a range and reports segmented read retry text', async () => {
    RNFS.stat.mockResolvedValue({ isDirectory: () => false, size: 51 * 1024 });

    const result = await new FileReadTool().execute(
      { file_path: 'large.log' },
      { homePath: '/workspace', toolCallId: '' },
    );

    expect(result.isError).toBe(true);
    expect(result.content).toContain('单次读取大小超过 50KB');
    expect(result.content).toContain('正在尝试分段读取');
    expect(result.content).not.toContain('请让 AI');
    expect(result.content).toContain('start_line');
    expect(result.content).toContain('end_line');
    expect(RNFS.readFile).not.toHaveBeenCalled();
  });

  it('writes oversized content in chunks instead of one huge write', async () => {
    RNFS.exists.mockImplementation((path: string) => Promise.resolve(path === '/workspace'));
    RNFS.stat.mockResolvedValue({ isDirectory: () => false, size: 0 });
    const content = 'x'.repeat(64 * 1024 + 7);

    const result = await new FileWriteTool().execute(
      { file_path: 'big.txt', content },
      { homePath: '/workspace', toolCallId: '' },
    );

    expect(result.isError).toBeUndefined();
    expect(RNFS.writeFile).toHaveBeenCalledTimes(1);
    expect(RNFS.writeFile.mock.calls[0][1].length).toBeLessThanOrEqual(32 * 1024);
    expect(RNFS.appendFile).toHaveBeenCalled();
  });
});

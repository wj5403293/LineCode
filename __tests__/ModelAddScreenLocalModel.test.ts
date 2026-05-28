import { getLocalModelDisplayName, isGgufDocument } from '../src/screens/ModelAddScreen';

describe('ModelAddScreen local GGUF document detection', () => {
  it('accepts GGUF files when SAF returns the extension in the content URI instead of name', () => {
    const doc = {
      uri: 'content://com.android.providers.downloads.documents/document/msf%3ADownload%2FQwen2.5-Coder-1.5B-Instruct-Q4_K_M.gguf',
      name: 'msf:12345',
      type: 'file' as const,
      lastModified: 0,
      mime: 'application/octet-stream',
      size: 1024,
    };

    expect(isGgufDocument(doc)).toBe(true);
    expect(getLocalModelDisplayName(doc)).toBe('Qwen2.5-Coder-1.5B-Instruct-Q4_K_M.gguf');
  });

  it('accepts uppercase GGUF extensions from display name', () => {
    const doc = {
      uri: 'content://picker/model',
      name: 'DeepSeek-R1.Q4_K_M.GGUF',
      type: 'file' as const,
      lastModified: 0,
      mime: 'application/octet-stream',
      size: 1024,
    };

    expect(isGgufDocument(doc)).toBe(true);
    expect(getLocalModelDisplayName(doc)).toBe('DeepSeek-R1.Q4_K_M.GGUF');
  });
});

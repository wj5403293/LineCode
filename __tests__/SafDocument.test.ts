import {
  getSafDocumentDisplayName,
  getSafUriDisplayName,
  hasSafDocumentExtension,
} from '../src/utils/safDocument';

describe('SAF document filename helpers', () => {
  it('decodes display names from document and tree URIs', () => {
    expect(getSafUriDisplayName(
      'content://com.android.providers.downloads.documents/document/msf%3ADownload%2Fplugin.lip',
    )).toBe('plugin.lip');
    expect(getSafUriDisplayName(
      'content://com.android.externalstorage.documents/tree/primary%3ADownload%2FLineCode',
    )).toBe('LineCode');
  });

  it('prefers URI names when provider display names do not contain the required extension', () => {
    const document = {
      uri: 'content://com.android.providers.downloads.documents/document/msf%3ADownload%2Fskills.zip',
      name: 'msf:67890',
    };

    expect(hasSafDocumentExtension(document, ['.zip'])).toBe(true);
    expect(getSafDocumentDisplayName(document, { preferredExtensions: ['.zip'] })).toBe('skills.zip');
  });

  it('normalizes raw SAF document ids returned as names', () => {
    expect(getSafDocumentDisplayName({
      uri: 'content://com.android.externalstorage.documents/document/primary%3ADownload%2FModels%2FQwen.gguf',
      name: 'primary:Download/Models/Qwen.gguf',
    }, { preferredExtensions: ['.gguf'] })).toBe('Qwen.gguf');
  });
});

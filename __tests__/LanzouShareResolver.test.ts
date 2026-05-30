import {
  computeAcwScV2,
  parseLanzouFolderParams,
  resolveLanzouHotUpdateFiles,
  resolveLanzouDownloadUrl,
} from '../src/services/LanzouShareResolver';
import RNFS from 'react-native-fs';

function response(body: string, options: { contentType?: string; status?: number; url?: string } = {}): Response {
  const status = options.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    url: options.url,
    headers: { get: jest.fn((key: string) => key.toLowerCase() === 'content-type' ? options.contentType || 'text/html' : null) },
    text: jest.fn(() => Promise.resolve(body)),
  } as any;
}

describe('LanzouShareResolver', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('computes acw_sc__v2 challenge cookie', () => {
    expect(computeAcwScV2('F2668956E873B55EE42D7258DA85029455A0F5CC')).toBe(
      '6a0849958eaca823dd82c58567494b56cfe55c45',
    );
  });

  it('parses password protected folder params from share page', () => {
    const html = `
      <script>
        var ib8uf3 = '1778928581';
        var _h76gw = '8a2c4392833294dd580c78148d7e776a';
        $.ajax({
          url : '/filemoreajax.php?file=13497726',
          data : {
            'lx':2,
            'fid':13497726,
            'uid':'4057781',
            'pg':pgs,
            'rep':'0',
            't':ib8uf3,
            'k':_h76gw,
            'up':1,
            'ls':1,
            'pwd':pwd
          }
        });
      </script>
    `;

    expect(parseLanzouFolderParams(html, 'https://wwbpm.lanzoue.com/b00tci5mxg')).toEqual({
      origin: 'https://wwbpm.lanzoue.com',
      folderId: '13497726',
      uid: '4057781',
      tokenTime: '1778928581',
      tokenKey: '8a2c4392833294dd580c78148d7e776a',
    });
  });

  it('does not treat file stat id as folder id when folder ajax data is present', () => {
    const html = `
      <a href="/q/jb/?f=286586690&report=2">文件投诉</a>
      <script>
        var ib8uf3 = '1778928581';
        var _h76gw = '8a2c4392833294dd580c78148d7e776a';
        $.ajax({
          url : '/filemoreajax.php?file=13497726',
          data : {
            'uid':'4057781',
            't':ib8uf3,
            'k':_h76gw
          }
        });
      </script>
    `;

    expect(parseLanzouFolderParams(html, 'https://wwbpm.lanzoue.com/b00tci5mxg').folderId).toBe('13497726');
  });

  it('resolves txt hot update metadata from a Lanzou folder', async () => {
    const folderUrl = 'https://wwbpm.lanzoue.com/b00tci5mxg';
    const fetcher = jest.fn(async (url: string) => {
      if (url === folderUrl) {
        return response(`
          <script>
            var ib8uf3 = '1778928581';
            var _h76gw = '8a2c4392833294dd580c78148d7e776a';
            $.ajax({
              url : '/filemoreajax.php?file=13497726',
              data : {
                'uid':'4057781',
                't':ib8uf3,
                'k':_h76gw
              }
            });
          </script>
        `);
      }
      if (url === 'https://wwbpm.lanzoue.com/filemoreajax.php?file=13497726') {
        return response(JSON.stringify({
          zt: 1,
          text: [
            { id: 'zip', name_all: 'base.zip', size: '2 M', t: 0 },
            { id: 'index', name_all: 'base.txt', size: '1 K', t: 0 },
            { id: 'detail', name_all: 'base-1600014.txt', size: '1 K', t: 0 },
          ],
        }), { contentType: 'application/json' });
      }
      throw new Error(`unexpected url: ${url}`);
    });

    await expect(resolveLanzouHotUpdateFiles(folderUrl, 'dfaj', fetcher as any)).resolves.toEqual(expect.objectContaining({
      index: expect.objectContaining({ name: 'base.txt' }),
      history: [expect.objectContaining({ name: 'base-1600014.txt' })],
      zip: expect.objectContaining({ name: 'base.zip' }),
      apkPackages: {},
      all: expect.arrayContaining([
        expect.objectContaining({ name: 'base.zip' }),
        expect.objectContaining({ name: 'base.txt' }),
        expect.objectContaining({ name: 'base-1600014.txt' }),
      ]),
    }));
  });

  it('uses desktop pages for file download resolution', async () => {
    const fileUrl = 'https://wwbpm.lanzoue.com/ili9h3plioda';
    const fetcher = jest.fn(async (url: string) => {
      if (url === fileUrl && fetcher.mock.calls.length === 1) {
        return response("<script>var arg1='F2668956E873B55EE42D7258DA85029455A0F5CC';</script>");
      }
      if (url === fileUrl) {
        return response('<iframe class="ifr2" src="/fn?desktop"></iframe>');
      }
      if (url === 'https://wwbpm.lanzoue.com/fn?desktop') {
        return response(`
          <script>
            var ajaxdata = 'ajax-key';
            var wp_sign = 'sign-value';
            var kdns = 1;
            $.ajax({ url : '/ajaxm.php?file=286586690' });
          </script>
        `);
      }
      if (url === 'https://wwbpm.lanzoue.com/ajaxm.php?file=286586690') {
        return response(JSON.stringify({
          zt: 1,
          dom: 'https://developer2.lanrar.com',
          url: 'download/base.txt',
        }), { contentType: 'application/json' });
      }
      if (url === 'https://developer2.lanrar.com/file/download/base.txt') {
        return response('', {
          contentType: 'application/octet-stream',
          url: 'https://developer2.lanrar.com/file/download/base.txt',
        });
      }
      throw new Error(`unexpected url: ${url}`);
    });

    await expect(resolveLanzouDownloadUrl(fileUrl, fetcher as any)).resolves.toBe(
      'https://developer2.lanrar.com/file/download/base.txt',
    );

    expect(fetcher).toHaveBeenCalledWith(
      fileUrl,
      expect.objectContaining({
        headers: expect.objectContaining({
          'User-Agent': expect.stringContaining('Windows NT 10.0'),
        }),
      }),
    );
    expect(fetcher).toHaveBeenCalledWith(
      'https://wwbpm.lanzoue.com/fn?desktop',
      expect.objectContaining({
        headers: expect.objectContaining({
          Referer: fileUrl,
          'User-Agent': expect.stringContaining('Windows NT 10.0'),
        }),
      }),
    );
    expect(fetcher).not.toHaveBeenCalledWith(expect.stringContaining('/tp/'), expect.anything());
  });

  it('uses RNFS for acw cookie html requests because React Native fetch drops Cookie', async () => {
    const fileUrl = 'https://wwbpm.lanzoue.com/ili9h3plioda';
    const expectedCookie = `acw_sc__v2=${computeAcwScV2('F2668956E873B55EE42D7258DA85029455A0F5CC')}`;
    (RNFS.readFile as jest.Mock)
      .mockResolvedValueOnce('<iframe class="ifr2" src="/fn?desktop"></iframe>')
      .mockResolvedValueOnce(`
        <script>
          var ajaxdata = 'ajax-key';
          var wp_sign = 'sign-value';
          $.ajax({ url : '/ajaxm.php?file=286586690' });
        </script>
      `);
    (globalThis.fetch as jest.Mock | undefined)?.mockRestore?.();
    globalThis.fetch = jest.fn(async (url: string) => {
      if (url === fileUrl) {
        return response("<script>var arg1='F2668956E873B55EE42D7258DA85029455A0F5CC';</script>");
      }
      if (url === 'https://wwbpm.lanzoue.com/ajaxm.php?file=286586690') {
        return response(JSON.stringify({
          zt: 1,
          dom: 'https://developer2.lanrar.com',
          url: 'download/base.txt',
        }), { contentType: 'application/json' });
      }
      if (url === 'https://developer2.lanrar.com/file/download/base.txt') {
        return response('', {
          contentType: 'application/octet-stream',
          url: 'https://developer2.lanrar.com/file/download/base.txt',
        });
      }
      throw new Error(`unexpected url: ${url}`);
    }) as any;

    await expect(resolveLanzouDownloadUrl(fileUrl)).resolves.toBe(
      'https://developer2.lanrar.com/file/download/base.txt',
    );

    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
    expect(RNFS.downloadFile).toHaveBeenCalledWith(expect.objectContaining({
      fromUrl: fileUrl,
      headers: expect.objectContaining({
        Cookie: expectedCookie,
        'User-Agent': expect.stringContaining('Windows NT 10.0'),
      }),
    }));
    expect(RNFS.downloadFile).toHaveBeenCalledWith(expect.objectContaining({
      fromUrl: 'https://wwbpm.lanzoue.com/fn?desktop',
      headers: expect.objectContaining({
        Cookie: expectedCookie,
        Referer: fileUrl,
      }),
    }));
  });

});

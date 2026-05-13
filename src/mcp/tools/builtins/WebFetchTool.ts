import { BaseTool, ToolContext } from '../BaseTool';
import { ToolResult } from '../../../types';
import { webSearchService } from '../../../services/WebSearchService';

export class WebFetchTool extends BaseTool {
  readonly name = 'web_fetch';
  readonly description = '查看并提取指定网页的文本内容。适合打开 web_search 返回的 URL，读取页面正文后再回答。';
  readonly category = 'read' as const;
  readonly requiresConfirmation = false;
  readonly parameters = {
    type: 'object',
    properties: {
      url: { type: 'string', description: '要查看的网页 URL，必须以 http:// 或 https:// 开头' },
      maxChars: { type: 'number', description: '最多返回字符数，默认 12000，最大 30000' },
    },
    required: ['url'],
  };

  async execute(input: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    const url = String(input.url || '').trim();
    if (!url) {
      return { toolCallId: '', content: 'URL 不能为空。', isError: true };
    }

    try {
      const content = await webSearchService.fetchPage(url, Number(input.maxChars || 12000));
      return {
        toolCallId: '',
        content: `URL: ${url}\n\n${content}`,
      };
    } catch (err: any) {
      return {
        toolCallId: '',
        content: `网页查看失败: ${err?.message || String(err)}`,
        isError: true,
      };
    }
  }
}

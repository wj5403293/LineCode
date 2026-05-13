import { BaseTool, ToolContext } from '../BaseTool';
import { ToolResult } from '../../../types';
import { webSearchService } from '../../../services/WebSearchService';

export class WebSearchTool extends BaseTool {
  readonly name = 'web_search';
  readonly description = '搜索互联网信息。需要用户先在 MCP 工具设置中配置搜索 API、模型/搜索源和密钥。适合查询最新事实、文档、新闻和网页资料。';
  readonly category = 'read' as const;
  readonly requiresConfirmation = false;
  readonly parameters = {
    type: 'object',
    properties: {
      query: { type: 'string', description: '搜索关键词或问题' },
      limit: { type: 'number', description: '返回结果数量，1-10，默认 5' },
    },
    required: ['query'],
  };

  async execute(input: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    const query = String(input.query || '').trim();
    if (!query) {
      return { toolCallId: '', content: '搜索关键词不能为空。', isError: true };
    }

    try {
      const results = await webSearchService.search(query, Number(input.limit || 5));
      if (results.length === 0) {
        return { toolCallId: '', content: `未搜索到与 "${query}" 相关的网页结果。` };
      }

      const content = results.map((item, index) => {
        const lines = [
          `${index + 1}. ${item.title}`,
          `URL: ${item.url}`,
        ];
        if (item.publishedDate) lines.push(`Date: ${item.publishedDate}`);
        if (item.snippet) lines.push(`Snippet: ${item.snippet}`);
        return lines.join('\n');
      }).join('\n\n');

      return { toolCallId: '', content };
    } catch (err: any) {
      return {
        toolCallId: '',
        content: `网页搜索失败: ${err?.message || String(err)}`,
        isError: true,
      };
    }
  }
}

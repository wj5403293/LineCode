import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebSearchConfig, WebSearchProvider } from '../types';

const STORAGE_KEY = '@lineai_web_search_config';
const DEFAULT_PROVIDER: WebSearchProvider = 'tavily';

const PROVIDER_DEFAULTS: Record<WebSearchProvider, Omit<WebSearchConfig, 'apiKey' | 'model'>> = {
  tavily: {
    provider: 'tavily',
    baseUrl: 'https://api.tavily.com/search',
    queryParam: 'query',
    apiKeyHeader: 'Authorization',
  },
  brave: {
    provider: 'brave',
    baseUrl: 'https://api.search.brave.com/res/v1/web/search',
    queryParam: 'q',
    apiKeyHeader: 'X-Subscription-Token',
  },
  serpapi: {
    provider: 'serpapi',
    baseUrl: 'https://serpapi.com/search.json',
    queryParam: 'q',
    apiKeyParam: 'api_key',
  },
  bing: {
    provider: 'bing',
    baseUrl: 'https://api.bing.microsoft.com/v7.0/search',
    queryParam: 'q',
    apiKeyHeader: 'Ocp-Apim-Subscription-Key',
  },
  custom: {
    provider: 'custom',
    baseUrl: '',
    queryParam: 'q',
    apiKeyHeader: 'Authorization',
  },
};

export const WEB_SEARCH_PROVIDER_LABELS: Record<WebSearchProvider, string> = {
  tavily: 'Tavily',
  brave: 'Brave Search',
  serpapi: 'SerpAPI',
  bing: 'Bing Search',
  custom: '自定义',
};

export function getDefaultWebSearchConfig(provider: WebSearchProvider = DEFAULT_PROVIDER): WebSearchConfig {
  return {
    ...PROVIDER_DEFAULTS[provider],
    apiKey: '',
    model: '',
  };
}

export function getWebSearchProviderDefaults(provider: WebSearchProvider): WebSearchConfig {
  return getDefaultWebSearchConfig(provider);
}

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
}

class WebSearchService {
  private config: WebSearchConfig | null = null;

  async getConfig(): Promise<WebSearchConfig> {
    if (this.config) return this.config;
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    if (!json) {
      this.config = getDefaultWebSearchConfig();
      return this.config;
    }

    try {
      const parsed = JSON.parse(json) as Partial<WebSearchConfig>;
      const provider = this.normalizeProvider(parsed.provider);
      this.config = {
        ...getDefaultWebSearchConfig(provider),
        ...parsed,
        provider,
      };
    } catch {
      this.config = getDefaultWebSearchConfig();
    }
    return this.config;
  }

  async saveConfig(config: WebSearchConfig): Promise<void> {
    const provider = this.normalizeProvider(config.provider);
    this.config = {
      ...getDefaultWebSearchConfig(provider),
      ...config,
      provider,
      baseUrl: config.baseUrl.trim(),
      apiKey: config.apiKey.trim(),
      model: config.model?.trim() || '',
      queryParam: config.queryParam?.trim() || 'q',
      apiKeyHeader: config.apiKeyHeader?.trim() || undefined,
      apiKeyParam: config.apiKeyParam?.trim() || undefined,
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
  }

  async search(query: string, limit = 5): Promise<SearchResultItem[]> {
    const config = await this.getConfig();
    if (!config.baseUrl.trim() || !config.apiKey.trim()) {
      throw new Error('网页搜索未配置。请在 MCP 工具设置中填写搜索 API、模型/搜索源和密钥。');
    }

    const provider = this.normalizeProvider(config.provider);
    const maxResults = Math.max(1, Math.min(Math.floor(limit || 5), 10));
    const request = this.buildSearchRequest(provider, config, query, maxResults);
    const res = await fetch(request.url, request.init);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`搜索 API ${res.status}: ${this.extractErrorText(text)}`);
    }

    const json = await res.json();
    return this.normalizeResults(json, provider).slice(0, maxResults);
  }

  async fetchPage(url: string, maxChars = 12000): Promise<string> {
    const trimmedUrl = url.trim();
    if (!/^https?:\/\//i.test(trimmedUrl)) {
      throw new Error('URL 必须以 http:// 或 https:// 开头。');
    }

    const limit = Math.max(1000, Math.min(Math.floor(maxChars || 12000), 30000));
    const res = await fetch(trimmedUrl, {
      headers: {
        Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.6',
        'User-Agent': 'LineCode/1.0',
      },
    });

    if (!res.ok) {
      throw new Error(`网页请求失败 ${res.status}: ${res.statusText}`);
    }

    const text = await res.text();
    const contentType = res.headers.get('content-type') || '';
    const normalized = contentType.includes('html') ? this.htmlToText(text) : text;
    const compact = normalized.replace(/\n{3,}/g, '\n\n').trim();
    if (!compact) return '网页内容为空或无法提取正文。';
    return compact.length > limit
      ? `${compact.slice(0, limit)}\n\n[内容已截断，原始长度约 ${compact.length} 字符]`
      : compact;
  }

  private buildSearchRequest(
    provider: WebSearchProvider,
    config: WebSearchConfig,
    query: string,
    limit: number,
  ): { url: string; init: RequestInit } {
    if (provider === 'tavily') {
      return {
        url: config.baseUrl,
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            query,
            max_results: limit,
            search_depth: config.model || 'basic',
            include_answer: false,
          }),
        },
      };
    }

    const params: Record<string, string> = {
      [config.queryParam || 'q']: query,
    };
    if (provider === 'serpapi') {
      params.engine = config.model || 'google';
      params[config.apiKeyParam || 'api_key'] = config.apiKey;
      params.num = String(limit);
    } else if (provider === 'bing') {
      params.count = String(limit);
    } else if (provider === 'brave') {
      params.count = String(limit);
    } else {
      if (config.model) params.model = config.model;
      if (config.apiKeyParam) params[config.apiKeyParam] = config.apiKey;
      params.limit = String(limit);
    }

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (config.apiKeyHeader) {
      headers[config.apiKeyHeader] = config.apiKeyHeader.toLowerCase() === 'authorization'
        ? `Bearer ${config.apiKey}`
        : config.apiKey;
    }

    return {
      url: this.appendQuery(config.baseUrl, params),
      init: { headers },
    };
  }

  private appendQuery(baseUrl: string, params: Record<string, string>): string {
    const query = Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== '')
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
    if (!query) return baseUrl;
    return `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${query}`;
  }

  private normalizeResults(json: any, provider: WebSearchProvider): SearchResultItem[] {
    if (provider === 'tavily') {
      return this.arrayToResults(json.results, {
        title: 'title',
        url: 'url',
        snippet: 'content',
        publishedDate: 'published_date',
      });
    }

    if (provider === 'brave') {
      return this.arrayToResults(json.web?.results, {
        title: 'title',
        url: 'url',
        snippet: 'description',
        publishedDate: 'age',
      });
    }

    if (provider === 'serpapi') {
      return this.arrayToResults(json.organic_results, {
        title: 'title',
        url: 'link',
        snippet: 'snippet',
        publishedDate: 'date',
      });
    }

    if (provider === 'bing') {
      return this.arrayToResults(json.webPages?.value, {
        title: 'name',
        url: 'url',
        snippet: 'snippet',
        publishedDate: 'dateLastCrawled',
      });
    }

    const candidates = json.results || json.items || json.data || json.web?.results || json.organic_results;
    return this.arrayToResults(candidates, {
      title: 'title',
      url: 'url',
      snippet: 'snippet',
      publishedDate: 'publishedDate',
    });
  }

  private arrayToResults(
    value: unknown,
    keys: { title: string; url: string; snippet: string; publishedDate: string },
  ): SearchResultItem[] {
    if (!Array.isArray(value)) return [];
    return value
      .map(item => {
        const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};
        const url = String(record[keys.url] || record.link || record.href || '');
        return {
          title: String(record[keys.title] || record.name || url || 'Untitled'),
          url,
          snippet: String(record[keys.snippet] || record.description || record.content || ''),
          publishedDate: record[keys.publishedDate] ? String(record[keys.publishedDate]) : undefined,
        };
      })
      .filter(item => !!item.url);
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<\/(p|div|section|article|header|footer|li|h[1-6]|tr)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n[ \t]+/g, '\n');
  }

  private extractErrorText(text: string): string {
    try {
      const json = JSON.parse(text);
      return json?.error?.message || json?.message || text;
    } catch {
      return text || '请求失败';
    }
  }

  private normalizeProvider(provider?: string): WebSearchProvider {
    if (provider && provider in PROVIDER_DEFAULTS) {
      return provider as WebSearchProvider;
    }
    return DEFAULT_PROVIDER;
  }
}

export const webSearchService = new WebSearchService();

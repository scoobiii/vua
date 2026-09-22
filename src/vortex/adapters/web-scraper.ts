import type { IVUAAdapter, VUAAdapterMetadata } from './types.js';

export interface WebScrapeRecord {
  url: string;
  fetched_at: string;
  http_status: number;
  content_type: string;
  title: string | null;
  description: string | null;
  language: string | null;
  canonical_url: string | null;
  author: string | null;
  published_at: string | null;
  headings: string[];
  text: string;
  links: Array<{ text: string; url: string }>;
  contacts: { emails: string[]; phones: string[] };
  structured_data: unknown[];
  provenance: {
    source: 'WEB';
    method: 'VUA_WEB_SCRAPER';
    confidence: 'OBSERVED';
  };
}

function clean(value: string): string {
  return value.replace(/\\s+/g, ' ').trim();
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\\s\\S]*?<\\/script>/gi, ' ')
      .replace(/<style[\\s\\S]*?<\\/style>/gi, ' ')
      .replace(/<noscript[\\s\\S]*?<\\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  );
}

function firstMatch(html: string, re: RegExp): string | null {
  const match = re.exec(html);
  return match?.[1] ? decodeEntities(clean(match[1])) : null;
}

function allMatches(html: string, re: RegExp): string[] {
  const out: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    if (match[1]) out.push(decodeEntities(clean(match[1])));
  }
  return [...new Set(out)];
}

function resolveUrl(raw: string, base: URL): string | null {
  try {
    return new URL(raw, base).toString();
  } catch {
    return null;
  }
}

function assertSafeUrl(raw: string): URL {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('SCRAPER_UNSUPPORTED_PROTOCOL');
  }
  const hostname = url.hostname.toLowerCase();
  const blocked = [
    'localhost', '127.0.0.1', '0.0.0.0', '::1',
    '169.254.169.254', 'metadata.google.internal',
  ];
  if (blocked.includes(hostname) || hostname.endsWith('.localhost')) {
    throw new Error('SCRAPER_PRIVATE_TARGET_BLOCKED');
  }
  return url;
}

export class VUAWebScraperAdapter implements IVUAAdapter {
  public metadata: VUAAdapterMetadata = {
    id: 'web-scraper',
    name: 'VUA Web Scraper',
    environment: 'POSIX Linux',
    version: '1.0.0',
    status: 'ready',
    description: 'Fetches a public web page and returns normalized, provenance-tagged JSON without synthetic data.',
    capabilities: ['web.fetch', 'web.extract', 'web.provenance'],
    supportedActions: [
      { action: 'scrape_url', description: 'Fetch and normalize one public HTTP(S) page', risk: 'read', requiresApproval: false },
    ],
    actions: {
      scrape_url: { action: 'scrape_url', description: 'Fetch and normalize one public HTTP(S) page', risk: 'read', requiresApproval: false },
    },
  };

  public async executeAction(action: string, target: Record<string, unknown> = {}, payload: Record<string, unknown> = {}) {
    if (action !== 'scrape_url') throw new Error(`ACTION_NOT_SUPPORTED:${action}`);
    const rawUrl = String(payload.url ?? target.url ?? '');
    if (!rawUrl) throw new Error('SCRAPER_URL_REQUIRED');

    const url = assertSafeUrl(rawUrl);
    const timeoutMs = Math.min(Math.max(Number(payload.timeout_ms ?? 15000), 1000), 30000);
    const maxBytes = Math.min(Math.max(Number(payload.max_bytes ?? 2_000_000), 10_000), 5_000_000);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetch(url, {
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'user-agent': 'VUA-Web-Scraper/1.0 (+https://github.com/scoobiii/vua)',
          accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.7',
        },
      });
    } catch (error) {
      throw new Error(`SCRAPER_FETCH_FAILED:${error instanceof Error ? error.message : String(error)}`);
    } finally {
      clearTimeout(timer);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!response.ok) throw new Error(`SCRAPER_HTTP_${response.status}`);

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > maxBytes) throw new Error('SCRAPER_RESPONSE_TOO_LARGE');

    const body = buffer.toString('utf8');
    const fetchedAt = new Date().toISOString();

    if (contentType.includes('application/json')) {
      let parsed: unknown;
      try { parsed = JSON.parse(body); } catch { parsed = body; }
      const data: WebScrapeRecord = {
        url: response.url || url.toString(),
        fetched_at: fetchedAt,
        http_status: response.status,
        content_type: contentType,
        title: null, description: null, language: null, canonical_url: response.url || url.toString(),
        author: null, published_at: null, headings: [], text: typeof parsed === 'string' ? parsed : JSON.stringify(parsed),
        links: [], contacts: { emails: [], phones: [] }, structured_data: [parsed],
        provenance: { source: 'WEB', method: 'VUA_WEB_SCRAPER', confidence: 'OBSERVED' },
      };
      return { data: { record: data, success: true, authenticated: false, external_effect: 'local_only' }, auditLog: ['web.fetch:completed', 'web.normalize:json'] };
    }

    const html = body;
    const title = firstMatch(html, /<title[^>]*>([\\s\\S]*?)<\\/title>/i);
    const description = firstMatch(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i)
      ?? firstMatch(html, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i);
    const language = firstMatch(html, /<html[^>]+lang=["']([^"']+)["']/i);
    const canonical = firstMatch(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i);
    const author = firstMatch(html, /<meta[^>]+name=["']author["'][^>]+content=["']([^"']*)["'][^>]*>/i);
    const publishedAt = firstMatch(html, /<meta[^>]+(?:property|name)=["'](?:article:published_time|date|pubdate)["'][^>]+content=["']([^"']*)["'][^>]*>/i);
    const headings = allMatches(html, /<h[1-6][^>]*>([\\s\\S]*?)<\\/h[1-6]>/gi).map(clean).filter(Boolean).slice(0, 100);

    const links: Array<{ text: string; url: string }> = [];
    const linkRe = /<a[^>]+href=["']([^"']+)["'][^>]*>([\\s\\S]*?)<\\/a>/gi;
    let linkMatch: RegExpExecArray | null;
    while ((linkMatch = linkRe.exec(html)) !== null && links.length < 200) {
      const href = resolveUrl(linkMatch[1], url);
      const text = clean(stripTags(linkMatch[2]));
      if (href && text) links.push({ text, url: href });
    }

    const plainText = clean(stripTags(html));
    const emails = [...new Set((plainText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/gi) ?? []))];
    const phones = [...new Set((plainText.match(/(?:\\+?55[\\s.-]?)?(?:\\(?\\d{2}\\)?[\\s.-]?)?\\d{4,5}[\\s.-]?\\d{4}/g) ?? []))];

    const structuredData: unknown[] = [];
    for (const raw of allMatches(html, /<script[^>]+type=["']application\\/ld\\+json["'][^>]*>([\\s\\S]*?)<\\/script>/gi).slice(0, 20)) {
      try { structuredData.push(JSON.parse(raw)); } catch { /* preserve only valid JSON-LD */ }
    }

    const record: WebScrapeRecord = {
      url: response.url || url.toString(),
      fetched_at: fetchedAt,
      http_status: response.status,
      content_type: contentType,
      title, description, language,
      canonical_url: canonical ? resolveUrl(canonical, url) : (response.url || url.toString()),
      author, published_at: publishedAt,
      headings,
      text: plainText.slice(0, 100_000),
      links,
      contacts: { emails, phones },
      structured_data: structuredData,
      provenance: { source: 'WEB', method: 'VUA_WEB_SCRAPER', confidence: 'OBSERVED' },
    };

    return {
      data: { record, success: true, authenticated: false, external_effect: 'local_only' },
      auditLog: ['web.fetch:completed', 'web.normalize:html', `web.links:${links.length}`, `web.structured_data:${structuredData.length}`],
    };
  }

  public async probeStatus() {
    return { status: 'ready' as const, metrics: { runtime: 'node-fetch', dynamic_pages: 'not_supported', max_response_bytes: 5_000_000 } };
  }
}

/**
 * RSS Feed Aggregator — ported from V3 web.py check_world_news
 *
 * Fetches headlines from configured RSS feeds using native fetch + XML parsing.
 * No external dependencies required.
 */

export interface RssItem {
  title: string;
  link: string;
  description?: string;
  pubDate?: string;
}

export interface RssFeed {
  name: string;
  url: string;
  category: string;
}

const DEFAULT_FEEDS: RssFeed[] = [
  { name: "BBC News", url: "http://feeds.bbci.co.uk/news/rss.xml", category: "general" },
  { name: "TechCrunch", url: "https://techcrunch.com/feed/", category: "tech" },
  {
    name: "NYT Science",
    url: "https://rss.nytimes.com/services/xml/rss/nyt/Science.xml",
    category: "science",
  },
  {
    name: "Bloomberg Markets",
    url: "https://feeds.bloomberg.com/markets/news.rss",
    category: "business",
  },
];

/**
 * Simple XML tag extractor (no dependency on xml2js).
 * Extracts content between matching tags.
 */
function extractTag(xml: string, tag: string): string | undefined {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const match = xml.match(regex);
  if (!match) return undefined;
  // Strip CDATA wrappers
  return match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
}

/**
 * Extracts all <item> blocks from RSS XML and parses them into RssItem objects.
 */
function parseRssItems(xml: string, maxItems = 5): RssItem[] {
  const items: RssItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null && items.length < maxItems) {
    const block = match[1];
    const title = extractTag(block, "title");
    const link = extractTag(block, "link");
    if (title && link) {
      items.push({
        title,
        link,
        description: extractTag(block, "description"),
        pubDate: extractTag(block, "pubDate"),
      });
    }
  }

  return items;
}

/**
 * Fetches and parses a single RSS feed.
 */
async function fetchFeed(
  feed: RssFeed,
  maxItems = 5,
): Promise<{ feed: RssFeed; items: RssItem[] }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(feed.url, {
      signal: controller.signal,
      headers: { "User-Agent": "ErnOS/4.0 RSS Reader" },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`[RSS] ${feed.name}: HTTP ${response.status}`);
      return { feed, items: [] };
    }

    const xml = await response.text();
    const items = parseRssItems(xml, maxItems);
    return { feed, items };
  } catch (error) {
    console.warn(`[RSS] ${feed.name} fetch failed: ${error}`);
    return { feed, items: [] };
  }
}

export class RSSFeedAggregator {
  private feeds: RssFeed[];

  constructor(feeds?: RssFeed[]) {
    this.feeds = feeds ?? DEFAULT_FEEDS;
  }

  /**
   * Fetches headlines from all configured feeds, or filtered by category.
   */
  async getLatestNews(category?: string, maxItemsPerFeed = 5): Promise<string> {
    const targetFeeds = category
      ? this.feeds.filter((f) => f.category === category.toLowerCase())
      : this.feeds;

    if (targetFeeds.length === 0) {
      const categories = [...new Set(this.feeds.map((f) => f.category))].join(", ");
      return `No feeds for category "${category}". Available: ${categories}`;
    }

    const results = await Promise.allSettled(targetFeeds.map((f) => fetchFeed(f, maxItemsPerFeed)));

    const lines: string[] = [];

    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      const { feed, items } = result.value;

      if (items.length === 0) {
        lines.push(`**${feed.name}**: No headlines available.`);
        continue;
      }

      lines.push(`**${feed.name}**:`);
      for (const item of items) {
        lines.push(`- [${item.title}](${item.link})`);
      }
      lines.push("");
    }

    return lines.length > 0 ? lines.join("\n") : "No news available at this time.";
  }
}

export const rssFeeds = new RSSFeedAggregator();

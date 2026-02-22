/**
 * Feed scanner — fetches RSS/Atom feeds, extracts items, scores relevance.
 * Runs server-side only. Respects ETag/Last-Modified for caching.
 */

import { createHash } from "crypto";

export type RawFeedItem = {
  title: string;
  summary: string;
  url: string;
  publishedAt: string | null;
};

export type ScoredFeedItem = RawFeedItem & {
  category: "BOOKING_POLICY" | "COMPETITOR_NEWS" | "SALES_OPPORTUNITY" | "SECURITY_ALERT" | "GENERAL";
  relevanceScore: number;
  keywords: string[];
  urlHash: string;
};

const KEYWORDS: Record<string, string[]> = {
  BOOKING_POLICY: [
    "booking policy", "cancellation", "refund", "insurance", "fuel policy",
    "surcharge", "terms and conditions", "rental agreement", "deposit",
    "excess", "cross-border", "one-way", "age limit", "driver requirement",
  ],
  SALES_OPPORTUNITY: [
    "promotion", "discount", "deal", "offer", "sale", "commission",
    "loyalty", "partnership", "bundle", "upgrade", "promo code",
  ],
  SECURITY_ALERT: [
    "scam", "fraud", "security", "breach", "incident", "warning",
    "phishing", "malware", "vulnerability",
  ],
  COMPETITOR_NEWS: [
    "europcar", "goldcar", "hertz", "avis", "sixt", "enterprise",
    "budget", "fleet", "rental car", "car hire", "vehicle rental",
  ],
};

export function hashUrl(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 32);
}

export function categorizeAndScore(title: string, summary: string): {
  category: ScoredFeedItem["category"];
  score: number;
  keywords: string[];
} {
  const text = `${title} ${summary}`.toLowerCase();
  const matched: string[] = [];
  const scores: Record<string, number> = {};

  for (const [cat, words] of Object.entries(KEYWORDS)) {
    let catScore = 0;
    for (const word of words) {
      if (text.includes(word)) {
        catScore += 1;
        matched.push(word);
      }
    }
    scores[cat] = catScore;
  }

  // Find highest scoring category
  let bestCat: ScoredFeedItem["category"] = "GENERAL";
  let bestScore = 0;
  for (const [cat, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestCat = cat as ScoredFeedItem["category"];
    }
  }

  // Normalize score 0-1
  const normalized = Math.min(bestScore / 5, 1);

  return { category: bestCat, score: normalized, keywords: matched };
}

/** Parse a basic RSS/Atom XML feed */
export function parseRssFeed(xml: string): RawFeedItem[] {
  const items: RawFeedItem[] = [];

  // RSS 2.0 items
  const rssItemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = rssItemRegex.exec(xml)) !== null) {
    const block = match[1]!;
    const title = extractTag(block, "title");
    const link = extractTag(block, "link") || extractTag(block, "guid");
    const desc = extractTag(block, "description") || extractTag(block, "content:encoded") || "";
    const pubDate = extractTag(block, "pubDate") || extractTag(block, "dc:date");

    if (title && link) {
      items.push({
        title: stripHtml(title),
        summary: stripHtml(desc).slice(0, 500),
        url: link,
        publishedAt: pubDate,
      });
    }
  }

  // Atom entries
  if (items.length === 0) {
    const atomRegex = /<entry>([\s\S]*?)<\/entry>/gi;
    while ((match = atomRegex.exec(xml)) !== null) {
      const block = match[1]!;
      const title = extractTag(block, "title");
      const linkMatch = block.match(/<link[^>]*href=["']([^"']+)["']/);
      const link = linkMatch?.[1] ?? "";
      const summary = extractTag(block, "summary") || extractTag(block, "content") || "";
      const pubDate = extractTag(block, "published") || extractTag(block, "updated");

      if (title && link) {
        items.push({
          title: stripHtml(title),
          summary: stripHtml(summary).slice(0, 500),
          url: link,
          publishedAt: pubDate,
        });
      }
    }
  }

  return items;
}

function extractTag(xml: string, tag: string): string {
  const cdataMatch = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i"));
  if (cdataMatch) return cdataMatch[1]!;

  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match?.[1]?.trim() ?? "";
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

/** Fetch a feed URL with ETag support */
export async function fetchFeedRaw(
  url: string,
  lastEtag?: string | null,
): Promise<{ xml: string; etag: string | null; notModified: boolean }> {
  const headers: Record<string, string> = {
    "User-Agent": "InternalToolKit-FeedReader/1.0",
    Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
  };

  if (lastEtag) {
    headers["If-None-Match"] = lastEtag;
  }

  const res = await fetch(url, { headers, next: { revalidate: 600 } });

  if (res.status === 304) {
    return { xml: "", etag: lastEtag ?? null, notModified: true };
  }

  if (!res.ok) {
    throw new Error(`Feed fetch failed: ${res.status}`);
  }

  const xml = await res.text();
  const etag = res.headers.get("etag");

  return { xml, etag, notModified: false };
}

/** Full pipeline: fetch → parse → categorize → dedupe hash */
export function processFeedItems(rawItems: RawFeedItem[]): ScoredFeedItem[] {
  return rawItems.map((item) => {
    const { category, score, keywords } = categorizeAndScore(item.title, item.summary);
    return {
      ...item,
      category,
      relevanceScore: score,
      keywords,
      urlHash: hashUrl(item.url),
    };
  });
}

/** Default feed sources for car rental operations */
export const DEFAULT_FEED_SOURCES = [
  {
    name: "Europcar Newsroom",
    url: "https://newsroom.europcar-group.com/feed/",
    type: "rss" as const,
  },
  {
    name: "Rental Cars News (Google)",
    url: "https://news.google.com/rss/search?q=car+rental+europe&hl=en",
    type: "rss" as const,
  },
  {
    name: "Tourism Industry News",
    url: "https://news.google.com/rss/search?q=greece+tourism+car+rental&hl=en",
    type: "rss" as const,
  },
];

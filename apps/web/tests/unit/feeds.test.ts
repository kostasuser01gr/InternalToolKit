/**
 * Tests for the feeds scanner module
 */
import { describe, it, expect } from "vitest";
import {
  hashUrl,
  categorizeAndScore,
  parseRssFeed,
  processFeedItems,
  DEFAULT_FEED_SOURCES,
} from "@/lib/feeds/scanner";

describe("hashUrl", () => {
  it("returns a 32-char hex string", () => {
    const h = hashUrl("https://example.com/article");
    expect(h).toHaveLength(32);
    expect(h).toMatch(/^[a-f0-9]{32}$/);
  });

  it("is deterministic", () => {
    const a = hashUrl("https://foo.com");
    const b = hashUrl("https://foo.com");
    expect(a).toBe(b);
  });

  it("differs for different URLs", () => {
    expect(hashUrl("https://a.com")).not.toBe(hashUrl("https://b.com"));
  });
});

describe("categorizeAndScore", () => {
  it("categorizes booking policy text", () => {
    const r = categorizeAndScore("New cancellation policy update", "Refund terms changed for insurance deposits");
    expect(r.category).toBe("BOOKING_POLICY");
    expect(r.score).toBeGreaterThan(0);
    expect(r.keywords.length).toBeGreaterThanOrEqual(2);
  });

  it("categorizes sales opportunity text", () => {
    const r = categorizeAndScore("Summer promotion 50% discount", "Special deal with promo code for upgrades");
    expect(r.category).toBe("SALES_OPPORTUNITY");
    expect(r.score).toBeGreaterThan(0);
  });

  it("categorizes security alert text", () => {
    const r = categorizeAndScore("Phishing scam alert for customers", "Security breach warning issued");
    expect(r.category).toBe("SECURITY_ALERT");
    expect(r.score).toBeGreaterThan(0);
  });

  it("categorizes competitor news text", () => {
    const r = categorizeAndScore("Hertz expands fleet in Europe", "Enterprise rental car hire market share");
    expect(r.category).toBe("COMPETITOR_NEWS");
    expect(r.score).toBeGreaterThan(0);
  });

  it("returns GENERAL for unrelated text", () => {
    const r = categorizeAndScore("Random weather update", "Nothing related to car rental");
    expect(r.category).toBe("GENERAL");
    expect(r.score).toBe(0);
    expect(r.keywords).toEqual([]);
  });

  it("caps score at 1.0", () => {
    const r = categorizeAndScore(
      "booking policy cancellation refund insurance fuel policy surcharge",
      "terms and conditions deposit excess cross-border one-way age limit driver requirement",
    );
    expect(r.score).toBeLessThanOrEqual(1);
  });
});

describe("parseRssFeed", () => {
  it("parses RSS 2.0 items", () => {
    const xml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>Article One</title>
      <link>https://example.com/1</link>
      <description>First article summary</description>
      <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Article Two</title>
      <link>https://example.com/2</link>
      <description><![CDATA[<p>Second article with <b>HTML</b></p>]]></description>
    </item>
  </channel>
</rss>`;
    const items = parseRssFeed(xml);
    expect(items).toHaveLength(2);
    expect(items[0]!.title).toBe("Article One");
    expect(items[0]!.url).toBe("https://example.com/1");
    expect(items[0]!.summary).toBe("First article summary");
    expect(items[0]!.publishedAt).toBe("Mon, 01 Jan 2024 12:00:00 GMT");
    expect(items[1]!.title).toBe("Article Two");
    expect(items[1]!.summary).toContain("Second article with HTML");
  });

  it("parses Atom entries", () => {
    const xml = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <entry>
    <title>Atom Entry</title>
    <link href="https://example.com/atom1" />
    <summary>Summary text</summary>
    <published>2024-01-15T10:00:00Z</published>
  </entry>
</feed>`;
    const items = parseRssFeed(xml);
    expect(items).toHaveLength(1);
    expect(items[0]!.title).toBe("Atom Entry");
    expect(items[0]!.url).toBe("https://example.com/atom1");
    expect(items[0]!.summary).toBe("Summary text");
  });

  it("strips HTML from descriptions", () => {
    const xml = `<rss><channel>
      <item>
        <title>Test</title>
        <link>https://x.com</link>
        <description><![CDATA[<p>Hello &amp; <b>world</b></p>]]></description>
      </item>
    </channel></rss>`;
    const items = parseRssFeed(xml);
    expect(items[0]!.summary).toBe("Hello & world");
  });

  it("returns empty array for invalid XML", () => {
    expect(parseRssFeed("not xml at all")).toEqual([]);
    expect(parseRssFeed("")).toEqual([]);
  });

  it("truncates summary to 500 chars", () => {
    const longDesc = "a".repeat(1000);
    const xml = `<rss><channel><item><title>Long</title><link>https://x.com</link><description>${longDesc}</description></item></channel></rss>`;
    const items = parseRssFeed(xml);
    expect(items[0]!.summary.length).toBeLessThanOrEqual(500);
  });
});

describe("processFeedItems", () => {
  it("adds category, score, keywords, and urlHash to raw items", () => {
    const raw = [
      { title: "New booking policy", summary: "Cancellation refund update", url: "https://x.com/1", publishedAt: null },
      { title: "Random news", summary: "Unrelated content", url: "https://x.com/2", publishedAt: null },
    ];
    const scored = processFeedItems(raw);
    expect(scored).toHaveLength(2);
    expect(scored[0]!.category).toBe("BOOKING_POLICY");
    expect(scored[0]!.urlHash).toHaveLength(32);
    expect(scored[1]!.category).toBe("GENERAL");
  });

  it("preserves original fields", () => {
    const raw = [{ title: "Test", summary: "Sum", url: "https://a.com", publishedAt: "2024-01-01" }];
    const scored = processFeedItems(raw);
    expect(scored[0]!.title).toBe("Test");
    expect(scored[0]!.publishedAt).toBe("2024-01-01");
  });
});

describe("DEFAULT_FEED_SOURCES", () => {
  it("has at least 2 sources", () => {
    expect(DEFAULT_FEED_SOURCES.length).toBeGreaterThanOrEqual(2);
  });

  it("all sources have name, url, type", () => {
    for (const source of DEFAULT_FEED_SOURCES) {
      expect(source.name).toBeTruthy();
      expect(source.url).toMatch(/^https?:\/\//);
      expect(source.type).toBe("rss");
    }
  });
});

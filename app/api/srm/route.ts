import { NextResponse } from "next/server";
import srmEvidence from "../../data/srm-evidence.json";

type SrmRecord = {
  id: string;
  claim: string;
  aliases: string[];
  verdict: "SUPPORTED" | "REFUTED";
  explanation: string;
  reasons: string[];
  sourceName: string;
  sourceUrl: string;
  sourceType: string;
  sourceDate: string;
};

const records = srmEvidence as SrmRecord[];

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreRecord(query: string, record: SrmRecord) {
  const normalizedQuery = normalize(query);

  if (
    normalize(record.claim) === normalizedQuery ||
    record.aliases.some((alias) => normalize(alias) === normalizedQuery)
  ) {
    return 100;
  }

  const ignoredWords = new Set([
    "does",
    "do",
    "did",
    "is",
    "are",
    "was",
    "were",
    "has",
    "have",
    "had",
    "can",
    "could",
    "would",
    "should",
    "will",
    "the",
    "a",
    "an",
    "in",
    "at",
    "of",
    "for",
    "to",
    "on",
    "with",
    "about",
    "srm",
    "srmist",
    "ktr",
    "campus"
  ]);

  const queryKeywords = normalizedQuery
    .split(" ")
    .filter((word) => word.length > 2 && !ignoredWords.has(word));

  if (queryKeywords.length === 0) {
    return 0;
  }

  const searchableText = [record.claim, ...record.aliases]
    .map(normalize)
    .join(" ");

  const matchedKeywords = queryKeywords.filter((word) =>
    searchableText.includes(word)
  );

  const matchRatio = matchedKeywords.length / queryKeywords.length;

  return matchRatio >= 0.6 ? matchedKeywords.length : 0;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";

  if (!query) {
    return NextResponse.json({
      query: "",
      results: [],
      message: "Add a search query using ?q=your-question"
    });
  }

  const results = records
    .map((record) => ({
      record,
      score: scoreRecord(query, record)
    }))
    .filter((item) => item.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => item.record);

  return NextResponse.json({
    query,
    count: results.length,
    results
  });
}
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
  const searchableText = [record.claim, ...record.aliases]
    .map(normalize)
    .join(" ");

  if (
    normalize(record.claim) === normalizedQuery ||
    record.aliases.some((alias) => normalize(alias) === normalizedQuery)
  ) {
    return 100;
  }

  const words = normalizedQuery.split(" ").filter((word) => word.length > 2);
  return words.filter((word) => searchableText.includes(word)).length;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";

  if (!query) {
    return NextResponse.json({
      query: "",
      results: [],
      message: "Add a search query using ?q=your-question",
    });
  }

  const results = records
    .map((record) => ({ record, score: scoreRecord(query, record) }))
    .filter((item) => item.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => item.record);

  return NextResponse.json({
    query,
    count: results.length,
    results,
  });
}
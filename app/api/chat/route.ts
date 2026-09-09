import { NextResponse } from "next/server";
import srmEvidence from "../../data/srm-evidence.json";

type EvidenceRecord = {
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

const records = srmEvidence as EvidenceRecord[];

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findEvidence(question: string) {
  const ignoredWords = new Set([
    "does", "do", "did", "is", "are", "was", "were",
    "has", "have", "had", "can", "could", "would",
    "should", "will", "the", "a", "an", "in", "at",
    "of", "for", "to", "on", "with", "about",
    "srm", "srmist", "ktr", "campus"
  ]);

  const normalizedQuestion = normalize(question);

  const exactMatch = records.filter(
    (record) =>
      normalize(record.claim) === normalizedQuestion ||
      record.aliases.some(
        (alias) => normalize(alias) === normalizedQuestion
      )
  );

  if (exactMatch.length > 0) return exactMatch;

  const keywords = normalizedQuestion
    .split(" ")
    .filter((word) => word.length > 2 && !ignoredWords.has(word));

  if (keywords.length === 0) return [];

  return records
    .map((record) => {
      const searchableText = [record.claim, ...record.aliases]
        .map(normalize)
        .join(" ");

      const matches = keywords.filter((word) =>
        searchableText.includes(word)
      ).length;

      return { record, score: matches / keywords.length };
    })
    .filter((item) => item.score >= 0.6)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => item.record);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const question = typeof body.question === "string"
      ? body.question.trim()
      : "";

    if (!question) {
      return NextResponse.json(
        { error: "Please enter a question." },
        { status: 400 }
      );
    }

    const evidence = findEvidence(question);

    const evidenceText =
      evidence.length > 0
        ? evidence
            .map(
              (record, index) =>
                `SOURCE ${index + 1}
Claim: ${record.claim}
Verdict: ${record.verdict}
Explanation: ${record.explanation}
Reasons: ${record.reasons.join(" ")}
Source: ${record.sourceName}
URL: ${record.sourceUrl}`
            )
            .join("\n\n")
        : "No matching official SRM KTR evidence was retrieved.";

    const ollamaResponse = await fetch(
      "http://127.0.0.1:11434/api/chat",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gemma3:1b",
          stream: false,
          messages: [
            {
              role: "system",
              content:
                "You are Realitysphere, an evidence-first SRM KTR assistant. " +
                "Use ONLY the supplied evidence. Never invent facts, sources, dates, policies, or links. " +
                "If no evidence is supplied, say clearly that there is not enough verified SRM KTR evidence. " +
                "Answer in a friendly, concise, natural style. Do not claim something is true or false unless the evidence directly supports or refutes it."
            },
            {
              role: "user",
              content: `Question: ${question}\n\nVerified evidence:\n${evidenceText}`
            }
          ]
        })
      }
    );

    if (!ollamaResponse.ok) {
      throw new Error("Ollama did not return a response.");
    }

    const ollamaData = await ollamaResponse.json();

    return NextResponse.json({
      answer:
        ollamaData.message?.content ??
        "I could not generate a response.",
      evidence
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Realitysphere could not reach the local AI. Make sure Ollama is running."
      },
      { status: 503 }
    );
  }
}
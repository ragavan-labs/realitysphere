import { GoogleGenAI } from "@google/genai";

export type GeminiVerdict =
  | "SUPPORTED"
  | "CONTRADICTED"
  | "UNKNOWN";

export type GeminiResult = {
  verdict: GeminiVerdict;
  reasoning: string;
  evidenceIds: string[];
};

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY is missing.");
}

const ai = new GoogleGenAI({
  apiKey,
});

export async function reasonOverEvidence(
  claim: string,
  papers: Array<{
    id: string;
    title: string;
    abstract: string;
    url: string;
  }>
): Promise<GeminiResult> {
  const evidence = papers
    .map(
      (paper) => `
EVIDENCE ID: ${paper.id}
TITLE: ${paper.title}
ABSTRACT: ${paper.abstract}
SOURCE: ${paper.url}
`
    )
    .join("\n");

  const prompt = `
You are the verification layer of RealitySphere.

Evaluate the CLAIM using ONLY the scientific evidence provided.

Do NOT use outside knowledge.
Do NOT invent evidence.
Do NOT invent citations.

Definitions:

SUPPORTED:
The provided evidence supports the claim.

CONTRADICTED:
The provided evidence contradicts the claim.

UNKNOWN:
The provided evidence is insufficient, irrelevant, or ambiguous.

Important:
A paper being related to the topic does NOT automatically mean it supports the claim.
Look at the actual abstract.

CLAIM:
${claim}

SCIENTIFIC EVIDENCE:
${evidence}

Return ONLY valid JSON:

{
  "verdict": "SUPPORTED",
  "reasoning": "Brief explanation based only on the supplied evidence.",
  "evidenceIds": ["id1", "id2"]
}
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  if (!response.text) {
    throw new Error("Gemini returned an empty response.");
  }

  const result = JSON.parse(response.text);

  if (
    result.verdict !== "SUPPORTED" &&
    result.verdict !== "CONTRADICTED" &&
    result.verdict !== "UNKNOWN"
  ) {
    throw new Error("Gemini returned an invalid verdict.");
  }

  return {
    verdict: result.verdict,
    reasoning: result.reasoning || "",
    evidenceIds: Array.isArray(result.evidenceIds)
      ? result.evidenceIds.map(String)
      : [],
  };
}
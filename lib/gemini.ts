import { GoogleGenAI } from "@google/genai";

export type GeminiVerdict =
  | "SUPPORTED"
  | "CONTRADICTED"
  | "UNKNOWN";

export type EvidenceRelation =
  | "SUPPORTS"
  | "CONTRADICTS"
  | "NEUTRAL";

export type EvidenceClassification = {
  id: string;
  relation: EvidenceRelation;
  reasoning: string;
};

export type ClassifiedEvidence = {
  id: string;
  title: string;
  content: string;
  url: string;
  relation: EvidenceRelation;
  classificationReasoning: string;
};

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

const MODEL = "gemini-3.6-flash";

/*
 * ============================================================
 * EVIDENCE-LEVEL CLASSIFICATION
 * ============================================================
 */

export async function classifyEvidence(
  claim: string,
  evidenceItems: Array<{
    id: string;
    title: string;
    content: string;
  }>
): Promise<EvidenceClassification[]> {
  const evidence = evidenceItems
    .map(
      (item) => `
EVIDENCE ID: ${item.id}

PAPER TITLE:
${item.title}

EVIDENCE TEXT:
${item.content}
`
    )
    .join("\n--------------------\n");

  const prompt = `
You are the evidence-classification layer of RealitySphere.

Your job is to determine the relationship between the CLAIM
and EACH individual evidence passage.

CLAIM:
${claim}

EVIDENCE:
${evidence}

For every evidence passage, choose exactly one relation.

SUPPORTS:
The passage directly supports the claim or directly answers
the claim in a way consistent with it.

CONTRADICTS:
The passage directly contradicts the claim.

NEUTRAL:
The passage is related to the topic but does not establish
support or contradiction.

IMPORTANT RULES:

1. Use ONLY the supplied evidence.
2. Do NOT use outside knowledge.
3. Do NOT infer support merely from shared keywords.
4. Examine the actual evidence text.
5. Be conservative.
6. If the passage is merely contextual, use NEUTRAL.
7. Return exactly one classification for every evidence ID.
8. Do not invent evidence IDs.

Return ONLY valid JSON in this exact structure:

{
  "classifications": [
    {
      "id": "evidence-id",
      "relation": "SUPPORTS",
      "reasoning": "Brief explanation."
    }
  ]
}
`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  if (!response.text) {
    throw new Error(
      "Gemini returned an empty evidence classification."
    );
  }

  let result: any;

  try {
    result = JSON.parse(response.text);
  } catch {
    throw new Error(
      `Gemini returned invalid classification JSON: ${response.text}`
    );
  }

  if (!Array.isArray(result.classifications)) {
    throw new Error(
      "Gemini returned invalid evidence classifications."
    );
  }

  const validIds = new Set(
    evidenceItems.map((item) => item.id)
  );

  return result.classifications
    .filter(
      (item: any) =>
        item &&
        typeof item.id === "string" &&
        validIds.has(item.id) &&
        (
          item.relation === "SUPPORTS" ||
          item.relation === "CONTRADICTS" ||
          item.relation === "NEUTRAL"
        )
    )
    .map((item: any) => ({
      id: item.id,
      relation: item.relation as EvidenceRelation,
      reasoning:
        typeof item.reasoning === "string"
          ? item.reasoning
          : "",
    }));
}

/*
 * ============================================================
 * FINAL CLAIM JUDGE
 * ============================================================
 */

export async function reasonOverEvidence(
  claim: string,
  evidenceItems: ClassifiedEvidence[]
): Promise<GeminiResult> {
  const evidence = evidenceItems
    .map(
      (item) => `
EVIDENCE ID: ${item.id}

PAPER TITLE:
${item.title}

SOURCE:
${item.url}

CLASSIFICATION:
${item.relation}

CLASSIFICATION REASONING:
${item.classificationReasoning}

EVIDENCE TEXT:
${item.content}
`
    )
    .join("\n--------------------\n");

  const supportCount = evidenceItems.filter(
    (item) => item.relation === "SUPPORTS"
  ).length;

  const contradictCount = evidenceItems.filter(
    (item) => item.relation === "CONTRADICTS"
  ).length;

  const neutralCount = evidenceItems.filter(
    (item) => item.relation === "NEUTRAL"
  ).length;

  const prompt = `
You are the final scientific claim-verification judge of RealitySphere.

Evaluate the CLAIM using ONLY the classified evidence below.

CLAIM:
${claim}

EVIDENCE:

${evidence}

EVIDENCE AGGREGATION:

SUPPORTS: ${supportCount}
CONTRADICTS: ${contradictCount}
NEUTRAL: ${neutralCount}

RULES:

1. Use ONLY the supplied evidence.
2. Do NOT use outside knowledge.
3. Do NOT invent facts or citations.
4. Trust the actual evidence text more than topic similarity.
5. SUPPORTS means the retrieved evidence establishes or directly
   answers the claim consistently with the claim.
6. CONTRADICTED means the retrieved evidence directly conflicts
   with the claim.
7. UNKNOWN means the evidence is insufficient, ambiguous,
   unrelated, or does not establish the claim.
8. If supporting and contradicting evidence are both substantial,
   prefer UNKNOWN unless one side clearly dominates.
9. For explanatory questions, judge whether the retrieved evidence
   directly provides the relationship or explanation being asked.
10. Only return evidence IDs that materially support the final verdict.

Return ONLY valid JSON:

{
  "verdict": "SUPPORTED",
  "reasoning": "Brief explanation based only on the classified evidence.",
  "evidenceIds": ["evidence-id"]
}
`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  if (!response.text) {
    throw new Error(
      "Gemini returned an empty final verdict."
    );
  }

  let result: any;

  try {
    result = JSON.parse(response.text);
  } catch {
    throw new Error(
      `Gemini returned invalid final JSON: ${response.text}`
    );
  }

  if (
    result.verdict !== "SUPPORTED" &&
    result.verdict !== "CONTRADICTED" &&
    result.verdict !== "UNKNOWN"
  ) {
    throw new Error(
      `Invalid Gemini verdict: ${result.verdict}`
    );
  }

  const validIds = new Set(
    evidenceItems.map((item) => item.id)
  );

  return {
    verdict: result.verdict,
    reasoning:
      typeof result.reasoning === "string"
        ? result.reasoning
        : "",
    evidenceIds: Array.isArray(result.evidenceIds)
      ? result.evidenceIds
          .map(String)
          .filter((id: string) =>
            validIds.has(id)
          )
      : [],
  };
}
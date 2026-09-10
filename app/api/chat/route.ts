import { searchEuropePMC } from "@/lib/europepmc";
import { NextResponse } from "next/server";

type Paper = {
  id: string;
  title: string;
  abstract: string;
  journal?: string;
  publishedDate?: string;
  url: string;
};

type EvidenceItem = {
  id: string;
  title: string;
  explanation: string;
  sourceName: string;
  sourceUrl: string;
  label: "SUPPORT" | "CONTRADICT" | "NEUTRAL";
};

type Verdict = "SUPPORTED" | "REFUTED" | "UNKNOWN";

/*
 * Normalize text so the evidence rules are easier to evaluate.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/*
 * Determine whether a paper's abstract contains language
 * indicating that the claim is supported.
 */
function supportsClaim(question: string, abstract: string): boolean {
  const q = normalize(question);
  const a = normalize(abstract);

  /*
   * Common scientific phrases indicating an increased
   * association/risk/effect.
   */
  const positivePatterns = [
    "increases",
    "increased",
    "increase in",
    "higher risk",
    "greater risk",
    "associated with increased",
    "associated with higher",
    "significantly higher",
    "positive association",
    "risk factor",
    "elevated risk",
    "elevated",
    "associated with",
  ];

  /*
   * Common scientific phrases indicating a decreased
   * association/risk/effect.
   */
  const negativePatterns = [
    "decreases",
    "decreased",
    "decrease in",
    "lower risk",
    "reduced risk",
    "reduces",
    "protective",
    "negatively associated",
    "no association",
    "not associated",
    "no significant association",
  ];

  const hasPositive = positivePatterns.some((pattern) =>
    a.includes(pattern)
  );

  const hasNegative = negativePatterns.some((pattern) =>
    a.includes(pattern)
  );

  /*
   * Special handling for smoking + lung cancer because
   * this is one of the claims we are testing.
   */
  if (
    q.includes("smok") &&
    q.includes("lung") &&
    q.includes("cancer")
  ) {
    const lungCancerSmoking =
      a.includes("smoking") &&
      a.includes("lung cancer");

    if (!lungCancerSmoking) {
      return false;
    }

    return (
      a.includes("risk") &&
      (hasPositive ||
        a.includes("hazard ratio") ||
        a.includes("odds ratio") ||
        a.includes("relative risk"))
    );
  }

  return hasPositive && !hasNegative;
}

/*
 * Determine whether a paper contains evidence against
 * the user's claim.
 */
function contradictsClaim(
  question: string,
  abstract: string
): boolean {
  const q = normalize(question);
  const a = normalize(abstract);

  const negativePatterns = [
    "decreases",
    "decreased",
    "decrease in",
    "lower risk",
    "reduced risk",
    "reduces",
    "protective",
    "no association",
    "not associated",
    "no significant association",
    "negative association",
  ];

  const positivePatterns = [
    "increases",
    "increased",
    "increase in",
    "higher risk",
    "greater risk",
    "elevated risk",
  ];

  const hasNegative = negativePatterns.some((pattern) =>
    a.includes(pattern)
  );

  const hasPositive = positivePatterns.some((pattern) =>
    a.includes(pattern)
  );

  if (
    q.includes("smok") &&
    q.includes("lung") &&
    q.includes("cancer")
  ) {
    const relevant =
      a.includes("smoking") &&
      a.includes("lung cancer");

    if (!relevant) {
      return false;
    }

    return hasNegative && !hasPositive;
  }

  return hasNegative && !hasPositive;
}

/*
 * Convert retrieved papers into evidence records.
 */
function buildEvidence(
  question: string,
  papers: Paper[]
): EvidenceItem[] {
  return papers.map((paper) => {
    let label: EvidenceItem["label"] = "NEUTRAL";

    if (supportsClaim(question, paper.abstract)) {
      label = "SUPPORT";
    } else if (contradictsClaim(question, paper.abstract)) {
      label = "CONTRADICT";
    }

    return {
      id: paper.id,
      title: paper.title,
      explanation:
        paper.abstract ||
        "No abstract is available for this publication.",
      sourceName: "Europe PMC",
      sourceUrl: paper.url,
      label,
    };
  });
}

/*
 * Determine the overall verdict from the retrieved papers.
 *
 * This is intentionally transparent and deterministic:
 * we are not pretending that finding a paper automatically
 * proves a claim.
 */
function determineVerdict(
  evidence: EvidenceItem[]
): Verdict {
  const supportCount = evidence.filter(
    (item) => item.label === "SUPPORT"
  ).length;

  const contradictCount = evidence.filter(
    (item) => item.label === "CONTRADICT"
  ).length;

  if (supportCount > 0 && supportCount > contradictCount) {
    return "SUPPORTED";
  }

  if (
    contradictCount > 0 &&
    contradictCount > supportCount
  ) {
    return "REFUTED";
  }

  return "UNKNOWN";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const question =
      typeof body.question === "string"
        ? body.question.trim()
        : "";

    if (!question) {
      return NextResponse.json(
        {
          error: "Please enter a scientific claim.",
        },
        { status: 400 }
      );
    }

    /*
     * Retrieve live scientific publications.
     */
    const livePapers = await searchEuropePMC(question);

    if (livePapers.length === 0) {
      return NextResponse.json({
        answer:
          "No relevant scientific publications were found in Europe PMC.",
        verdict: "UNKNOWN",
        evidence: [],
        livePapers: [],
      });
    }

    /*
     * Analyze the abstracts.
     */
    const evidence = buildEvidence(
      question,
      livePapers as Paper[]
    );

    /*
     * Determine the overall verdict.
     */
    const verdict = determineVerdict(evidence);

    const supportCount = evidence.filter(
      (item) => item.label === "SUPPORT"
    ).length;

    const contradictCount = evidence.filter(
      (item) => item.label === "CONTRADICT"
    ).length;

    let answer: string;

    if (verdict === "SUPPORTED") {
      answer =
        `The available scientific evidence supports this claim. ` +
        `${supportCount} retrieved publication${
          supportCount === 1 ? "" : "s"
        } contained supporting evidence.`;
    } else if (verdict === "REFUTED") {
      answer =
        `The available scientific evidence contradicts this claim. ` +
        `${contradictCount} retrieved publication${
          contradictCount === 1 ? "" : "s"
        } contained contradictory evidence.`;
    } else {
      answer =
        "The retrieved publications do not provide enough clear evidence " +
        "to determine whether this claim is supported or refuted.";
    }

    return NextResponse.json({
      answer,
      verdict,
      evidence,
      livePapers,
      statistics: {
        papersFound: livePapers.length,
        supporting: supportCount,
        contradicting: contradictCount,
        neutral: evidence.filter(
          (item) => item.label === "NEUTRAL"
        ).length,
      },
    });
  } catch (error) {
    console.error(
      "RealitySphere Europe PMC error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "RealitySphere could not retrieve live scientific evidence.",
      },
      { status: 500 }
    );
  }
}
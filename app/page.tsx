"use client";

import { FormEvent, useState } from "react";

type EvidenceRelation =
  | "SUPPORTS"
  | "CONTRADICTS"
  | "NEUTRAL";

type EvidenceItem = {
  id: string;
  title: string;
  explanation: string;
  sourceName: string;
  sourceUrl: string;
  label?: EvidenceRelation;
  classificationReasoning?: string;
  rerankScore?: number;
};

type VerificationResponse = {
  verdict?:
    | "TRUE"
    | "FALSE"
    | "MIXED"
    | "UNKNOWN"
    | "SUPPORTED"
    | "CONTRADICTED"
    | "REFUTED";

  claim?: string;
  explanation?: string;
  reasoning?: string;
  answer?: string;

  evidence?: EvidenceItem[];

  evidenceIds?: string[];

  error?: string;
};

/*
 * Extract a short, readable excerpt from a retrieved evidence chunk.
 *
 * The original chunks are large because they come from extracted PDFs.
 * We do not want to display the entire chunk in the UI.
 */
function getEvidenceExcerpt(
  content: string,
  claim: string,
  maxLength = 520
): string {
  const cleaned = content
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return "No readable evidence text was returned.";
  }

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  /*
   * Try to find a sentence that contains words
   * from the user's claim.
   */
  const claimWords = new Set(
    claim
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 4)
  );

  const sentences =
    cleaned.match(/[^.!?]+[.!?]+/g) ?? [cleaned];

  let bestSentence = "";
  let bestScore = 0;

  for (const sentence of sentences) {
    const words = sentence
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/);

    let score = 0;

    for (const word of words) {
      if (claimWords.has(word)) {
        score += 1;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestSentence = sentence.trim();
    }
  }

  /*
   * If a relevant sentence was found, show it.
   */
  if (bestSentence) {
    if (bestSentence.length <= maxLength) {
      return bestSentence;
    }

    return `${bestSentence.slice(0, maxLength).trim()}...`;
  }

  /*
   * Otherwise simply truncate the chunk.
   */
  return `${cleaned.slice(0, maxLength).trim()}...`;
}

/*
 * Return visual styling for each evidence relation.
 */
function getEvidenceStyle(
  relation: EvidenceRelation
) {
  switch (relation) {
    case "SUPPORTS":
      return {
        label: "SUPPORTS",
        badge:
          "border-emerald-800/60 bg-emerald-950/50 text-emerald-400",
        border:
          "border-emerald-900/50",
        reasoning:
          "text-emerald-300",
      };

    case "CONTRADICTS":
      return {
        label: "CONTRADICTS",
        badge:
          "border-red-800/60 bg-red-950/50 text-red-400",
        border:
          "border-red-900/50",
        reasoning:
          "text-red-300",
      };

    default:
      return {
        label: "NEUTRAL",
        badge:
          "border-zinc-700 bg-zinc-800/60 text-zinc-400",
        border:
          "border-zinc-800",
        reasoning:
          "text-zinc-400",
      };
  }
}

export default function Home() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] =
    useState<VerificationResponse | null>(null);

  async function verifyClaim(event: FormEvent) {
    event.preventDefault();

    const question = input.trim();

    if (!question || loading) {
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question,
        }),
      });

      const data =
        (await response.json()) as VerificationResponse;

      if (!response.ok) {
        throw new Error(
          data.error ??
            "RealitySphere could not verify this claim."
        );
      }

      setResult(data);
    } catch (error) {
      setResult({
        verdict: "UNKNOWN",
        explanation:
          error instanceof Error
            ? error.message
            : "Something went wrong while verifying the claim.",
      });
    } finally {
      setLoading(false);
    }
  }

  function newClaim() {
    setInput("");
    setResult(null);
  }

  /*
   * Normalize old and new verdict names.
   */
  const displayVerdict =
    result?.verdict === "SUPPORTED"
      ? "SUPPORTED"
      : result?.verdict === "CONTRADICTED"
        ? "CONTRADICTED"
        : result?.verdict === "REFUTED"
          ? "REFUTED"
          : result?.verdict === "TRUE"
            ? "TRUE"
            : result?.verdict === "FALSE"
              ? "FALSE"
              : result?.verdict === "MIXED"
                ? "MIXED"
                : "UNKNOWN";

  /*
   * Verdict color.
   */
  const verdictColor =
    displayVerdict === "TRUE" ||
    displayVerdict === "SUPPORTED"
      ? "text-emerald-400"
      : displayVerdict === "FALSE" ||
          displayVerdict === "REFUTED" ||
          displayVerdict === "CONTRADICTED"
        ? "text-red-400"
        : displayVerdict === "MIXED"
          ? "text-yellow-400"
          : "text-zinc-400";

  /*
   * Claim card background.
   */
  const claimCardColor =
    displayVerdict === "TRUE" ||
    displayVerdict === "SUPPORTED"
      ? "border-emerald-900/60 bg-emerald-950/30"
      : displayVerdict === "FALSE" ||
          displayVerdict === "REFUTED" ||
          displayVerdict === "CONTRADICTED"
        ? "border-red-900/60 bg-red-950/30"
        : displayVerdict === "MIXED"
          ? "border-yellow-900/60 bg-yellow-950/20"
          : "border-zinc-800 bg-zinc-900/60";

  const claimLabelColor =
    displayVerdict === "TRUE" ||
    displayVerdict === "SUPPORTED"
      ? "text-emerald-400"
      : displayVerdict === "FALSE" ||
          displayVerdict === "REFUTED" ||
          displayVerdict === "CONTRADICTED"
        ? "text-red-400"
        : displayVerdict === "MIXED"
          ? "text-yellow-400"
          : "text-zinc-400";

  const claimTextColor =
    displayVerdict === "TRUE" ||
    displayVerdict === "SUPPORTED"
      ? "text-emerald-100"
      : displayVerdict === "FALSE" ||
          displayVerdict === "REFUTED" ||
          displayVerdict === "CONTRADICTED"
        ? "text-red-100"
        : displayVerdict === "MIXED"
          ? "text-yellow-100"
          : "text-zinc-100";

  /*
   * API currently returns `answer` and `reasoning`,
   * while older versions used `explanation`.
   *
   * Support all of them so the UI remains compatible.
   */
  const analysis =
    result?.explanation ??
    result?.reasoning ??
    result?.answer ??
    "";

  /*
   * Evidence returned by the backend.
   */
  const allEvidence = result?.evidence ?? [];

  /*
   * Reduce repeated chunks from the same paper.
   *
   * First select the strongest evidence from each unique paper.
   * Then, if we have fewer than 5 papers, fill the remaining
   * slots with the strongest remaining chunks.
   */
  const displayedEvidence = (() => {
    if (allEvidence.length === 0) {
      return [];
    }

    const selected: EvidenceItem[] = [];
    const selectedIds = new Set<string>();
    const selectedPaperTitles = new Set<string>();

    /*
     * First pass:
     * one strongest item per paper.
     */
    const sorted = [...allEvidence].sort(
      (a, b) =>
        (b.rerankScore ?? 0) -
        (a.rerankScore ?? 0)
    );

    for (const item of sorted) {
      if (
        selected.length >= 5
      ) {
        break;
      }

      if (
        !selectedPaperTitles.has(item.title)
      ) {
        selected.push(item);
        selectedIds.add(item.id);
        selectedPaperTitles.add(item.title);
      }
    }

    /*
     * Second pass:
     * if the corpus only returned one or two papers,
     * add additional high-ranking chunks.
     */
    if (selected.length < 5) {
      for (const item of sorted) {
        if (selected.length >= 5) {
          break;
        }

        if (!selectedIds.has(item.id)) {
          selected.push(item);
          selectedIds.add(item.id);
        }
      }
    }

    return selected;
  })();

  /*
   * Evidence statistics.
   */
  const supportingCount = allEvidence.filter(
    (item) => item.label === "SUPPORTS"
  ).length;

  const contradictingCount = allEvidence.filter(
    (item) => item.label === "CONTRADICTS"
  ).length;

  const neutralCount = allEvidence.filter(
    (item) => item.label === "NEUTRAL"
  ).length;

  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-950 text-white">
      {/* Background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-40 top-20 h-[32rem] w-[32rem] rounded-full bg-blue-700/20 blur-3xl" />

        <div className="absolute -right-40 bottom-0 h-[30rem] w-[30rem] rounded-full bg-purple-700/20 blur-3xl" />
      </div>

      <div className="relative z-10 min-h-screen">
        {/* Header */}
        <header className="absolute left-0 right-0 top-0 px-8 py-7">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                Realitysphere
              </h1>

              <p className="mt-1 text-sm text-zinc-400">
                Claim verification
              </p>
            </div>

            <button
              onClick={newClaim}
              className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:bg-white/5"
            >
              New claim
            </button>
          </div>
        </header>

        {/* Main */}
        <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center px-6 pb-16 pt-32">
          {/* Initial screen */}
          {!result && !loading && (
            <div className="flex flex-1 flex-col items-center justify-center pb-20 text-center">
              <p className="mb-4 text-sm font-medium uppercase tracking-[0.25em] text-zinc-500">
                Reality check
              </p>

              <h2 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
                What&apos;s the claim?
              </h2>

              <p className="mt-4 max-w-xl text-zinc-400">
                Enter a scientific claim and
                RealitySphere will evaluate it against
                the indexed arXiv research corpus.
              </p>

              {/* Centered search */}
              <form
                onSubmit={verifyClaim}
                className="mt-10 flex w-full max-w-3xl gap-3"
              >
                <input
                  value={input}
                  onChange={(event) =>
                    setInput(event.target.value)
                  }
                  placeholder="Enter a claim to verify..."
                  disabled={loading}
                  autoFocus
                  className="min-w-0 flex-1 rounded-2xl border border-zinc-700 bg-zinc-900/90 px-6 py-5 text-lg outline-none placeholder:text-zinc-500 focus:border-blue-500 disabled:opacity-60"
                />

                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-2xl bg-white px-7 py-5 font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Verify
                </button>
              </form>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex flex-1 flex-col items-center justify-center pb-20 text-center">
              <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
                Analyzing claim
              </p>

              <div className="mt-4 text-2xl text-zinc-300">
                Checking
                <span className="animate-pulse">
                  ...
                </span>
              </div>

              <p className="mt-3 max-w-md text-sm leading-6 text-zinc-600">
                Searching the indexed arXiv corpus and
                evaluating the strongest evidence.
              </p>
            </div>
          )}

          {/* Result */}
          {result && !loading && (
            <div className="w-full max-w-4xl">
              {/* CLAIM */}
              <div
                className={`mb-8 rounded-2xl border p-6 transition-colors duration-300 ${claimCardColor}`}
              >
                <p
                  className={`text-xs font-bold uppercase tracking-[0.18em] ${claimLabelColor}`}
                >
                  Claim evaluated
                </p>

                <p
                  className={`mt-3 text-xl leading-8 ${claimTextColor}`}
                >
                  {input}
                </p>
              </div>

              {/* SEARCH BOX */}
              <form
                onSubmit={verifyClaim}
                className="mb-10 flex w-full gap-3"
              >
                <input
                  value={input}
                  onChange={(event) =>
                    setInput(event.target.value)
                  }
                  placeholder="Enter another claim..."
                  className="min-w-0 flex-1 rounded-2xl border border-zinc-700 bg-zinc-900/90 px-5 py-4 outline-none placeholder:text-zinc-500 focus:border-blue-500"
                />

                <button
                  type="submit"
                  className="rounded-2xl bg-white px-6 py-4 font-semibold text-black transition hover:bg-zinc-200"
                >
                  Verify
                </button>
              </form>

              {/* VERDICT */}
              <div className="text-center">
                <p className="text-sm uppercase tracking-[0.25em] text-zinc-500">
                  Verdict
                </p>

                <div
                  className={`mt-4 text-5xl font-bold tracking-tight sm:text-6xl ${verdictColor}`}
                >
                  {displayVerdict}
                </div>
              </div>

              {/* ANALYSIS */}
              {analysis && (
                <div className="mt-12">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                    Analysis
                  </p>

                  <div className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
                    <p className="text-base leading-7 text-zinc-300">
                      {analysis}
                    </p>
                  </div>
                </div>
              )}

              {/* EVIDENCE SUMMARY */}
              {allEvidence.length > 0 && (
                <div className="mt-10 grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-4 text-center">
                    <p className="text-2xl font-semibold text-emerald-400">
                      {supportingCount}
                    </p>

                    <p className="mt-1 text-xs uppercase tracking-wider text-zinc-500">
                      Supporting
                    </p>
                  </div>

                  <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-4 text-center">
                    <p className="text-2xl font-semibold text-red-400">
                      {contradictingCount}
                    </p>

                    <p className="mt-1 text-xs uppercase tracking-wider text-zinc-500">
                      Contradicting
                    </p>
                  </div>

                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-center">
                    <p className="text-2xl font-semibold text-zinc-400">
                      {neutralCount}
                    </p>

                    <p className="mt-1 text-xs uppercase tracking-wider text-zinc-500">
                      Neutral
                    </p>
                  </div>
                </div>
              )}

              {/* EVIDENCE */}
              {displayedEvidence.length > 0 && (
                <section className="mt-12">
                  <div className="mb-5">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                      Evidence
                    </p>

                    <h3 className="mt-2 text-2xl font-semibold">
                      Sources behind the verdict
                    </h3>

                    <p className="mt-2 text-sm text-zinc-500">
                      Showing the strongest evidence passages
                      from the indexed arXiv corpus.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {displayedEvidence.map(
                      (item, index) => {
                        const relation =
                          item.label ?? "NEUTRAL";

                        const style =
                          getEvidenceStyle(
                            relation
                          );

                        const excerpt =
                          getEvidenceExcerpt(
                            item.explanation,
                            input
                          );

                        return (
                          <article
                            key={`${item.id || "evidence"}-${index}`}
                            className={`rounded-2xl border bg-zinc-900/60 p-6 transition ${style.border}`}
                          >
                            {/* Top row */}
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <h4 className="text-lg font-medium leading-7 text-zinc-100">
                                  {item.title}
                                </h4>
                              </div>

                              <span
                                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold tracking-wide ${style.badge}`}
                              >
                                {style.label}
                              </span>
                            </div>

                            {/* Evidence excerpt */}
                            <div className="mt-5 rounded-xl border border-zinc-800 bg-black/20 p-5">
                              <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-600">
                                Relevant passage
                              </p>

                              <p className="mt-3 text-base leading-7 text-zinc-300">
                                &ldquo;
                                {excerpt}
                                &rdquo;
                              </p>
                            </div>

                            {/* Classification reasoning */}
                            {item.classificationReasoning && (
                              <div className="mt-4">
                                <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-600">
                                  Why this evidence was classified
                                </p>

                                <p
                                  className={`mt-2 text-sm leading-6 ${style.reasoning}`}
                                >
                                  {
                                    item.classificationReasoning
                                  }
                                </p>
                              </div>
                            )}

                            {/* Source */}
                            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-4">
                              <div>
                                {item.sourceName && (
                                  <p className="text-xs text-zinc-600">
                                    Source:{" "}
                                    {item.sourceName}
                                  </p>
                                )}

                                {item.rerankScore !==
                                  undefined && (
                                  <p className="mt-1 text-xs text-zinc-700">
                                    Retrieval relevance:{" "}
                                    {item.rerankScore.toFixed(
                                      3
                                    )}
                                  </p>
                                )}
                              </div>

                              {item.sourceUrl && (
                                <a
                                  href={
                                    item.sourceUrl
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-blue-400 underline underline-offset-4 transition hover:text-blue-300"
                                >
                                  Open research paper →
                                </a>
                              )}
                            </div>
                          </article>
                        );
                      }
                    )}
                  </div>
                </section>
              )}

              {/* NO EVIDENCE */}
              {allEvidence.length === 0 && (
                <div className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 text-sm text-zinc-500">
                  No evidence is currently attached to
                  this result.
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
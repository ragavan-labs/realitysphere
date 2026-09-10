"use client";

import { FormEvent, useState } from "react";

type EvidenceItem = {
  id: string;
  title: string;
  explanation: string;
  sourceName: string;
  sourceUrl: string;
};

type VerificationResponse = {
  verdict?:
    | "TRUE"
    | "FALSE"
    | "MIXED"
    | "UNKNOWN"
    | "SUPPORTED"
    | "REFUTED";
  claim?: string;
  explanation?: string;
  evidence?: EvidenceItem[];
  answer?: string;
  error?: string;
};

export default function Home() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResponse | null>(null);

  async function verifyClaim(event: FormEvent) {
    event.preventDefault();

    const question = input.trim();

    if (!question || loading) return;

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

      const data = (await response.json()) as VerificationResponse;

      if (!response.ok) {
        throw new Error(
          data.error ?? "RealitySphere could not verify this claim."
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

  const displayVerdict =
    result?.verdict === "SUPPORTED"
      ? "SUPPORTED"
      : result?.verdict === "REFUTED"
        ? "REFUTED"
        : result?.verdict === "TRUE"
          ? "TRUE"
          : result?.verdict === "FALSE"
            ? "FALSE"
            : result?.verdict === "MIXED"
              ? "MIXED"
              : "UNKNOWN";

  const verdictColor =
    displayVerdict === "TRUE" || displayVerdict === "SUPPORTED"
      ? "text-emerald-400"
      : displayVerdict === "FALSE" || displayVerdict === "REFUTED"
        ? "text-red-400"
        : displayVerdict === "MIXED"
          ? "text-yellow-400"
          : "text-zinc-400";

  /*
   * CLAIM CARD COLOR
   *
   * SUPPORTED / TRUE  -> Green
   * REFUTED / FALSE   -> Red
   * MIXED             -> Yellow
   * UNKNOWN           -> Neutral
   */
  const claimCardColor =
    displayVerdict === "TRUE" || displayVerdict === "SUPPORTED"
      ? "border-emerald-900/60 bg-emerald-950/30"
      : displayVerdict === "FALSE" || displayVerdict === "REFUTED"
        ? "border-red-900/60 bg-red-950/30"
        : displayVerdict === "MIXED"
          ? "border-yellow-900/60 bg-yellow-950/20"
          : "border-zinc-800 bg-zinc-900/60";

  const claimLabelColor =
    displayVerdict === "TRUE" || displayVerdict === "SUPPORTED"
      ? "text-emerald-400"
      : displayVerdict === "FALSE" || displayVerdict === "REFUTED"
        ? "text-red-400"
        : displayVerdict === "MIXED"
          ? "text-yellow-400"
          : "text-zinc-400";

  const claimTextColor =
    displayVerdict === "TRUE" || displayVerdict === "SUPPORTED"
      ? "text-emerald-100"
      : displayVerdict === "FALSE" || displayVerdict === "REFUTED"
        ? "text-red-100"
        : displayVerdict === "MIXED"
          ? "text-yellow-100"
          : "text-zinc-100";

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
                Enter a claim and RealitySphere will evaluate it against the
                available verification data.
              </p>

              {/* Centered search */}
              <form
                onSubmit={verifyClaim}
                className="mt-10 flex w-full max-w-3xl gap-3"
              >
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
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
                <span className="animate-pulse">...</span>
              </div>
            </div>
          )}

          {/* Result */}
          {result && !loading && (
            <div className="w-full max-w-4xl">
              {/* ================================================== */}
              {/* CLAIM — VERDICT BASED COLOR */}
              {/* ================================================== */}

              <div
                className={`mb-8 rounded-2xl border p-6 transition-colors duration-300 ${claimCardColor}`}
              >
                <p
                  className={`text-xs font-bold uppercase tracking-[0.18em] ${claimLabelColor}`}
                >
                  Claim
                </p>

                <p
                  className={`mt-3 text-xl leading-8 ${claimTextColor}`}
                >
                  {input}
                </p>
              </div>

              {/* ================================================== */}
              {/* SEARCH BOX */}
              {/* ================================================== */}

              <form
                onSubmit={verifyClaim}
                className="mb-8 flex w-full gap-3"
              >
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
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

              {/* ================================================== */}
              {/* VERIFIED REAL CLAIM — GREEN */}
              {/* ================================================== */}

              {result.claim && (
                <div className="mb-12 rounded-2xl border border-emerald-900/60 bg-emerald-950/30 p-6">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-400">
                    Verified real claim
                  </p>

                  <p className="mt-3 text-xl leading-8 text-zinc-100">
                    {result.claim}
                  </p>
                </div>
              )}

              {/* ================================================== */}
              {/* VERDICT */}
              {/* ================================================== */}

              <div className="text-center">
                <p className="text-sm uppercase tracking-[0.25em] text-zinc-500">
                  Verdict
                </p>

                <div
                  className={`mt-4 text-6xl font-bold tracking-tight ${verdictColor}`}
                >
                  {displayVerdict}
                </div>
              </div>

              {/* ================================================== */}
              {/* ANALYSIS */}
              {/* ================================================== */}

              {result.explanation && (
                <div className="mt-12">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                    Analysis
                  </p>

                  <p className="mt-3 text-base leading-7 text-zinc-300">
                    {result.explanation}
                  </p>
                </div>
              )}

              {/* ================================================== */}
              {/* EVIDENCE */}
              {/* ================================================== */}

              {result.evidence && result.evidence.length > 0 && (
                <section className="mt-12">
                  <div className="mb-5">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                      Evidence
                    </p>

                    <h3 className="mt-2 text-2xl font-semibold">
                      Sources behind the verdict
                    </h3>
                  </div>

                  <div className="space-y-4">
                    {result.evidence.map((item, index) => {
                      /*
                       * Use the API's real source URL if available.
                       * Otherwise create a Semantic Scholar search URL
                       * from the evidence title.
                       */
                      const paperUrl =
  item.sourceUrl?.trim() ||
  `https://europepmc.org/article/MED/${item.id}`;

                      return (
                        <article
                          key={`${item.id || "evidence"}-${index}`}
                          className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6"
                        >
                          {/* Evidence title */}
                          <h4 className="text-lg font-medium text-zinc-100">
                            {item.title}
                          </h4>

                          {/* Evidence explanation */}
                          <p className="mt-3 leading-7 text-zinc-400">
                            {item.explanation}
                          </p>

                          {/* Semantic Scholar link */}
                          <a
                            href={paperUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-4 inline-block text-sm text-blue-400 underline underline-offset-4 transition hover:text-blue-300"
                          >
                           Open research paper →
                          </a>

                          {/* Source name */}
                          {item.sourceName && (
                            <p className="mt-2 text-xs text-zinc-600">
                              Source: {item.sourceName}
                            </p>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* ================================================== */}
              {/* NO EVIDENCE */}
              {/* ================================================== */}

              {(!result.evidence || result.evidence.length === 0) && (
                <div className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 text-sm text-zinc-500">
                  No evidence is currently attached to this result.
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
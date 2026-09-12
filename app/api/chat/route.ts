import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

import { supabase } from "@/lib/supabase";

import {
  classifyEvidence,
  reasonOverEvidence,
} from "@/lib/gemini";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

type Candidate = {
  id: string;
  paper_id: string;
  content: string;
  vectorRank?: number;
  keywordRank?: number;
  hybridScore: number;
};

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

    console.log("\n==============================");
    console.log("REALITYSPHERE CLAIM:");
    console.log(question);
    console.log("==============================");

    /*
     * ==========================================================
     * 1. EMBED CLAIM
     * ==========================================================
     */

    console.log("\n========== EMBEDDING ==========");

    const embeddingResponse =
      await ai.models.embedContent({
        model: "gemini-embedding-2",
        contents: question,
        config: {
          outputDimensionality: 768,
        },
      });

    const queryEmbedding =
      embeddingResponse.embeddings?.[0]?.values;

    if (!queryEmbedding) {
      throw new Error(
        "Gemini returned no query embedding."
      );
    }

    /*
     * ==========================================================
     * 2. VECTOR SEARCH
     * ==========================================================
     */

    const {
      data: vectorResults,
      error: vectorError,
    } = await supabase.rpc("match_chunks", {
      query_embedding: queryEmbedding,
      match_count: 20,
    });

    if (vectorError) {
      throw new Error(
        `Vector search failed: ${vectorError.message}`
      );
    }

    /*
     * ==========================================================
     * 3. KEYWORD SEARCH
     * ==========================================================
     */

    const {
      data: keywordResults,
      error: keywordError,
    } = await supabase.rpc(
      "search_chunks_keyword",
      {
        query_text: question,
        match_count: 20,
      }
    );

    if (keywordError) {
      throw new Error(
        `Keyword search failed: ${keywordError.message}`
      );
    }

    /*
     * ==========================================================
     * 4. RRF HYBRID RETRIEVAL
     * ==========================================================
     */

    const candidates = new Map<
      string,
      Candidate
    >();

    (vectorResults ?? []).forEach(
      (item: any, index: number) => {
        candidates.set(item.id, {
          id: item.id,
          paper_id: item.paper_id,
          content: item.content,
          vectorRank: index + 1,
          hybridScore:
            1 / (60 + index + 1),
        });
      }
    );

    (keywordResults ?? []).forEach(
      (item: any, index: number) => {
        const existing =
          candidates.get(item.id);

        if (existing) {
          existing.keywordRank =
            index + 1;

          existing.hybridScore +=
            1 / (60 + index + 1);
        } else {
          candidates.set(item.id, {
            id: item.id,
            paper_id: item.paper_id,
            content: item.content,
            keywordRank: index + 1,
            hybridScore:
              1 / (60 + index + 1),
          });
        }
      }
    );

    const hybridResults =
      Array.from(candidates.values())
        .sort(
          (a, b) =>
            b.hybridScore -
            a.hybridScore
        )
        .slice(0, 20);

    console.log(
      "\n========== RETRIEVAL =========="
    );

    console.log(
      "Vector results:",
      vectorResults?.length ?? 0
    );

    console.log(
      "Keyword results:",
      keywordResults?.length ?? 0
    );

    console.log(
      "Hybrid results:",
      hybridResults.length
    );

    hybridResults
      .slice(0, 8)
      .forEach((item, index) => {
        console.log(
          `\n--- RETRIEVED ${index + 1} ---`
        );

        console.log(
          "ID:",
          item.id
        );

        console.log(
          "PAPER:",
          item.paper_id
        );

        console.log(
          "SCORE:",
          item.hybridScore
        );

        console.log(
          "CONTENT:",
          item.content.slice(
            0,
            1000
          )
        );
      });

    /*
     * ==========================================================
     * NO EVIDENCE
     * ==========================================================
     */

    if (hybridResults.length === 0) {
      return NextResponse.json({
        answer:
          "No relevant scientific evidence was found in the indexed arXiv corpus.",

        verdict: "UNKNOWN",

        reasoning:
          "The indexed corpus did not contain sufficient evidence to evaluate the claim.",

        evidence: [],

        livePapers: [],

        statistics: {
          papersFound: 0,
          evidenceFound: 0,
          supporting: 0,
          contradicting: 0,
          neutral: 0,
        },
      });
    }

    /*
     * ==========================================================
     * 5. TOP 8 EVIDENCE
     *
     * BGE is intentionally not used here for now because
     * Windows is blocking the PyTorch DLL in the local
     * virtual environment.
     * ==========================================================
     */

    const topEvidence =
      hybridResults
        .slice(0, 8)
        .map((item) => ({
          id: item.id,
          paper_id: item.paper_id,
          content: item.content,
          rerank_score:
            item.hybridScore,
        }));

    /*
     * ==========================================================
     * 6. FETCH PAPER METADATA
     * ==========================================================
     */

    const paperIds = [
      ...new Set(
        topEvidence.map(
          (item) => item.paper_id
        )
      ),
    ];

    const {
      data: papers,
      error: papersError,
    } = await supabase
      .from("papers")
      .select(
        "id, arxiv_id, title, abstract, authors, published_at, pdf_url"
      )
      .in("id", paperIds);

    if (papersError) {
      throw new Error(
        `Paper lookup failed: ${papersError.message}`
      );
    }

    const paperMap = new Map(
      (papers ?? []).map((paper) => [
        paper.id,
        paper,
      ])
    );

    /*
     * ==========================================================
     * 7. EVIDENCE CLASSIFICATION
     * ==========================================================
     */

    console.log(
      "\n========== CLASSIFICATION =========="
    );

    const classifications =
      await classifyEvidence(
        question,
        topEvidence.map((item) => {
          const paper =
            paperMap.get(
              item.paper_id
            );

          return {
            id: item.id,

            title:
              paper?.title ??
              "Unknown arXiv paper",

            content: item.content,
          };
        })
      );

    const classificationMap =
      new Map(
        classifications.map(
          (item) => [
            item.id,
            item,
          ]
        )
      );

    /*
     * Make sure every retrieved passage gets
     * a classification.
     *
     * If Gemini accidentally omits one,
     * safely mark it NEUTRAL.
     */

    const classifiedEvidence =
      topEvidence.map((item) => {
        const paper =
          paperMap.get(
            item.paper_id
          );

        const classification =
          classificationMap.get(
            item.id
          );

        return {
          id: item.id,

          title:
            paper?.title ??
            "Unknown arXiv paper",

          content: item.content,

          url: paper
            ? `https://arxiv.org/abs/${paper.arxiv_id}`
            : "",

          relation:
            classification?.relation ??
            "NEUTRAL",

          classificationReasoning:
            classification?.reasoning ??
            "The evidence was retrieved as relevant, but no direct support or contradiction was established.",
        };
      });

    classifiedEvidence.forEach(
      (item) => {
        console.log(
          item.relation,
          "|",
          item.id
        );

        console.log(
          item.classificationReasoning
        );
      }
    );

    /*
     * ==========================================================
     * 8. AGGREGATION
     * ==========================================================
     */

    const supporting =
      classifiedEvidence.filter(
        (item) =>
          item.relation ===
          "SUPPORTS"
      ).length;

    const contradicting =
      classifiedEvidence.filter(
        (item) =>
          item.relation ===
          "CONTRADICTS"
      ).length;

    const neutral =
      classifiedEvidence.filter(
        (item) =>
          item.relation ===
          "NEUTRAL"
      ).length;

    console.log(
      "\n========== AGGREGATION =========="
    );

    console.log(
      "Supporting:",
      supporting
    );

    console.log(
      "Contradicting:",
      contradicting
    );

    console.log(
      "Neutral:",
      neutral
    );

    /*
     * ==========================================================
     * 9. FINAL GEMINI JUDGE
     * ==========================================================
     */

    console.log(
      "\n========== FINAL JUDGE =========="
    );

    const geminiResult =
      await reasonOverEvidence(
        question,
        classifiedEvidence
      );

    console.log(
      "Verdict:",
      geminiResult.verdict
    );

    console.log(
      "Reasoning:",
      geminiResult.reasoning
    );

    /*
     * ==========================================================
     * 10. FRONTEND EVIDENCE
     * ==========================================================
     */

    const evidence =
      topEvidence.map((item) => {
        const paper =
          paperMap.get(
            item.paper_id
          );

        const classification =
          classificationMap.get(
            item.id
          );

        return {
          id: item.id,

          title:
            paper?.title ??
            "Unknown arXiv paper",

          explanation:
            item.content,

          sourceName: "arXiv",

          sourceUrl: paper
            ? `https://arxiv.org/abs/${paper.arxiv_id}`
            : "",

          label:
            classification?.relation ??
            "NEUTRAL",

          classificationReasoning:
            classification?.reasoning ??
            "No direct support or contradiction was established.",

          rerankScore:
            item.rerank_score,
        };
      });

    /*
     * ==========================================================
     * 11. PAPER LIST
     * ==========================================================
     */

    const livePapers =
      (papers ?? []).map((paper) => ({
        id: paper.id,

        title: paper.title,

        abstract:
          paper.abstract ?? "",

        url: `https://arxiv.org/abs/${paper.arxiv_id}`,
      }));

    /*
     * ==========================================================
     * 12. FINAL RESPONSE
     * ==========================================================
     */

    return NextResponse.json({
      answer:
        geminiResult.reasoning,

      verdict:
        geminiResult.verdict,

      reasoning:
        geminiResult.reasoning,

      evidenceIds:
        geminiResult.evidenceIds,

      evidence,

      livePapers,

      statistics: {
        papersFound:
          livePapers.length,

        evidenceFound:
          evidence.length,

        supporting,

        contradicting,

        neutral,
      },
    });
  } catch (error) {
    console.error(
      "RealitySphere retrieval error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "RealitySphere could not retrieve scientific evidence.",
      },
      { status: 500 }
    );
  }
}
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const question =
  "How are graph neural networks used with covariance matrices?";

async function main() {
  console.log(`Hybrid search: ${question}\n`);

  // 1. Create query embedding
  const result = await ai.models.embedContent({
    model: "gemini-embedding-2",
    contents: question,
    config: {
      outputDimensionality: 768,
    },
  });

  const embedding = result.embeddings?.[0]?.values;

  if (!embedding) throw new Error("No embedding generated");

  // 2. Vector search
  const { data: vectorResults, error: vectorError } =
    await supabase.rpc("match_chunks", {
      query_embedding: embedding,
      match_count: 5,
    });

  if (vectorError) throw vectorError;

  // 3. Keyword search
  const { data: keywordResults, error: keywordError } =
    await supabase.rpc("search_chunks_keyword", {
      query_text: question,
      match_count: 5,
    });

  if (keywordError) throw keywordError;

  // 4. Combine and remove duplicates
  const combined = new Map<string, any>();

  for (const item of vectorResults ?? []) {
    combined.set(item.id, {
      ...item,
      source: "vector",
      score: item.similarity,
    });
  }

  for (const item of keywordResults ?? []) {
    if (combined.has(item.id)) {
      combined.get(item.id).source = "both";
      combined.get(item.id).keywordRank = item.rank;
    } else {
      combined.set(item.id, {
        ...item,
        source: "keyword",
        score: item.rank,
      });
    }
  }

  console.log("HYBRID RESULTS:\n");

  [...combined.values()]
    .slice(0, 10)
    .forEach((item, i) => {
      console.log(`--- Result ${i + 1} [${item.source}] ---`);
      console.log(`Score: ${item.score}`);
      console.log(item.content.slice(0, 500));
      console.log();
    });
}

main().catch(console.error);
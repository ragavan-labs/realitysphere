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

const question = "How are graph neural networks used with covariance matrices?";
async function main() {
  console.log(`Searching for: ${question}`);

  const result = await ai.models.embedContent({
    model: "gemini-embedding-2",
    contents: question,
    config: {
      outputDimensionality: 768,
    },
  });

  const embedding = result.embeddings?.[0]?.values;

  if (!embedding) {
    throw new Error("No embedding generated");
  }

  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: embedding,
    match_count: 5,
  });

  if (error) throw error;

  console.log("\nTop evidence:\n");

  data.forEach((item: any, i: number) => {
    console.log(`--- Result ${i + 1} ---`);
    console.log(`Similarity: ${item.similarity}`);
    console.log(item.content.slice(0, 500));
    console.log();
  });
}

main().catch(console.error);
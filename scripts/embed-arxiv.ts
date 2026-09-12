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

const BATCH_SIZE = 20;

async function main() {
  const { data: chunks, error } = await supabase
    .from("chunks")
    .select("id, content")
    .eq("embedded", false)
    .limit(BATCH_SIZE);

  if (error) throw error;

  if (!chunks || chunks.length === 0) {
    console.log("No unembedded chunks left.");
    return;
  }

  console.log(`Embedding ${chunks.length} chunks...`);

  for (const chunk of chunks) {
    try {
      const result = await ai.models.embedContent({
        model: "gemini-embedding-2",
        contents: chunk.content,
        config: {
          outputDimensionality: 768,
        },
      });

      const embedding = result.embeddings?.[0]?.values;

      if (!embedding) {
        console.log(`No embedding returned: ${chunk.id}`);
        continue;
      }

      const { error: updateError } = await supabase
        .from("chunks")
        .update({
          embedding,
          embedded: true,
        })
        .eq("id", chunk.id);

      if (updateError) {
        console.log(`Update failed: ${chunk.id}`, updateError);
      } else {
        console.log(`✓ ${chunk.id}`);
      }

      await new Promise((r) => setTimeout(r, 3000));
    } catch (err: any) {
  console.log(`Embedding failed: ${chunk.id}`);

  if (err?.status === 429) {
    console.log("Gemini quota temporarily exhausted. Stopping batch.");
    break;
  }

  console.log(err);
}
  }

  console.log("Batch complete.");
}

main().catch(console.error);
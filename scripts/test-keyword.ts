import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const question =
  "How are graph neural networks used with covariance matrices?";

async function main() {
  console.log(`Keyword search: ${question}\n`);

  const { data, error } = await supabase.rpc("search_chunks_keyword", {
    query_text: question,
    match_count: 5,
  });

  if (error) throw error;

  data.forEach((item: any, i: number) => {
    console.log(`--- Result ${i + 1} ---`);
    console.log(`Rank: ${item.rank}`);
    console.log(item.content.slice(0, 500));
    console.log();
  });
}

main().catch(console.error);
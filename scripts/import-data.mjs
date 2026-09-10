import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { fetchSemanticScholar } from './fetch-semantic.mjs';
import { fetchEuropePMC } from './fetch-epmc.mjs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function importAllData() {
  console.log("Fetching real-world data from APIs...");
  const aiPapers = await fetchSemanticScholar("machine learning");
  const bioPapers = await fetchEuropePMC("CRISPR");
  
  const allPapers = [...aiPapers, ...bioPapers];
  console.log(`Found ${allPapers.length} papers. Uploading to Supabase...`);
  
  let counter = 1;

  for (const paper of allPapers) {
    const currentId = counter++;

    // 1. Insert into documents table using 'id'
    const { error: docError } = await supabase
      .from('documents')
      .upsert({
        id: currentId,
        title: paper.title,
        abstract: [paper.abstract],
        structured: true
      }, { onConflict: 'id' });

    if (docError) {
      console.error(`Doc Error (ID ${currentId}):`, docError.message);
      continue;
    }

    // 2. Insert into claims table
    const { error: claimError } = await supabase
      .from('claims')
      .insert({ 
        id: currentId, 
        claim: paper.title,
        cited_doc_ids: [currentId]
      });

    if (claimError) {
      console.error(`Claim Error (ID ${currentId}):`, claimError.message);
      continue;
    }

    // 3. Insert into evidence table
    const { error: evidenceError } = await supabase
      .from('evidence')
      .insert({
        claim_id: currentId,
        document_id: currentId,
        sentence_indices: [0],
        label: "SUPPORT"
      });

    if (evidenceError) {
      console.error(`Evidence Error (ID ${currentId}):`, evidenceError.message);
    }
  }
  
  console.log("Import completed successfully!");
}

importAllData();
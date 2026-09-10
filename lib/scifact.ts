const { data: evidence, error: evidenceError } = await supabase
  .from("evidence")
  .select("claim_id, document_id, sentence_indices, label");

console.log("SCIFACT DEBUG evidence rows:", evidence?.length);
console.log("SCIFACT DEBUG first evidence:", evidence?.[0]);
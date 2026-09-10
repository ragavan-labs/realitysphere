export async function fetchSemanticScholar(query) {
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=5&fields=title,abstract,paperId`;
  const response = await fetch(url);
  const data = await response.json();
  return (data.data || []).filter(paper => paper.abstract).map(paper => ({
    id: paper.paperId,
    title: paper.title,
    abstract: paper.abstract,
    source: 'semantic_scholar'
  }));
}
export async function fetchEuropePMC(query) {
  const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}&format=json&resultType=core`;
  const response = await fetch(url);
  const data = await response.json();
  const results = data.resultList?.result || [];
  return results.filter(paper => paper.abstractText).map(paper => ({
    id: paper.pmid || paper.pmcid || String(Math.random()),
    title: paper.title,
    abstract: paper.abstractText,
    source: 'europepmc'
  }));
}
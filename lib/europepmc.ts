export type EuropePMCPaper = {
  id: string;
  title: string;
  abstract: string;
  journal?: string;
  publishedDate?: string;
  url: string;
};

export async function searchEuropePMC(
  question: string
): Promise<EuropePMCPaper[]> {
  const query = question.trim();

  if (!query) {
    return [];
  }

  const url =
    "https://www.ebi.ac.uk/europepmc/webservices/rest/search" +
    `?query=${encodeURIComponent(query)}` +
    "&format=json" +
"&pageSize=5&resultType=core";
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(
        `Europe PMC returned HTTP ${response.status}`
      );
    }

    const data = await response.json();

    const results = data?.resultList?.result;

    if (!Array.isArray(results)) {
      console.error("Unexpected Europe PMC response:", data);
      return [];
    }

    return results.map((paper: any) => ({
      id: String(paper.pmid ?? paper.id ?? ""),
      title: String(paper.title ?? ""),
      abstract: String(paper.abstractText ?? ""),
      journal: paper.journalTitle
        ? String(paper.journalTitle)
        : undefined,
      publishedDate: paper.firstPublicationDate
        ? String(paper.firstPublicationDate)
        : undefined,
      url: `https://europepmc.org/article/${paper.source}/${paper.id}`,
    }));
  } catch (error) {
    console.error("Europe PMC search failed:", error);
    throw error;
  }
}
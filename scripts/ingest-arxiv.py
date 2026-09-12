
import os
import re
import time
import requests
import pymupdf
import xml.etree.ElementTree as ET

from supabase import create_client
from dotenv import load_dotenv


load_dotenv(".env.local")

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

CATEGORY = "cs.LG"
MAX_PAPERS = 10

PDF_DIR = "data/papers"
os.makedirs(PDF_DIR, exist_ok=True)


def clean_text(text):
    text = text.replace("\x00", "")
    return re.sub(r"\s+", " ", text).strip()


def chunk_text(text, words_per_chunk=700, overlap=100):
    words = text.split()
    chunks = []

    start = 0

    while start < len(words):
        end = start + words_per_chunk
        chunk = " ".join(words[start:end])

        if chunk.strip():
            chunks.append(chunk)

        start += words_per_chunk - overlap

    return chunks


def fetch_arxiv():
    url = (
        "https://export.arxiv.org/api/query"
        f"?search_query=cat:{CATEGORY}"
        "&start=0"
        f"&max_results={MAX_PAPERS}"
        "&sortBy=submittedDate"
        "&sortOrder=descending"
    )

    response = requests.get(url, timeout=30)
    response.raise_for_status()

    root = ET.fromstring(response.text)

    namespace = {
        "atom": "http://www.w3.org/2005/Atom"
    }

    papers = []

    for entry in root.findall("atom:entry", namespace):
        arxiv_id = entry.find("atom:id", namespace).text.split("/")[-1]

        title = clean_text(
            entry.find("atom:title", namespace).text
        )

        abstract = clean_text(
            entry.find("atom:summary", namespace).text
        )

        published = entry.find(
            "atom:published", namespace
        ).text

        authors = [
            author.find("atom:name", namespace).text
            for author in entry.findall(
                "atom:author", namespace
            )
        ]

        pdf_url = f"https://arxiv.org/pdf/{arxiv_id}"

        papers.append({
            "arxiv_id": arxiv_id,
            "title": title,
            "abstract": abstract,
            "authors": authors,
            "published_at": published,
            "pdf_url": pdf_url
        })

    return papers


def download_pdf(paper):
    path = os.path.join(
        PDF_DIR,
        f"{paper['arxiv_id'].replace('/', '_')}.pdf"
    )

    if os.path.exists(path):
        return path

    print(f"Downloading {paper['arxiv_id']}...")

    response = requests.get(
        paper["pdf_url"],
        timeout=60
    )

    response.raise_for_status()

    with open(path, "wb") as f:
        f.write(response.content)

    time.sleep(3)

    return path


def extract_pdf(path):
    document = fitz.open(path)
    pages = []

    for page in document:
        pages.append(page.get_text())

    document.close()

    return clean_text("\n".join(pages))


def process_paper(paper):
    print(f"\nProcessing: {paper['title']}")

    existing = (
        supabase
        .table("papers")
        .select("id")
        .eq("arxiv_id", paper["arxiv_id"])
        .execute()
    )

    if existing.data:
        print("Already exists. Skipping.")
        return

    pdf_path = download_pdf(paper)

    text = extract_pdf(pdf_path)

    chunks = chunk_text(text)

    paper_row = {
        "arxiv_id": paper["arxiv_id"],
        "title": paper["title"],
        "abstract": paper["abstract"],
        "authors": paper["authors"],
        "published_at": paper["published_at"],
        "pdf_url": paper["pdf_url"]
    }

    result = (
        supabase
        .table("papers")
        .insert(paper_row)
        .execute()
    )

    paper_id = result.data[0]["id"]

    chunk_rows = [
        {
            "paper_id": paper_id,
            "chunk_index": i,
            "content": chunk
        }
        for i, chunk in enumerate(chunks)
    ]

    if chunk_rows:
        (
            supabase
            .table("chunks")
            .insert(chunk_rows)
            .execute()
        )

    print(
        f"Stored paper + {len(chunk_rows)} chunks."
    )


def main():
    print("Fetching arXiv papers...")

    papers = fetch_arxiv()

    print(f"Found {len(papers)} papers.")

    for paper in papers:
        try:
            process_paper(paper)
        except Exception as e:
            print(
                f"ERROR processing "
                f"{paper['arxiv_id']}: {e}"
            )


if __name__ == "__main__":
    main()
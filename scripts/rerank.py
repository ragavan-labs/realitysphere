import sys
import json
import re

from sentence_transformers import CrossEncoder


MODEL_NAME = "BAAI/bge-reranker-base"


def clean_text(value):
    """
    Convert input to a safe plain string.

    PDF extraction can contain null bytes and
    other control characters that should never
    reach the cross-encoder.
    """
    if value is None:
        return ""

    text = str(value)

    text = text.replace("\x00", " ")

    # Remove problematic control characters.
    text = re.sub(r"[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]", " ", text)

    # Normalize whitespace.
    text = re.sub(r"\s+", " ", text)

    return text.strip()


def main():
    try:
        raw_input = sys.stdin.read()

        if not raw_input.strip():
            raise ValueError("No JSON input received.")

        data = json.loads(raw_input)

        query = clean_text(data.get("query"))

        if not query:
            raise ValueError("Query is empty.")

        passages = data.get("passages", [])

        if not isinstance(passages, list):
            raise ValueError("Passages must be an array.")

        clean_passages = []

        for passage in passages:
            if not isinstance(passage, dict):
                continue

            passage_id = clean_text(passage.get("id"))
            paper_id = clean_text(passage.get("paper_id"))
            content = clean_text(passage.get("content"))

            if not passage_id or not content:
                continue

            clean_passages.append(
                {
                    "id": passage_id,
                    "paper_id": paper_id,
                    "content": content,
                }
            )

        if not clean_passages:
            print("[]")
            return

        # Load the cross-encoder.
        model = CrossEncoder(
            MODEL_NAME,
            max_length=512,
        )

        pairs = [
            [query, passage["content"]]
            for passage in clean_passages
        ]

        # Small batches keep memory usage stable.
        scores = model.predict(
            pairs,
            batch_size=8,
            show_progress_bar=False,
        )

        results = []

        for passage, score in zip(
            clean_passages,
            scores,
        ):
            results.append(
                {
                    "id": passage["id"],
                    "paper_id": passage["paper_id"],
                    "content": passage["content"],
                    "rerank_score": float(score),
                }
            )

        results.sort(
            key=lambda item: item["rerank_score"],
            reverse=True,
        )

        # stdout MUST contain only JSON.
        print(
            json.dumps(
                results,
                ensure_ascii=False,
            )
        )

    except Exception as error:
        # Diagnostics go to stderr, never stdout.
        print(
            f"RERANKER ERROR: {error}",
            file=sys.stderr,
        )

        sys.exit(1)


if __name__ == "__main__":
    main()
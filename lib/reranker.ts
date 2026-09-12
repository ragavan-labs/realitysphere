import { spawn } from "child_process";
import path from "path";
import fs from "fs";

export type RerankInput = {
  id: string;
  paper_id: string;
  content: string;
};

export type RerankItem = {
  id: string;
  paper_id: string;
  content: string;
  rerank_score: number;
};

function cleanText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(/\u0000/g, " ")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function rerank(
  query: string,
  passages: RerankInput[]
): Promise<RerankItem[]> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(
      process.cwd(),
      "scripts",
      "rerank.py"
    );

    /*
     * Always use the project's Python 3.12
     * virtual environment on Windows.
     */
    const pythonPath =
      process.platform === "win32"
        ? path.join(
            process.cwd(),
            ".venv",
            "Scripts",
            "python.exe"
          )
        : "python3";

    if (
      process.platform === "win32" &&
      !fs.existsSync(pythonPath)
    ) {
      reject(
        new Error(
          `Python virtual environment not found: ${pythonPath}`
        )
      );

      return;
    }

    const python = spawn(
  "wsl.exe",
  [
    "-d",
    "Ubuntu",
    "--",
    "bash",
    "-lc",
    "source ~/.venvs/bge/bin/activate && python /mnt/c/Users/ragav/Documents/reality-check/scripts/rerank.py",
  ],
  {
    windowsHide: true,
  }
);

    let output = "";
    let errorOutput = "";

    let finished = false;

    const timeout = setTimeout(() => {
      if (finished) {
        return;
      }

      finished = true;

      python.kill();

      reject(
        new Error(
          "BGE reranker timed out after 120 seconds."
        )
      );
    }, 120_000);

    python.stdout.on("data", (data) => {
      output += data.toString();
    });

    python.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    python.on("error", (error) => {
      if (finished) {
        return;
      }

      finished = true;

      clearTimeout(timeout);

      reject(error);
    });

    python.on("close", (code) => {
      if (finished) {
        return;
      }

      finished = true;

      clearTimeout(timeout);

      if (code !== 0) {
        reject(
          new Error(
            `BGE reranker failed (${code}): ${
              errorOutput.trim() ||
              "Unknown Python error."
            }`
          )
        );

        return;
      }

      try {
        const parsed = JSON.parse(
          output.trim()
        );

        if (!Array.isArray(parsed)) {
          throw new Error(
            "Reranker returned a non-array response."
          );
        }

        const results: RerankItem[] =
          parsed.map((item: any) => ({
            id: String(item.id),
            paper_id: String(item.paper_id),
            content: cleanText(item.content),
            rerank_score: Number(
              item.rerank_score
            ),
          }));

        resolve(results);
      } catch (error) {
        reject(
          new Error(
            `Invalid BGE reranker output: ${
              error instanceof Error
                ? error.message
                : String(error)
            }\nOutput: ${output.slice(0, 1000)}`
          )
        );
      }
    });

    const payload = {
      query: cleanText(query),

      passages: passages
        .map((passage) => ({
          id: cleanText(passage.id),
          paper_id: cleanText(
            passage.paper_id
          ),
          content: cleanText(
            passage.content
          ),
        }))
        .filter(
          (passage) =>
            passage.id &&
            passage.content
        ),
    };

    python.stdin.write(
      JSON.stringify(payload)
    );

    python.stdin.end();
  });
}
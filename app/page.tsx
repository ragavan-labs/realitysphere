"use client";

import { FormEvent, useState } from "react";

type EvidenceRecord = {
  id: string;
  claim: string;
  verdict: "SUPPORTED" | "REFUTED";
  explanation: string;
  reasons: string[];
  sourceName: string;
  sourceUrl: string;
  sourceType: string;
  sourceDate: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  evidence?: EvidenceRecord[];
};

type ChatResponse = {
  answer?: string;
  evidence?: EvidenceRecord[];
  error?: string;
};

function makeId() {
  return `${Date.now()}-${Math.random()}`;
}

export default function Home() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Hi, I’m Realitysphere. Ask me about SRM KTR and I’ll answer using the official evidence currently available in my database."
    }
  ]);

  async function sendMessage(event: FormEvent) {
    event.preventDefault();

    const question = input.trim();
    if (!question || loading) return;

    const userMessage: ChatMessage = {
      id: makeId(),
      role: "user",
      text: question
    };

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question
        })
      });

      const data = (await response.json()) as ChatResponse;

      if (!response.ok) {
        throw new Error(
          data.error ?? "Realitysphere could not answer that right now."
        );
      }

      setMessages((current) => [
        ...current,
        {
          id: makeId(),
          role: "assistant",
          text:
            data.answer ??
            "I could not generate an answer from the available evidence.",
          evidence: data.evidence ?? []
        }
      ]);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Realitysphere could not answer that right now.";

      setMessages((current) => [
        ...current,
        {
          id: makeId(),
          role: "assistant",
          text: message
        }
      ]);
    } finally {
      setLoading(false);
    }
  }

  function clearChat() {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        text: "New conversation started. Ask me about SRM KTR and I’ll use available official evidence."
      }
    ]);
    setInput("");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-950 text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-40 top-12 h-[32rem] w-[32rem] rounded-full bg-blue-700/20 blur-3xl" />
        <div className="absolute -right-40 bottom-0 h-[30rem] w-[30rem] rounded-full bg-purple-700/20 blur-3xl" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="border-b border-white/10 px-6 py-5">
          <div className="mx-auto flex max-w-4xl items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                Realitysphere
              </h1>
              <p className="mt-1 text-sm text-zinc-400">
                SRM KTR evidence assistant
              </p>
            </div>

            <button
              onClick={clearChat}
              className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:bg-white/5"
            >
              New chat
            </button>
          </div>
        </header>

        <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 py-8">
          <div className="flex-1 space-y-7 pb-8">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === "user" ? "justify-end" : ""
                }`}
              >
                {message.role === "assistant" && (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white font-bold text-black">
                    R
                  </div>
                )}

                <div className="max-w-2xl">
                  <div
                    className={`rounded-2xl px-5 py-4 leading-7 ${
                      message.role === "user"
                        ? "bg-blue-600 text-white"
                        : "border border-zinc-800 bg-zinc-900/90 text-zinc-100"
                    }`}
                  >
                    {message.text}
                  </div>

                  {message.role === "assistant" &&
                    message.evidence &&
                    message.evidence.length > 0 && (
                      <div className="mt-3 space-y-3">
                        <p className="text-xs font-bold tracking-[0.15em] text-zinc-500">
                          VERIFIED EVIDENCE USED
                        </p>

                        {message.evidence.map((record) => (
                          <article
                            key={record.id}
                            className="rounded-xl border border-zinc-800 bg-black/30 p-4"
                          >
                            <p
                              className={`text-xs font-bold tracking-[0.12em] ${
                                record.verdict === "SUPPORTED"
                                  ? "text-emerald-400"
                                  : "text-red-400"
                              }`}
                            >
                              {record.verdict}
                            </p>

                            <p className="mt-2 font-medium text-zinc-100">
                              {record.claim}
                            </p>

                            <p className="mt-2 text-sm text-zinc-400">
                              {record.sourceType} · {record.sourceDate}
                            </p>

                            <a
                              href={record.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-3 inline-block text-sm text-blue-400 underline underline-offset-4 hover:text-blue-300"
                            >
                              Open source: {record.sourceName}
                            </a>
                          </article>
                        ))}
                      </div>
                    )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white font-bold text-black">
                  R
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 px-5 py-4 text-zinc-400">
                  Checking verified SRM evidence
                  <span className="animate-pulse">...</span>
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={sendMessage}
            className="sticky bottom-0 flex gap-3 border-t border-white/10 bg-zinc-950/80 py-5 backdrop-blur"
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about SRM KTR campus..."
              disabled={loading}
              className="min-w-0 flex-1 rounded-2xl border border-zinc-700 bg-zinc-900 px-5 py-4 outline-none placeholder:text-zinc-500 focus:border-blue-500 disabled:opacity-60"
            />

            <button
              type="submit"
              disabled={loading}
              className="rounded-2xl bg-white px-6 py-4 font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Send
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
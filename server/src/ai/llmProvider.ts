import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import dotenv from "dotenv";

dotenv.config();

interface LlmInvokeOptions {
  retries?: number;
  temperature?: number;
  timeoutMs?: number;
}

const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const groqModel = process.env.CHATGROQ_MODEL || "llama-3.3-70b-versatile";

let gemini: ChatGoogleGenerativeAI | null = null;

function getGeminiClient(): ChatGoogleGenerativeAI {
  if (gemini) {
    return gemini;
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY is not configured");
  }

  gemini = new ChatGoogleGenerativeAI({
    model: geminiModel,
    apiKey,
  });

  return gemini;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, providerName: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${providerName} timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}

function isRetryable(err: unknown): boolean {
  const msg = String((err as any)?.message || err || "").toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("resource exhausted") ||
    msg.includes("rate") ||
    msg.includes("timeout") ||
    msg.includes("503")
  );
}

function extractContentText(content: any): string {
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part?.text) return String(part.text);
        return "";
      })
      .join("\n")
      .trim();
  }

  if (typeof content === "string") {
    return content;
  }

  return String(content ?? "").trim();
}

async function invokeGemini(prompt: string, retries: number): Promise<string> {
  let lastErr: unknown;
  const client = getGeminiClient();

  for (let i = 0; i < retries; i += 1) {
    try {
      const response = await client.invoke(prompt as any);
      const text = extractContentText((response as any).content);
      if (text) return text;
      throw new Error("Gemini returned empty content");
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || i === retries - 1) break;
      await sleep(1000 * (i + 1));
    }
  }

  throw lastErr;
}

async function invokeGeminiWithTimeout(prompt: string, retries: number, timeoutMs: number): Promise<string> {
  let lastErr: unknown;
  const client = getGeminiClient();

  for (let i = 0; i < retries; i += 1) {
    try {
      const response = await withTimeout(client.invoke(prompt as any), timeoutMs, "Gemini");
      const text = extractContentText((response as any).content);
      if (text) return text;
      throw new Error("Gemini returned empty content");
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || i === retries - 1) break;
      await sleep(1000 * (i + 1));
    }
  }

  throw lastErr;
}

async function invokeGroq(prompt: string, retries: number, temperature: number, timeoutMs: number): Promise<string> {
  const apiKey = process.env.CHATGROQ_API_KEY;
  if (!apiKey) {
    throw new Error("CHATGROQ_API_KEY is not configured");
  }

  let lastErr: unknown;

  for (let i = 0; i < retries; i += 1) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: groqModel,
          temperature,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      }).finally(() => clearTimeout(timeout));

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Groq request failed: ${response.status} ${body}`);
      }

      const json = (await response.json()) as any;
      const text = String(json?.choices?.[0]?.message?.content ?? "").trim();

      if (!text) {
        throw new Error("Groq returned empty content");
      }

      return text;
    } catch (err) {
      const mappedErr = (err as any)?.name === "AbortError"
        ? new Error(`Groq timeout after ${timeoutMs}ms`)
        : err;
      lastErr = mappedErr;
      if (!isRetryable(mappedErr) || i === retries - 1) break;
      await sleep(1000 * (i + 1));
    }
  }

  throw lastErr;
}

export async function invokeWithFallback(prompt: string, options: LlmInvokeOptions = {}): Promise<string> {
  const retries = options.retries ?? 3;
  const temperature = options.temperature ?? 0.2;
  const timeoutMs = options.timeoutMs ?? Number(process.env.LLM_PROVIDER_TIMEOUT_MS ?? 12000);

  try {
    return await invokeGeminiWithTimeout(prompt, retries, timeoutMs);
  } catch (geminiErr) {
    try {
      return await invokeGroq(prompt, retries, temperature, timeoutMs);
    } catch (groqErr) {
      const geminiMsg = String((geminiErr as any)?.message || geminiErr || "Gemini failed");
      const groqMsg = String((groqErr as any)?.message || groqErr || "Groq failed");
      throw new Error(`All LLM providers failed. Gemini: ${geminiMsg}. Groq: ${groqMsg}`);
    }
  }
}

export function parseJsonLoose<T>(raw: string): T {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  return JSON.parse(cleaned) as T;
}

import dotenv from "dotenv";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

dotenv.config();

// Gemini client: single place to configure and call the LLM
export async function runGeminiEcho(prompt: string) {
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    apiKey: process.env.GOOGLE_API_KEY as string,
  });

  const response = await model.invoke(prompt);
  return response;
}

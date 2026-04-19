"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runGeminiEcho = runGeminiEcho;
const dotenv_1 = __importDefault(require("dotenv"));
const google_genai_1 = require("@langchain/google-genai");
dotenv_1.default.config();
// Gemini client: single place to configure and call the LLM
async function runGeminiEcho(prompt) {
    const model = new google_genai_1.ChatGoogleGenerativeAI({
        model: "gemini-2.5-flash",
        apiKey: process.env.GOOGLE_API_KEY,
    });
    const response = await model.invoke(prompt);
    return response;
}
//# sourceMappingURL=geminiClient.js.map
import mongoose from "mongoose";

mongoose.set("bufferCommands", false);
mongoose.set("bufferTimeoutMS", 0);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableMongoError(error: unknown): boolean {
  const msg = String((error as any)?.message || error || "").toLowerCase();
  return (
    msg.includes("etimedout") ||
    msg.includes("timeout") ||
    msg.includes("mongodbnetworkerror") ||
    msg.includes("econnreset") ||
    msg.includes("ehostunreach") ||
    msg.includes("enotfound") ||
    msg.includes("server selection")
  );
}

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.warn("[database] MONGODB_URI is not set. Database will not connect.");
    return;
  }

  const maxRetries = Number(process.env.MONGODB_CONNECT_RETRIES ?? 5);

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS ?? 10000),
        connectTimeoutMS: Number(process.env.MONGODB_CONNECT_TIMEOUT_MS ?? 10000),
        socketTimeoutMS: Number(process.env.MONGODB_SOCKET_TIMEOUT_MS ?? 30000),
      });
      console.log("[database] Connected to MongoDB");
      return;
    } catch (error) {
      const retryable = isRetryableMongoError(error);
      const isLast = attempt >= maxRetries;

      console.error(`[database] MongoDB connection error (attempt ${attempt}/${maxRetries})`, error);

      if (!retryable || isLast) {
        console.error("[database] Continuing startup without DB connection. API routes requiring MongoDB will fail until connectivity is restored.");
        return;
      }

      await sleep(1000 * attempt);
    }
  }
}

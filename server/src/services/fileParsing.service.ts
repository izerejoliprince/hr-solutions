import mammoth from "mammoth";

export interface SupportedUploadFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

// Extract raw text from a PDF buffer
async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const mod: any = await import("pdf-parse");

  // Legacy `pdf-parse` versions export a callable parser function.
  const legacyParser =
    (typeof mod === "function" && mod) ||
    (typeof mod?.default === "function" && mod.default) ||
    (typeof mod?.pdfParse === "function" && mod.pdfParse) ||
    (typeof mod?.default?.default === "function" && mod.default.default) ||
    (typeof mod?.default?.pdfParse === "function" && mod.default.pdfParse);

  if (legacyParser) {
    const data = await legacyParser(buffer);
    return (data as any).text ?? "";
  }

  // Newer `pdf-parse` versions expose `PDFParse` class.
  const PDFParseCtor = mod?.PDFParse || mod?.default?.PDFParse;
  if (typeof PDFParseCtor === "function") {
    const parser = new PDFParseCtor({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return String(result?.text ?? "").trim();
    } finally {
      if (typeof parser.destroy === "function") {
        await parser.destroy();
      }
    }
  }

  throw new Error("PDF parser is unavailable in the current runtime");
}

// Extract raw text from a DOCX buffer
async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value ?? "";
}

// Decide which extractor to use based on mimetype or filename
export async function extractTextFromUploadedFile(file: SupportedUploadFile): Promise<string> {
  const mime = file.mimetype;
  const lowerName = file.originalname.toLowerCase();

  if (mime === "application/pdf" || lowerName.endsWith(".pdf")) {
    return extractTextFromPdf(file.buffer);
  }

  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerName.endsWith(".docx")
  ) {
    return extractTextFromDocx(file.buffer);
  }

  // Fallback: assume it's plain text or something similar
  return file.buffer.toString("utf8");
}

/**
 * PDF and text file parser.
 * Extracts raw text from uploaded materials.
 */

/**
 * Extract text from a Buffer containing PDF or plain text.
 * Supports: .pdf, .txt, .md
 */
export async function extractTextFromFile(
  buffer: Buffer,
  filename: string
): Promise<string> {
  const ext = filename.toLowerCase().split('.').pop();

  if (ext === 'pdf') {
    return extractFromPdf(buffer);
  }

  // For .txt, .md, and any other text formats
  return buffer.toString('utf-8');
}

async function extractFromPdf(buffer: Buffer): Promise<string> {
  // @ts-ignore
  const pdfParseModule = await import('pdf-parse');
  const pdfParse = (pdfParseModule as any).default || pdfParseModule;
  const data = await pdfParse(buffer);
  return data.text;
}

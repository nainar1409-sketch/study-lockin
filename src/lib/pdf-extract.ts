// Lightweight client-side PDF text extraction using pdfjs-dist.
// Loads the worker from a CDN-friendly mjs to avoid bundling the worker.
export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // @ts-expect-error vite handles the asset URL import
  const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const out: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((it: { str?: string }) => it.str ?? "").join(" ");
    out.push(text);
  }
  return out.join("\n\n").replace(/\s+/g, " ").trim();
}

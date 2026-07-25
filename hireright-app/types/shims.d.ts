// Type shim for the pdf-parse internal entrypoint we import directly
// (to avoid the package's debug harness that runs on the main export).
declare module "pdf-parse/lib/pdf-parse.js" {
  interface PdfParseResult {
    text: string;
    numpages: number;
    info: unknown;
  }
  function pdfParse(buffer: Buffer): Promise<PdfParseResult>;
  export default pdfParse;
}

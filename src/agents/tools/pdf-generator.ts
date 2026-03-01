/**
 * PDF Generator — ported from V3 tools/document/pdf.py + themes.py
 *
 * Uses Playwright (already available in V4 via browser-tool) to render
 * styled HTML to PDF with 7 CSS themes.
 */

import * as fs from "fs";
import * as path from "path";

export type PdfTheme =
  | "professional"
  | "academic"
  | "minimal"
  | "dark"
  | "cyberpunk"
  | "elegant"
  | "pastel";

// ─── Base CSS (from V3 themes.py BASE_CSS) ──────────────────────────────────
const BASE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 11pt; line-height: 1.7; color: #2d2d44; background: #ffffff;
  margin: 0; padding: 48pt 56pt; max-width: 100%;
}
h1 { font-size: 26pt; font-weight: 700; color: #0f0f23; border-bottom: 2.5px solid #3a86ff; padding-bottom: 8pt; margin: 24pt 0 14pt 0; }
h2 { font-size: 18pt; font-weight: 600; color: #1a1a3e; border-bottom: 1px solid #e0e0e0; padding-bottom: 6pt; margin: 20pt 0 12pt 0; }
h3 { font-size: 14pt; font-weight: 600; color: #2a2a52; margin: 16pt 0 8pt 0; }
h4 { font-size: 12pt; font-weight: 600; color: #3a3a66; margin: 14pt 0 6pt 0; }
p { margin: 0 0 10pt 0; }
a { color: #3a86ff; text-decoration: none; }
ul, ol { margin: 6pt 0 12pt 0; padding-left: 24pt; }
li { margin-bottom: 4pt; }
pre { background: #f4f6fc; padding: 14pt; border-radius: 8px; font-size: 9pt; overflow-x: auto; border: 1px solid #e8e8f0; }
code { font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 9.5pt; background: #f0f2fa; padding: 1pt 4pt; border-radius: 3px; color: #d63384; }
pre code { background: none; padding: 0; color: inherit; }
table { border-collapse: collapse; width: 100%; margin: 12pt 0; font-size: 10pt; }
thead { background: #2d2d44; color: #fff; }
th { padding: 8pt 12pt; text-align: left; font-weight: 600; border: 1px solid #2d2d44; }
td { padding: 7pt 12pt; border: 1px solid #e0e0e0; }
tbody tr:nth-child(even) { background: #f8f9fc; }
blockquote { border-left: 4px solid #3a86ff; margin: 10pt 0 14pt 0; padding: 8pt 16pt; background: #f0f4ff; color: #2d2d44; font-style: italic; }
blockquote p { margin: 0; }
img { max-width: 90%; height: auto; border-radius: 12px; margin: 18pt auto; display: block; box-shadow: 0 2px 12px rgba(0,0,0,0.10); }
.image-caption { text-align: center; font-size: 9pt; color: #666; font-style: italic; margin-top: 6pt; margin-bottom: 14pt; }
hr { border: none; border-top: 1.5px solid #e0e0e0; margin: 18pt 0; }
h1, h2, h3 { page-break-after: avoid; }
pre, table, blockquote, img { page-break-inside: avoid; }
.cover-page { display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 85vh; text-align: center; page-break-after: always; }
.cover-page h1 { font-size: 36pt; border: none; color: #0f0f23; margin-bottom: 16pt; }
.cover-page .subtitle { font-size: 14pt; color: #555; margin-bottom: 8pt; }
.cover-page .metadata { font-size: 10pt; color: #888; margin-top: 24pt; }
.section { margin-bottom: 20pt; }
.section + .section h2 { margin-top: 30pt; }
.document-footer { margin-top: 40pt; padding-top: 10pt; border-top: 1px solid #e0e0e0; font-size: 8pt; color: #999; text-align: center; }
`;

// ─── Theme Overrides (from V3 themes.py) ────────────────────────────────────
const THEME_OVERRIDES: Record<PdfTheme, string> = {
  professional: "", // Uses base CSS as-is
  academic: `
    body { font-family: 'Georgia', 'Times New Roman', serif; font-size: 12pt; line-height: 1.8; }
    h1 { font-size: 24pt; border-bottom: 2px solid #333; color: #111; }
    h2 { font-size: 18pt; border-bottom: 1px solid #666; color: #222; }
    p { text-indent: 20pt; }
    p:first-child, h1 + p, h2 + p, h3 + p { text-indent: 0; }
  `,
  minimal: `
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; }
    h1 { border-bottom: 1px solid #ddd; font-weight: 300; font-size: 28pt; }
    h2 { border-bottom: none; font-weight: 400; color: #555; }
    blockquote { border-left-color: #ccc; background: #fafafa; }
    thead { background: #f5f5f5; color: #333; }
    th { border-color: #ddd; }
  `,
  dark: `
    body { background: #1a1a2e; color: #e0e0e0; }
    h1 { color: #e0e0ff; border-bottom-color: #6c63ff; }
    h2 { color: #ccccee; border-bottom-color: #3a3a5c; }
    pre { background: #0d0d1a; color: #cdd6f4; }
    code { background: #2a2a44; color: #ff79c6; }
    thead { background: #2a2a44; color: #e0e0ff; }
    th { border-color: #3a3a5c; }
    td { border-color: #2a2a44; color: #d0d0e0; }
    tbody tr:nth-child(even) { background: #22223a; }
    blockquote { background: #22223a; border-left-color: #6c63ff; color: #c0c0d8; }
    .cover-page h1 { color: #e0e0ff; }
    .document-footer { color: #6666aa; border-top-color: #3a3a5c; }
  `,
  cyberpunk: `
    body { background: #0a0a14; color: #e0e0e8; font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace; }
    h1 { color: #00ffcc; border-bottom: 2px solid #ff00aa; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; }
    h2 { color: #ff00aa; border-bottom: 1px solid #00ffcc40; }
    pre { background: #050510; color: #00ffcc; border: 1px solid #00ffcc30; }
    code { background: #1a0a2e; color: #ff00aa; }
    thead { background: #1a0a2e; color: #00ffcc; }
    blockquote { background: #0d0d1a; border-left: 4px solid #ff00aa; }
    img { box-shadow: 0 0 20px rgba(0,255,204,0.15); }
    .cover-page h1 { color: #00ffcc; text-shadow: 0 0 30px rgba(0,255,204,0.3); }
    .cover-page .subtitle { color: #ff00aa; }
  `,
  elegant: `
    body { background: #faf8f4; color: #2c2420; font-family: 'Georgia', 'Palatino', serif; font-size: 11.5pt; line-height: 1.8; }
    h1 { color: #3a2010; border-bottom: 2px solid #c8a060; font-weight: 400; font-size: 28pt; }
    h2 { color: #4a3020; border-bottom: 1px solid #d4b880; font-weight: 400; }
    p { text-indent: 16pt; }
    p:first-child, h1 + p, h2 + p, h3 + p { text-indent: 0; }
    thead { background: #3a2010; color: #faf8f4; }
    blockquote { background: #f4f0e8; border-left: 4px solid #c8a060; color: #4a3828; }
    .cover-page h1 { color: #3a2010; }
  `,
  pastel: `
    body { background: #fef6ff; color: #3a2040; font-family: 'Avenir Next', 'Nunito', sans-serif; }
    h1 { color: #8a3a8a; border-bottom: 2.5px solid #e0a0d0; }
    h2 { color: #6a4a8a; border-bottom: 1.5px solid #e8c0e0; }
    pre { background: #f8eef8; color: #5a3060; border: 1px solid #e0c0e0; }
    code { background: #fce8fc; color: #aa40aa; }
    thead { background: #d8a0d0; color: #ffffff; }
    blockquote { background: #faf0fa; border-left: 4px solid #d0a0d0; }
    img { border-radius: 16px; box-shadow: 0 3px 14px rgba(160,80,160,0.12); }
    .cover-page h1 { color: #8a3a8a; }
  `,
};

/**
 * Builds full styled HTML from body content and theme.
 */
export function buildStyledHtml(
  bodyHtml: string,
  theme: PdfTheme = "professional",
  title = "Document",
  customCss = "",
): string {
  const themeOverride = THEME_OVERRIDES[theme] || "";
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    ${BASE_CSS}
    ${themeOverride}
    ${customCss}
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`;
}

/**
 * Detects if content is markdown (has markdown formatting characters).
 */
function looksLikeMarkdown(text: string): boolean {
  return /^#{1,6}\s|^\*\*|^- |\n\n|```/m.test(text);
}

export class PdfGenerator {
  /**
   * Generates a PDF from markdown/HTML content or a URL.
   * Uses Playwright (available via V4's browser-tool Chromium).
   */
  async generatePdf(params: {
    content: string;
    title?: string;
    theme?: PdfTheme;
    isUrl?: boolean;
    outputDir?: string;
  }): Promise<string> {
    const { content, title = "document", theme = "professional", isUrl = false } = params;
    const outputDir = params.outputDir || path.join(process.cwd(), "memory", "documents");

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filename = `${title.replace(/\s+/g, "_")}_${Date.now()}.pdf`;
    const outputPath = path.join(outputDir, filename);

    try {
      // Dynamic import — Playwright is an optional peer dependency
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pw = (await import("playwright" as string)) as any;
      const browser = await pw.chromium.launch({
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      const page = await browser.newPage();

      if (isUrl) {
        await page.goto(content, { waitUntil: "networkidle" });
      } else {
        // Convert markdown to simple HTML if needed
        let bodyHtml = content;
        if (looksLikeMarkdown(content)) {
          bodyHtml = simpleMarkdownToHtml(content);
        }
        const styledHtml = buildStyledHtml(bodyHtml, theme, title);
        await page.setContent(styledHtml, { waitUntil: "networkidle" });
        await page.waitForTimeout(1500); // Let fonts settle
      }

      await page.pdf({
        path: outputPath,
        format: "A4",
        printBackground: true,
        margin: { top: "0", bottom: "0", left: "0", right: "0" },
      });

      await browser.close();
      return `✅ PDF generated: ${outputPath}`;
    } catch (error) {
      // Fallback: write HTML file if Playwright is not available
      const bodyHtml = looksLikeMarkdown(content) ? simpleMarkdownToHtml(content) : content;
      const htmlPath = outputPath.replace(".pdf", ".html");
      fs.writeFileSync(htmlPath, buildStyledHtml(bodyHtml, theme, title));
      return `⚠️ Playwright not available. HTML saved to: ${htmlPath}. Error: ${error}`;
    }
  }
}

/**
 * Simple markdown → HTML converter (no external deps).
 */
function simpleMarkdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/```(\w*)\n([\s\S]*?)```/g, "<pre><code>$2</code></pre>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[hupol])/gm, "<p>")
    .replace(/$(?!<\/[hupol])/gm, "</p>");
}

export const documentGenerator = new PdfGenerator();

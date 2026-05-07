/**
 * GET /api/docs/api-docs-prompt
 * Downloads the API documentation prompt (Layer 2) as a .docx file.
 * This is the "how to use the APIs" document — describes each integration,
 * when to use it, authentication flow, and decision-making rules.
 */

import { NextResponse } from "next/server";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
} from "docx";
import { resolveCatalog } from "@/lib/catalog/resolve";
import { deriveThemes } from "@/lib/themes/registry";
import { generateSystemPrompt } from "@/lib/agent/system-prompt";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const cat = await resolveCatalog(request);
    const themes = deriveThemes(cat.swagger);
    const markdown = generateSystemPrompt(themes);

    const children = markdownToDocx(markdown);

    const doc = new Document({
      sections: [{ children }],
    });

    const buffer = await Packer.toBuffer(doc);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition":
          'attachment; filename="api-documentation-prompt.docx"',
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function markdownToDocx(md: string): Paragraph[] {
  const lines = md.split("\n");
  const paragraphs: Paragraph[] = [];

  for (const line of lines) {
    if (line.startsWith("## ")) {
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: line.slice(3).trim(), bold: true })],
        }),
      );
    } else if (line.startsWith("### ")) {
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: [new TextRun({ text: line.slice(4).trim(), bold: true })],
        }),
      );
    } else if (line.startsWith("- ")) {
      paragraphs.push(
        new Paragraph({
          children: parseInline(line.slice(2)),
          bullet: { level: 0 },
        }),
      );
    } else if (line.match(/^\d+\.\s/)) {
      const text = line.replace(/^\d+\.\s+/, "");
      paragraphs.push(
        new Paragraph({ children: parseInline(text) }),
      );
    } else if (line.trim() === "") {
      paragraphs.push(new Paragraph({}));
    } else {
      paragraphs.push(new Paragraph({ children: parseInline(line) }));
    }
  }

  return paragraphs;
}

function parseInline(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  for (const part of parts) {
    if (part.startsWith("**") && part.endsWith("**")) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true }));
    } else if (part.startsWith("`") && part.endsWith("`")) {
      runs.push(new TextRun({ text: part.slice(1, -1), font: "Courier New", size: 20 }));
    } else if (part) {
      runs.push(new TextRun({ text: part }));
    }
  }
  return runs;
}

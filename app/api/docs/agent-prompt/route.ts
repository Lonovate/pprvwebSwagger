/**
 * GET /api/docs/agent-prompt
 * Generates and downloads the concierge agent prompt as a .docx file.
 * This is the "first layer" prompt that tells the bot what the product does,
 * how to think, and where to find API info.
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
import { generateConciergePrompt } from "@/lib/agent/concierge-prompt";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const cat = await resolveCatalog(request);
    const themes = deriveThemes(cat.swagger);
    const markdown = generateConciergePrompt(themes);

    // Convert markdown to docx paragraphs
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
          'attachment; filename="agent-prompt.docx"',
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Simple markdown → docx converter for the structured prompt. */
function markdownToDocx(md: string): Paragraph[] {
  const lines = md.split("\n");
  const paragraphs: Paragraph[] = [];

  for (const line of lines) {
    // H2
    if (line.startsWith("## ")) {
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: line.slice(3).trim(), bold: true })],
        }),
      );
      continue;
    }

    // H3
    if (line.startsWith("### ")) {
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: [new TextRun({ text: line.slice(4).trim(), bold: true })],
        }),
      );
      continue;
    }

    // Table header / separator / row — render as plain text
    if (line.startsWith("|")) {
      if (line.includes("---")) continue; // skip separator
      const cells = line
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean);
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: cells.join("  |  "), font: "Calibri", size: 20 })],
        }),
      );
      continue;
    }

    // HTML comment — skip
    if (line.startsWith("<!--")) continue;

    // Bullet point
    if (line.startsWith("- ")) {
      const text = line.slice(2);
      paragraphs.push(
        new Paragraph({
          children: parseInlineFormatting(text),
          bullet: { level: 0 },
        }),
      );
      continue;
    }

    // Numbered item
    const numberedMatch = line.match(/^(\d+)\.\s+(.*)/);
    if (numberedMatch) {
      paragraphs.push(
        new Paragraph({
          children: parseInlineFormatting(numberedMatch[2]),
          numbering: { reference: "default-numbering", level: 0 },
        }),
      );
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      paragraphs.push(new Paragraph({}));
      continue;
    }

    // Normal paragraph
    paragraphs.push(
      new Paragraph({
        children: parseInlineFormatting(line),
      }),
    );
  }

  return paragraphs;
}

/** Parse **bold** and `code` inline formatting. */
function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = [];
  // Split on **bold** and `code` patterns
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

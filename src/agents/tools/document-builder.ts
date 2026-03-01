import * as fs from "fs";
import * as path from "path";

export interface DocumentSection {
  title: string;
  content: string;
  order: number;
}

export interface DocumentManifest {
  id: string;
  title: string;
  sections: DocumentSection[];
  completed: boolean;
}

export class MultiStepDocumentBuilder {
  private documents: Map<string, DocumentManifest>;
  private persistPath: string;

  constructor(persistPath: string = path.join(process.cwd(), "memory", "document_manifests.json")) {
    this.persistPath = persistPath;
    this.documents = new Map();
    this.loadFromDisk();
  }

  // Load/Save omitted for brevity

  private loadFromDisk() {
    /* load implementation */
  }
  private saveToDisk() {
    /* save implementation */
  }

  public startDocument(title: string): string {
    const id = `doc_${Date.now()}`;
    this.documents.set(id, { id, title, sections: [], completed: false });
    this.saveToDisk();
    return id;
  }

  public addSection(docId: string, sectionTitle: string, content: string): string {
    const doc = this.documents.get(docId);
    if (!doc) return "Error: Document not found.";
    if (doc.completed) return "Error: Document is already finalized.";

    doc.sections.push({ title: sectionTitle, content, order: doc.sections.length });
    this.saveToDisk();
    return `Added section '${sectionTitle}' (Section ${doc.sections.length}).`;
  }

  public editSection(docId: string, index: number, newContent: string): string {
    const doc = this.documents.get(docId);
    if (!doc) return "Error: Document not found.";
    if (index < 0 || index >= doc.sections.length) return "Error: Section index out of bounds.";

    doc.sections[index].content = newContent;
    this.saveToDisk();
    return `Edited section ${index}.`;
  }

  public renderDocument(docId: string): string {
    const doc = this.documents.get(docId);
    if (!doc) return "Error: Document not found.";

    doc.completed = true;
    doc.sections.sort((a, b) => a.order - b.order);

    let md = `# ${doc.title}\\n\\n`;
    for (const section of doc.sections) {
      if (section.title) md += `## ${section.title}\\n\\n`;
      md += `${section.content}\\n\\n`;
    }

    this.saveToDisk();
    return md;
  }
}

export const documentBuilder = new MultiStepDocumentBuilder();

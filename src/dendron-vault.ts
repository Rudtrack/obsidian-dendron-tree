import { App, TAbstractFile, TFile, TFolder } from "obsidian";
import { NoteMetadata, NoteTree, generateNoteTitle, getNoteTemplate, isUseTitleCase } from "./note";
import { InvalidRootModal } from "./modal/invalid-root";
import { getFolderFile } from "./utils";
import { ParsedPath } from "./path";

export class DendronVault {
  folder: TFolder;
  tree: NoteTree;
  isIniatialized = false;

  constructor(public app: App, public path: string) {}

  private resolveMetadata(file: TFile): NoteMetadata | undefined {
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
    if (!frontmatter) return undefined;
    return {
      title: frontmatter["title"],
    };
  }

  get formattedPath() {
    return this.path === "" ? "/" : this.path;
  }

  init() {
    if (this.isIniatialized) return;

    this.tree = new NoteTree();

    const root = getFolderFile(this.app.vault, this.path);
    if (!(root instanceof TFolder)) {
      new InvalidRootModal(this).open();
      return;
    }

    this.folder = root;

    for (const child of root.children)
      if (child instanceof TFile && this.isNote(child.extension))
        this.tree.addFile(child).syncMetadata(this.resolveMetadata(child));

    this.tree.sort();
    this.isIniatialized = true;
  }

  async createRootFolder() {
    return await this.app.vault.createFolder(this.path);
  }

  async createNote(baseName: string) {
    const filePath = `${this.path}/${baseName}.md`;
    const notePath = NoteTree.getPathFromFileName(baseName);
    const title = generateNoteTitle(notePath[notePath.length - 1], isUseTitleCase(baseName));
    const template = getNoteTemplate(title);
    return await this.app.vault.create(filePath, template);
  }

  isNote(extension: string) {
    return extension === "md";
  }

  onFileCreated(file: TAbstractFile): boolean {
    if (!(file instanceof TFile) || !this.isNote(file.extension)) return false;

    this.tree.addFile(file, true).syncMetadata(this.resolveMetadata(file));
    return true;
  }

  onMetadataChanged(file: TFile): boolean {
    if (!this.isNote(file.extension)) return false;

    const note = this.tree.getFromFileName(file.basename);
    if (!note) return false;

    note.syncMetadata(this.resolveMetadata(file));
    return true;
  }

  onFileDeleted(parsed: ParsedPath): boolean {
    if (!this.isNote(parsed.extension)) return false;

    const note = this.tree.deleteByFileName(parsed.basename);
    if (note?.parent) {
      note.syncMetadata(undefined);
    }
    return true;
  }
}

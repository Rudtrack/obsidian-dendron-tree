import { MetadataCache, TFile } from "obsidian";

export class Note {
  name: string;
  children: Note[] = [];
  file?: TFile;
  parent?: Note;
  title = "";

  constructor(name: string) {
    this.name = name.toLowerCase();
    this.title = generateNoteTitle(this.name);
  }

  appendChild(note: Note) {
    if (note.parent) throw Error("Note has parent");
    note.parent = this;
    this.children.push(note);
  }

  removeChildren(note: Note) {
    note.parent = undefined;
    const index = this.children.indexOf(note);
    this.children.splice(index, 1);
  }

  findChildren(name: string) {
    const lower = name.toLowerCase();
    return this.children.find((note) => note.name == lower);
  }

  sortChildren(rescursive: boolean) {
    this.children.sort((a, b) => a.name.localeCompare(b.name));
    if (rescursive) this.children.forEach((child) => child.sortChildren(rescursive));
  }

  getPath() {
    const component: string[] = [];

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let current: Note | undefined = this;
    while (current && current.name !== "root") {
      component.unshift(current.name);
      current = current.parent;
    }

    if (component.length == 0) component.push("root");

    return component.join(".");
  }

  syncMetadata(metadataCache: MetadataCache) {
    if (!this.file) return;
    const cache = metadataCache.getFileCache(this.file);
    this.title = cache?.frontmatter?.["title"] ?? generateNoteTitle(this.name);
  }
}

export function generateNoteTitle(path: string) {
  return path
    .substring(path.lastIndexOf(".") + 1)
    .split("-")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((word) => {
      return word[0].toUpperCase() + word.substring(1).toLowerCase();
    })
    .join(" ");
}

export function getNoteTemplate(title: string) {
  const time = new Date().getTime();
  return `---
title: "${title}"
updated: ${time}
created: ${time}
---

`;
}

export class NoteTree {
  root: Note = new Note("root");

  sort() {
    this.root.sortChildren(true);
  }

  private static getPathFromFileName(name: string) {
    return name.split(".");
  }

  private static isRootPath(path: string[]) {
    return path.length === 1 && path[0] === "root";
  }

  addFile(file: TFile, metadataCache: MetadataCache, sort: boolean) {
    const path = NoteTree.getPathFromFileName(file.basename);

    let currentNote: Note = this.root;

    if (!NoteTree.isRootPath(path))
      while (path.length > 0) {
        const name = path.shift()!;
        let note: Note | undefined = currentNote.findChildren(name);

        if (!note) {
          note = new Note(name);
          currentNote.appendChild(note);
          if (sort) currentNote.sortChildren(false);
        }

        currentNote = note;
      }

    currentNote.file = file;
    currentNote.syncMetadata(metadataCache);
  }

  getFromFileName(name: string) {
    const path = NoteTree.getPathFromFileName(name);

    if (NoteTree.isRootPath(path)) return this.root;

    let currentNote: Note = this.root;

    while (path.length > 0) {
      const name = path.shift()!;
      const found = currentNote.findChildren(name);
      if (!found) return undefined;
      currentNote = found;
    }

    return currentNote;
  }

  deleteByFileName(name: string) {
    const note = this.getFromFileName(name);
    if (!note) return;

    note.file = undefined;
    if (note.children.length == 0) {
      let currentNote: Note | undefined = note;
      while (
        currentNote &&
        currentNote.parent &&
        !currentNote.file &&
        currentNote.children.length == 0
      ) {
        const parent: Note | undefined = currentNote.parent;
        parent.removeChildren(currentNote);
        currentNote = parent;
      }
    }
  }

  updateMetadata(file: TFile, metadataCache: MetadataCache) {
    const note = this.getFromFileName(file.basename);
    if (!note) return;
    note.syncMetadata(metadataCache);
  }

  private static *flattenInternal(root: Note): Generator<Note> {
    yield root;
    for (const child of root.children) yield* this.flattenInternal(child);
  }

  flatten() {
    return Array.from(NoteTree.flattenInternal(this.root));
  }
}

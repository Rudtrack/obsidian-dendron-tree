import { MetadataCache, TFile } from "obsidian";

export interface Note {
  name: string;
  children: Note[];
  file?: TFile;
  parent?: Note;
  title: string;
}

function getPathFromFileName(name: string) {
  return name.split(".");
}

function isRootPath(path: string[]) {
  return path.length === 1 && path[0] === "root";
}

function sortNote(note: Note, rescursive: boolean) {
  note.children.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  if (rescursive) note.children.forEach((child) => sortNote(child, rescursive));
}

function removeBlankNote(startNote: Note) {
  let note: Note | undefined = startNote;
  while (note && note.parent && !note.file && note.children.length == 0) {
    const index = note.parent.children.indexOf(note);
    note.parent.children.splice(index, 1);
    note = note.parent;
  }
}

function* flattenNote(root: Note): Generator<Note> {
  yield root;
  for (const child of root.children) yield* flattenNote(child);
}

function syncNoteMetadata(note: Note, metadataCache: MetadataCache) {
  if (!note.file) return;
  const cache = metadataCache.getFileCache(note.file);
  note.title = cache?.frontmatter?.["title"] ?? generateNoteTitle(note.name);
}

export function getNotePath(note: Note) {
  const component: string[] = [];

  let current: Note | undefined = note;
  while (current && current.name !== "root") {
    component.unshift(current.name);
    current = current.parent;
  }

  if (component.length == 0) component.push("root");

  return component.join(".");
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
  root: Note = {
    name: "root",
    children: [],
    title: "Root",
  };

  sort() {
    sortNote(this.root, true);
  }

  addFile(file: TFile, metadataCache: MetadataCache, sort: boolean) {
    const path = getPathFromFileName(file.basename);

    let currentNote: Note = this.root;

    if (!isRootPath(path))
      while (path.length > 0) {
        const name = path.shift()!;
        let note: Note | undefined = currentNote.children.find((note) => note.name == name);

        if (!note) {
          note = {
            name,
            children: [],
            parent: currentNote,
            title: generateNoteTitle(name),
          };
          currentNote.children.push(note);
          if (sort) sortNote(currentNote, false);
        }

        currentNote = note;
      }

    currentNote.file = file;
    syncNoteMetadata(currentNote, metadataCache);
  }

  getFromFileName(name: string) {
    const path = getPathFromFileName(name);

    if (isRootPath(path)) return this.root;

    let currentNote: Note | undefined = this.root;

    while (path.length > 0) {
      const name = path.shift()!;
      currentNote = currentNote?.children.find((note) => note.name == name);
    }

    return currentNote;
  }

  deleteByFileName(name: string) {
    const note = this.getFromFileName(name);
    if (!note) return;

    note.file = undefined;
    if (note.children.length == 0) {
      removeBlankNote(note);
    }
  }

  updateMetadata(file: TFile, metadataCache: MetadataCache) {
    const note = this.getFromFileName(file.basename);
    if (!note) return;
    syncNoteMetadata(note, metadataCache);
  }

  flatten() {
    return Array.from(flattenNote(this.root));
  }
}

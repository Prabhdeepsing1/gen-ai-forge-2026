import { useCallback, useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { MathInline, MathDisplay } from "./latex-extension";
import { EditorToolbar } from "./EditorToolbar";
import "katex/dist/katex.min.css";

interface WordEditorProps {
  workspaceId: number;
  workspaceName?: string;
}

export interface WordEditorHandle {
  getEditor: () => Editor | null;
  insertContentAtCursor: (html: string) => void;
}

const STORAGE_KEY_PREFIX = "researchhub-editor-";

function getStorageKey(workspaceId: number) {
  return `${STORAGE_KEY_PREFIX}${workspaceId}`;
}

function getDocTitleKey(workspaceId: number) {
  return `${STORAGE_KEY_PREFIX}title-${workspaceId}`;
}

const DEFAULT_CONTENT = `<h1>Untitled Document</h1><p>Start writing your research paper here...</p>`;

export const WordEditor = forwardRef<WordEditorHandle, WordEditorProps>(
  function WordEditor({ workspaceId, workspaceName }, ref) {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Load saved content
  const savedContent = localStorage.getItem(getStorageKey(workspaceId)) || DEFAULT_CONTENT;
  const savedTitle = localStorage.getItem(getDocTitleKey(workspaceId)) || `${workspaceName ?? "Workspace"} — Draft`;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
      }),
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({
        placeholder: "Start writing your research paper…",
      }),
      TextStyle,
      Color,
      Image.configure({ inline: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      TaskList,
      TaskItem.configure({ nested: true }),
      Subscript,
      Superscript,
      MathInline,
      MathDisplay,
    ],
    content: savedContent,
    editorProps: {
      attributes: {
        class:
          "prose prose-invert prose-sm sm:prose-base max-w-none focus:outline-none min-h-[500px] px-8 py-6",
      },
    },
    onUpdate: ({ editor }) => {
      // Debounced auto-save
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        localStorage.setItem(getStorageKey(workspaceId), editor.getHTML());
      }, 500);
    },
  });

  // Expose editor instance to parent via ref
  useImperativeHandle(ref, () => ({
    getEditor: () => editor,
    insertContentAtCursor: (html: string) => {
      if (!editor) return;
      editor.chain().focus().insertContent(html).run();
      // Trigger auto-save after insertion
      localStorage.setItem(getStorageKey(workspaceId), editor.getHTML());
    },
  }), [editor, workspaceId]);

  // Save title to localStorage
  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      localStorage.setItem(getDocTitleKey(workspaceId), e.target.value);
    },
    [workspaceId]
  );

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Export as HTML file
  const handleExportHTML = useCallback(() => {
    if (!editor) return;
    const title = titleInputRef.current?.value || "document";
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: 'Georgia', 'Times New Roman', serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.8; color: #1a1a1a; }
    h1 { font-size: 2em; margin-bottom: 0.5em; }
    h2 { font-size: 1.5em; margin-top: 1.5em; }
    h3 { font-size: 1.25em; margin-top: 1.2em; }
    blockquote { border-left: 3px solid #ccc; padding-left: 1em; margin-left: 0; color: #555; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
    pre { background: #f4f4f4; padding: 16px; border-radius: 6px; overflow-x: auto; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    th { background: #f8f8f8; font-weight: bold; }
    img { max-width: 100%; height: auto; }
    mark { background: #fef08a; padding: 0 2px; }
    ul[data-type="taskList"] { list-style: none; padding-left: 0; }
    ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 8px; }
    .math-display-node { text-align: center; margin: 1em 0; }
  </style>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.css">
</head>
<body>
${editor.getHTML()}
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-zA-Z0-9-_ ]/g, "")}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, [editor]);

  // Import HTML file
  const handleImportHTML = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".html,.htm,.txt";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !editor) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        // Extract body content if full HTML
        const match = content.match(/<body[^>]*>([\s\S]*)<\/body>/i);
        editor.commands.setContent(match ? match[1] : content);
        localStorage.setItem(getStorageKey(workspaceId), editor.getHTML());
      };
      reader.readAsText(file);
    };
    input.click();
  }, [editor, workspaceId]);

  // Word & character count
  const wordCount = editor
    ? editor.state.doc.textContent
        .trim()
        .split(/\s+/)
        .filter(Boolean).length
    : 0;
  const charCount = editor ? editor.state.doc.textContent.length : 0;

  return (
    <div className="flex flex-col h-full bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden">
      {/* Title bar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-zinc-900/60 border-b border-zinc-800">
        <input
          ref={titleInputRef}
          type="text"
          defaultValue={savedTitle}
          onChange={handleTitleChange}
          className="flex-1 bg-transparent text-sm font-semibold text-zinc-200 outline-none placeholder-zinc-600"
          placeholder="Document title…"
        />
        <span className="text-[11px] text-zinc-600 tabular-nums whitespace-nowrap">
          {wordCount} words · {charCount} chars
        </span>
        <span className="text-[10px] text-emerald-500/70 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
          Auto-saved
        </span>
      </div>

      {/* Toolbar */}
      <EditorToolbar
        editor={editor}
        onExportHTML={handleExportHTML}
        onImportHTML={handleImportHTML}
      />

      {/* Editor area */}
      <div className="flex-1 overflow-y-auto editor-scroll">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
});

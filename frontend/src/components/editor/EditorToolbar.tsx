import type { Editor } from "@tiptap/react";
import {
  HiOutlineCode,
} from "react-icons/hi";
import {
  LuBold,
  LuItalic,
  LuUnderline,
  LuStrikethrough,
  LuHighlighter,
  LuHeading1,
  LuHeading2,
  LuHeading3,
  LuList,
  LuListOrdered,
  LuListChecks,
  LuAlignLeft,
  LuAlignCenter,
  LuAlignRight,
  LuAlignJustify,
  LuQuote,
  LuMinus,
  LuUndo2,
  LuRedo2,
  LuSubscript,
  LuSuperscript,
  LuImage,
  LuTable,
  LuDownload,
  LuUpload,
  LuSigma,
} from "react-icons/lu";

interface ToolbarProps {
  editor: Editor | null;
  onExportHTML?: () => void;
  onImportHTML?: () => void;
}

interface ToolbarBtnProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarBtn({ onClick, isActive, disabled, title, children }: ToolbarBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded-md transition-colors text-xs ${
        isActive
          ? "bg-indigo-500/20 text-indigo-300"
          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50"
      } disabled:opacity-30 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}

function ToolbarSep() {
  return <div className="w-px h-5 bg-zinc-700 mx-0.5" />;
}

export function EditorToolbar({ editor, onExportHTML, onImportHTML }: ToolbarProps) {
  if (!editor) return null;

  const addImage = () => {
    const url = window.prompt("Image URL:");
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const addTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  const addInlineMath = () => {
    const latex = window.prompt("Inline LaTeX (e.g. E = mc^2):");
    if (latex !== null) {
      (editor.commands as any).insertMathInline(latex);
    }
  };

  const addDisplayMath = () => {
    const latex = window.prompt("Display LaTeX (e.g. \\int_0^\\infty e^{-x} dx = 1):");
    if (latex !== null) {
      (editor.commands as any).insertMathDisplay(latex);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-zinc-700 bg-zinc-900/80">
      {/* Undo / Redo */}
      <ToolbarBtn
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo"
      >
        <LuUndo2 size={14} />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo"
      >
        <LuRedo2 size={14} />
      </ToolbarBtn>

      <ToolbarSep />

      {/* Text formatting */}
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
        title="Bold (Ctrl+B)"
      >
        <LuBold size={14} />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
        title="Italic (Ctrl+I)"
      >
        <LuItalic size={14} />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive("underline")}
        title="Underline (Ctrl+U)"
      >
        <LuUnderline size={14} />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive("strike")}
        title="Strikethrough"
      >
        <LuStrikethrough size={14} />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        isActive={editor.isActive("highlight")}
        title="Highlight"
      >
        <LuHighlighter size={14} />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleSubscript().run()}
        isActive={editor.isActive("subscript")}
        title="Subscript"
      >
        <LuSubscript size={14} />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleSuperscript().run()}
        isActive={editor.isActive("superscript")}
        title="Superscript"
      >
        <LuSuperscript size={14} />
      </ToolbarBtn>

      <ToolbarSep />

      {/* Headings */}
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive("heading", { level: 1 })}
        title="Heading 1"
      >
        <LuHeading1 size={14} />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive("heading", { level: 2 })}
        title="Heading 2"
      >
        <LuHeading2 size={14} />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive("heading", { level: 3 })}
        title="Heading 3"
      >
        <LuHeading3 size={14} />
      </ToolbarBtn>

      <ToolbarSep />

      {/* Lists */}
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive("bulletList")}
        title="Bullet List"
      >
        <LuList size={14} />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive("orderedList")}
        title="Ordered List"
      >
        <LuListOrdered size={14} />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        isActive={editor.isActive("taskList")}
        title="Task List"
      >
        <LuListChecks size={14} />
      </ToolbarBtn>

      <ToolbarSep />

      {/* Alignment */}
      <ToolbarBtn
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        isActive={editor.isActive({ textAlign: "left" })}
        title="Align Left"
      >
        <LuAlignLeft size={14} />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        isActive={editor.isActive({ textAlign: "center" })}
        title="Align Center"
      >
        <LuAlignCenter size={14} />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        isActive={editor.isActive({ textAlign: "right" })}
        title="Align Right"
      >
        <LuAlignRight size={14} />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().setTextAlign("justify").run()}
        isActive={editor.isActive({ textAlign: "justify" })}
        title="Justify"
      >
        <LuAlignJustify size={14} />
      </ToolbarBtn>

      <ToolbarSep />

      {/* Block elements */}
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive("blockquote")}
        title="Blockquote"
      >
        <LuQuote size={14} />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        isActive={editor.isActive("codeBlock")}
        title="Code Block"
      >
        <HiOutlineCode size={14} />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Horizontal Rule"
      >
        <LuMinus size={14} />
      </ToolbarBtn>

      <ToolbarSep />

      {/* Insert */}
      <ToolbarBtn onClick={addImage} title="Insert Image">
        <LuImage size={14} />
      </ToolbarBtn>
      <ToolbarBtn onClick={addTable} title="Insert Table">
        <LuTable size={14} />
      </ToolbarBtn>

      <ToolbarSep />

      {/* LaTeX */}
      <ToolbarBtn onClick={addInlineMath} title="Insert Inline Math ($…$)">
        <LuSigma size={14} />
      </ToolbarBtn>
      <ToolbarBtn onClick={addDisplayMath} title="Insert Display Math ($$…$$)">
        <span className="text-[10px] font-mono font-bold leading-none">$$</span>
      </ToolbarBtn>

      <ToolbarSep />

      {/* Import/Export */}
      {onImportHTML && (
        <ToolbarBtn onClick={onImportHTML} title="Import HTML">
          <LuUpload size={14} />
        </ToolbarBtn>
      )}
      {onExportHTML && (
        <ToolbarBtn onClick={onExportHTML} title="Export as HTML">
          <LuDownload size={14} />
        </ToolbarBtn>
      )}
    </div>
  );
}

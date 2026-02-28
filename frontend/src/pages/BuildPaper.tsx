import { useState, useRef, useCallback, useEffect } from "react";
import type { Paper } from "@/types";
import { Spinner } from "@/components/Spinner";
import { useEditor, EditorContent } from "@tiptap/react";
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
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { useBuildPaper, ALL_SECTIONS } from "@/contexts/BuildPaperContext";
import "katex/dist/katex.min.css";
import {
  HiOutlineSearch,
  HiOutlineChevronDown,
  HiOutlinePlus,
  HiOutlineCheck,
  HiOutlineDocumentText,
  HiOutlineSparkles,
  HiOutlineArrowRight,
  HiOutlinePencilAlt,
  HiOutlineDownload,
} from "react-icons/hi";

/* ── Paper Selection Card ────────────────────────────────────────────────── */

function SelectablePaperCard({
  paper,
  selected,
  onToggle,
}: {
  paper: Paper;
  selected: boolean;
  onToggle: () => void;
}) {
  const [showAbstract, setShowAbstract] = useState(false);

  return (
    <div
      className={`p-4 rounded-xl border transition-all duration-200 ${
        selected
          ? "border-primary bg-primary/5 shadow-sm shadow-primary/10"
          : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-600"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-zinc-100 leading-snug">
            {paper.title}
          </h3>
          <p className="text-xs text-zinc-500 mt-1">
            {paper.authors?.slice(0, 3).join(", ")}
            {(paper.authors?.length ?? 0) > 3 && " et al."}
            {paper.published && (
              <span className="ml-2 text-zinc-600">· {paper.published}</span>
            )}
          </p>
        </div>
        <button
          onClick={onToggle}
          className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
            selected
              ? "bg-primary text-primary-foreground"
              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
          }`}
        >
          {selected ? (
            <HiOutlineCheck className="w-4 h-4" />
          ) : (
            <HiOutlinePlus className="w-4 h-4" />
          )}
        </button>
      </div>

      {paper.abstract && (
        <>
          <button
            onClick={() => setShowAbstract(!showAbstract)}
            className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 mt-2 transition-colors"
          >
            <HiOutlineChevronDown
              className={`w-3 h-3 transition-transform duration-200 ${
                showAbstract ? "rotate-180" : ""
              }`}
            />
            Abstract
          </button>
          <div
            className={`overflow-hidden transition-all duration-300 ${
              showAbstract ? "max-h-48 mt-1.5" : "max-h-0"
            }`}
          >
            <p className="text-xs text-zinc-400 leading-relaxed overflow-y-auto max-h-44 pr-1">
              {paper.abstract}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Section Progress Bar ────────────────────────────────────────────────── */

function SectionProgress({
  currentSection,
  completedSections,
}: {
  currentSection: string | null;
  completedSections: Set<string>;
}) {
  const isPrePhase = (s: string) =>
    s === "Planning" || s === "Reasoning & Analysis";

  return (
    <div className="space-y-1.5">
      {ALL_SECTIONS.map((section, idx) => {
        const isCompleted = completedSections.has(section);
        const isCurrent = section === currentSection;
        const isPhase = isPrePhase(section);

        // Divider between pre-phases and writing phases
        const showDivider = idx === 2;

        return (
          <div key={section}>
            {showDivider && (
              <div className="flex items-center gap-2 py-2">
                <div className="h-px flex-1 bg-zinc-800" />
                <span className="text-[10px] text-zinc-600 uppercase tracking-wider">
                  Writing
                </span>
                <div className="h-px flex-1 bg-zinc-800" />
              </div>
            )}
            <div className="flex items-center gap-3 py-1">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                  isCompleted
                    ? isPhase
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-emerald-500/20 text-emerald-400"
                    : isCurrent
                    ? isPhase
                      ? "bg-amber-500/20 text-amber-400 animate-pulse"
                      : "bg-primary/20 text-primary animate-pulse"
                    : "bg-zinc-800 text-zinc-600"
                }`}
              >
                {isCompleted ? (
                  <HiOutlineCheck className="w-3.5 h-3.5" />
                ) : isCurrent ? (
                  <Spinner className="w-3.5 h-3.5" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span
                  className={`text-sm transition-colors duration-200 ${
                    isCompleted
                      ? isPhase
                        ? "text-amber-400 font-medium"
                        : "text-emerald-400 font-medium"
                      : isCurrent
                      ? isPhase
                        ? "text-amber-400 font-medium"
                        : "text-primary font-medium"
                      : "text-zinc-600"
                  }`}
                >
                  {section}
                </span>
                {isCurrent && isPhase && (
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    {section === "Planning"
                      ? "Creating detailed paper outline…"
                      : "Analyzing themes, gaps & connections…"}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────────────────────── */

export default function BuildPaper() {
  const {
    step,
    setStep,
    topic,
    setTopic,
    refining,
    refinedQuery,
    searching,
    searchResults,
    selectedPapers,
    togglePaper,
    currentSection,
    completedSections,
    generatedHTML,
    planText,
    reasoningText,
    handleSearchTopic,
    handleGenerate,
    handleReset,
  } = useBuildPaper();

  // Step 4 — Result editor (local to page)
  const editorTitleRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({ placeholder: "Your generated paper will appear here…" }),
      TextStyle,
      Color,
      Image.configure({ inline: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Subscript,
      Superscript,
    ],
    content: "",
    editorProps: {
      attributes: {
        class: "prose prose-invert prose-sm sm:prose-base max-w-none focus:outline-none min-h-[500px] px-8 py-6",
      },
    },
  });

  // ── Sync generated HTML into editor when result step is reached ─────────

  useEffect(() => {
    if (step === "result" && editor && generatedHTML) {
      editor.commands.setContent(generatedHTML);
    }
  }, [step, editor, generatedHTML]);

  /** Export HTML */
  const handleExport = useCallback(() => {
    if (!editor) return;
    const title = editorTitleRef.current?.value || "Generated Research Paper";
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
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    th { background: #f8f8f8; font-weight: bold; }
  </style>
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

  /** Reset and start over (also clears the editor) */
  const handleResetAll = () => {
    handleReset();
    editor?.commands.setContent("");
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto fade-in">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center">
            <HiOutlineSparkles className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Build Paper</h1>
        </div>
        <p className="text-sm text-muted-foreground ml-12">
          Generate a complete research paper from arXiv sources — powered by AI
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {[
          { key: "topic", label: "1. Topic", icon: HiOutlinePencilAlt },
          { key: "papers", label: "2. Select Papers", icon: HiOutlineDocumentText },
          { key: "generating", label: "3. Generating", icon: HiOutlineSparkles },
          { key: "result", label: "4. Paper Ready", icon: HiOutlineCheck },
        ].map((s, i) => {
          const isCurrent = step === s.key;
          const isPast =
            ["topic", "papers", "generating", "result"].indexOf(step) >
            ["topic", "papers", "generating", "result"].indexOf(s.key);

          return (
            <div key={s.key} className="flex items-center gap-2">
              {i > 0 && (
                <div
                  className={`w-8 h-px ${
                    isPast ? "bg-primary" : "bg-zinc-800"
                  }`}
                />
              )}
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  isCurrent
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : isPast
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-zinc-900 text-zinc-600 border border-zinc-800"
                }`}
              >
                <s.icon className="w-3.5 h-3.5" />
                {s.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Step 1: Topic input ──────────────────────────────────────────── */}
      {step === "topic" && (
        <div className="space-y-6 fade-in-up">
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-8">
            <h2 className="text-lg font-semibold text-zinc-100 mb-2">
              What do you want to research?
            </h2>
            <p className="text-sm text-zinc-500 mb-6">
              Describe your research topic or idea. The AI will translate it
              into an optimized search query to find relevant papers on arXiv.
            </p>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., How transformers are used in medical image segmentation and their comparison with CNNs..."
              rows={4}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 resize-none transition-all"
            />
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-zinc-600">
                Be as specific or general as you like — the AI handles the rest
              </p>
              <button
                onClick={handleSearchTopic}
                disabled={!topic.trim() || refining || searching}
                className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-50"
              >
                {refining ? (
                  <>
                    <Spinner className="w-4 h-4" />
                    Refining query…
                  </>
                ) : searching ? (
                  <>
                    <Spinner className="w-4 h-4" />
                    Searching arXiv…
                  </>
                ) : (
                  <>
                    <HiOutlineSearch className="w-4 h-4" />
                    Find Papers
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 2: Paper selection ──────────────────────────────────────── */}
      {step === "papers" && (
        <div className="space-y-6 fade-in-up">
          {/* Refined query info */}
          <div className="bg-primary/5 border border-primary/10 rounded-xl px-4 py-3 flex items-center gap-3">
            <HiOutlineSearch className="w-4 h-4 text-primary flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-zinc-500">
                AI-refined search query
              </p>
              <p className="text-sm text-zinc-200 font-medium truncate">
                {refinedQuery}
              </p>
            </div>
            <button
              onClick={() => setStep("topic")}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              ← Change topic
            </button>
          </div>

          {/* Selection summary bar */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-400">
              {searchResults.length} papers found —{" "}
              <span className="text-primary font-medium">
                {selectedPapers.size} selected
              </span>
            </p>
            <button
              onClick={handleGenerate}
              disabled={selectedPapers.size === 0}
              className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-50"
            >
              <HiOutlineSparkles className="w-4 h-4" />
              Generate Paper
              <HiOutlineArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Paper list */}
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {searchResults.map((paper, i) => (
              <SelectablePaperCard
                key={i}
                paper={paper}
                selected={selectedPapers.has(i)}
                onToggle={() => togglePaper(i)}
              />
            ))}
          </div>

          {/* Bottom generate button */}
          {selectedPapers.size > 0 && (
            <div className="sticky bottom-0 bg-gradient-to-t from-background via-background to-transparent pt-6 pb-2">
              <button
                onClick={handleGenerate}
                className="w-full btn-primary flex items-center justify-center gap-2 py-3 text-sm font-medium"
              >
                <HiOutlineSparkles className="w-4 h-4" />
                Generate Paper from {selectedPapers.size} paper
                {selectedPapers.size > 1 ? "s" : ""}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Step 3: Generating ───────────────────────────────────────────── */}
      {step === "generating" && (
        <div className="flex items-start gap-6 fade-in-up">
          {/* Progress panel */}
          <div className="w-72 flex-shrink-0">
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 sticky top-24">
              <h3 className="text-sm font-semibold text-zinc-200 mb-4 flex items-center gap-2">
                <HiOutlineSparkles className="w-4 h-4 text-primary" />
                Building paper…
              </h3>
              <SectionProgress
                currentSection={currentSection}
                completedSections={completedSections}
              />
              <div className="mt-6 pt-4 border-t border-zinc-800">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 via-primary to-violet-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${
                          ((completedSections.size +
                            (currentSection ? 0.5 : 0)) /
                            ALL_SECTIONS.length) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-zinc-500 tabular-nums">
                    {Math.round(
                      ((completedSections.size +
                        (currentSection ? 0.5 : 0)) /
                        ALL_SECTIONS.length) *
                        100
                    )}
                    %
                  </span>
                </div>
                <p className="text-[10px] text-zinc-600 mt-2 text-center">
                  {completedSections.size <= 1 && "Agent is thinking & planning…"}
                  {completedSections.size === 2 && "Writing sections — this may take a few minutes"}
                  {completedSections.size > 2 && completedSections.size < ALL_SECTIONS.length && "Writing in progress…"}
                  {completedSections.size === ALL_SECTIONS.length && "Almost done!"}
                </p>
              </div>
            </div>

            {/* Planning/Reasoning collapsible panels */}
            {(planText || reasoningText) && (
              <div className="mt-4 space-y-3">
                {planText && (
                  <details className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden group">
                    <summary className="px-4 py-2.5 cursor-pointer text-xs font-medium text-amber-400 hover:bg-zinc-800/50 transition-colors flex items-center gap-2">
                      <HiOutlineCheck className="w-3.5 h-3.5" />
                      Paper Outline
                      <HiOutlineChevronDown className="w-3 h-3 ml-auto group-open:rotate-180 transition-transform" />
                    </summary>
                    <div className="px-4 py-3 border-t border-zinc-800 max-h-48 overflow-y-auto">
                      <pre className="text-[11px] text-zinc-400 whitespace-pre-wrap font-mono leading-relaxed">
                        {planText}
                      </pre>
                    </div>
                  </details>
                )}
                {reasoningText && (
                  <details className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden group">
                    <summary className="px-4 py-2.5 cursor-pointer text-xs font-medium text-amber-400 hover:bg-zinc-800/50 transition-colors flex items-center gap-2">
                      <HiOutlineCheck className="w-3.5 h-3.5" />
                      Analysis Notes
                      <HiOutlineChevronDown className="w-3 h-3 ml-auto group-open:rotate-180 transition-transform" />
                    </summary>
                    <div className="px-4 py-3 border-t border-zinc-800 max-h-48 overflow-y-auto">
                      <pre className="text-[11px] text-zinc-400 whitespace-pre-wrap font-mono leading-relaxed">
                        {reasoningText}
                      </pre>
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>

          {/* Live preview */}
          <div className="flex-1 min-w-0">
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-xs text-zinc-400">
                  {!generatedHTML
                    ? currentSection === "Planning" || currentSection === "Reasoning & Analysis"
                      ? `Agent is ${currentSection?.toLowerCase()}…`
                      : "Preparing content…"
                    : "Live preview — paper being written"}
                </span>
              </div>
              <div className="p-6 max-h-[60vh] overflow-y-auto">
                {generatedHTML ? (
                  <div
                    className="prose prose-invert prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: generatedHTML }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <Spinner className="w-8 h-8 text-primary" />
                    <div className="text-center">
                      <p className="text-sm text-zinc-300 font-medium">
                        {currentSection === "Planning"
                          ? "Creating detailed paper outline…"
                          : currentSection === "Reasoning & Analysis"
                          ? "Analyzing papers, finding themes & gaps…"
                          : "Preparing to write…"}
                      </p>
                      <p className="text-xs text-zinc-600 mt-1">
                        The agent plans and reasons before writing for higher quality
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 4: Result in editor ─────────────────────────────────────── */}
      {step === "result" && (
        <div className="space-y-4 fade-in-up">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <HiOutlineCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-100">
                  Paper generated successfully
                </p>
                <p className="text-xs text-zinc-500">
                  You can edit, refine, and export the paper below
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExport}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                <HiOutlineDownload className="w-3.5 h-3.5" />
                Export HTML
              </button>
              <button
                onClick={handleResetAll}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                <HiOutlineSparkles className="w-3.5 h-3.5" />
                Build Another
              </button>
            </div>
          </div>

          {/* Editor */}
          <div className="bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden">
            {/* Title bar */}
            <div className="flex items-center gap-3 px-4 py-2 bg-zinc-900/60 border-b border-zinc-800">
              <input
                ref={editorTitleRef}
                type="text"
                defaultValue={topic || "Generated Research Paper"}
                className="flex-1 bg-transparent text-sm font-semibold text-zinc-200 outline-none placeholder-zinc-600"
                placeholder="Document title…"
              />
              <span className="text-[11px] text-zinc-600 tabular-nums whitespace-nowrap">
                {editor
                  ? `${editor.state.doc.textContent
                      .trim()
                      .split(/\s+/)
                      .filter(Boolean).length} words`
                  : ""}
              </span>
            </div>

            {/* Toolbar */}
            {editor && (
              <EditorToolbar
                editor={editor}
                onExportHTML={handleExport}
                onImportHTML={() => {}}
              />
            )}

            {/* Editor area */}
            <div className="max-h-[70vh] overflow-y-auto editor-scroll">
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

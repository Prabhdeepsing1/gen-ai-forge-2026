/**
 * React NodeView components for rendering KaTeX inside TipTap.
 * Clicking a rendered equation opens an inline editor to modify the LaTeX source.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import katex from "katex";

/* ------------------------------------------------------------------ */
/*  Shared renderer                                                    */
/* ------------------------------------------------------------------ */

function renderKatex(latex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      strict: false,
      trust: true,
    });
  } catch {
    return `<span class="text-red-400 text-xs font-mono">${latex || "empty"}</span>`;
  }
}

/* ------------------------------------------------------------------ */
/*  Inline math view                                                   */
/* ------------------------------------------------------------------ */

export function MathInlineView({ node, updateAttributes, selected }: NodeViewProps) {
  const latex = (node.attrs.latex as string) ?? "";
  const [editing, setEditing] = useState(!latex);
  const [value, setValue] = useState(latex);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = useCallback(() => {
    updateAttributes({ latex: value });
    setEditing(false);
  }, [value, updateAttributes]);

  if (editing) {
    return (
      <NodeViewWrapper as="span" className="inline-flex items-center align-middle">
        <span className="inline-flex items-center bg-zinc-800 border border-indigo-500/50 rounded px-1.5 py-0.5 gap-1">
          <span className="text-[10px] text-indigo-400 font-mono select-none">$</span>
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") {
                setValue(latex);
                setEditing(false);
              }
            }}
            onBlur={commit}
            className="bg-transparent text-xs text-zinc-100 font-mono outline-none min-w-[60px] max-w-[300px]"
            placeholder="LaTeX…"
            style={{ width: `${Math.max(60, value.length * 7.5)}px` }}
          />
          <span className="text-[10px] text-indigo-400 font-mono select-none">$</span>
        </span>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      as="span"
      className={`inline cursor-pointer rounded px-0.5 transition-colors ${
        selected ? "bg-indigo-500/20 ring-1 ring-indigo-500/40" : "hover:bg-zinc-800/60"
      }`}
      onClick={() => setEditing(true)}
      title="Click to edit LaTeX"
    >
      <span dangerouslySetInnerHTML={{ __html: renderKatex(latex, false) }} />
    </NodeViewWrapper>
  );
}

/* ------------------------------------------------------------------ */
/*  Display / block math view                                          */
/* ------------------------------------------------------------------ */

export function MathDisplayView({ node, updateAttributes, selected }: NodeViewProps) {
  const latex = (node.attrs.latex as string) ?? "";
  const [editing, setEditing] = useState(!latex);
  const [value, setValue] = useState(latex);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      textareaRef.current?.focus();
      autoResize();
    }
  }, [editing]);

  const autoResize = () => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = `${ta.scrollHeight}px`;
    }
  };

  const commit = useCallback(() => {
    updateAttributes({ latex: value });
    setEditing(false);
  }, [value, updateAttributes]);

  if (editing) {
    return (
      <NodeViewWrapper className="my-3">
        <div className="bg-zinc-800 border border-indigo-500/50 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-indigo-400 font-mono uppercase tracking-wider select-none">
              LaTeX Block
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setValue(latex);
                  setEditing(false);
                }}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 px-2 py-0.5 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={commit}
                className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded hover:bg-indigo-500 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              autoResize();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) commit();
              if (e.key === "Escape") {
                setValue(latex);
                setEditing(false);
              }
            }}
            className="w-full bg-zinc-900 text-xs text-zinc-100 font-mono rounded p-2 outline-none resize-none border border-zinc-700 focus:border-indigo-500/50"
            placeholder="Enter LaTeX equation…"
            rows={2}
          />
          {/* Live preview */}
          {value && (
            <div className="bg-zinc-900/50 rounded p-3 text-center overflow-x-auto">
              <span dangerouslySetInnerHTML={{ __html: renderKatex(value, true) }} />
            </div>
          )}
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      className={`my-3 cursor-pointer rounded-lg p-4 text-center transition-colors overflow-x-auto ${
        selected ? "bg-indigo-500/10 ring-1 ring-indigo-500/40" : "hover:bg-zinc-800/40"
      }`}
      onClick={() => setEditing(true)}
      title="Click to edit LaTeX"
    >
      <span dangerouslySetInnerHTML={{ __html: renderKatex(latex, true) }} />
    </NodeViewWrapper>
  );
}

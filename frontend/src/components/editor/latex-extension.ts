/**
 * TipTap LaTeX extension – inline & display math powered by KaTeX.
 *
 * Inline:  wraps LaTeX in <span data-latex="..."> nodes
 * Display: wraps LaTeX in <div data-latex-display="..."> nodes
 *
 * Both are rendered to KaTeX HTML on the fly via a NodeView.
 */

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { MathInlineView, MathDisplayView } from "./MathNodeView";

/* ------------------------------------------------------------------ */
/*  Inline math  ($...$)                                               */
/* ------------------------------------------------------------------ */

export const MathInline = Node.create({
  name: "mathInline",
  group: "inline",
  inline: true,
  atom: true, // treated as a single unit (cannot place cursor inside)

  addAttributes() {
    return {
      latex: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-latex") ?? "",
        renderHTML: (attrs) => ({ "data-latex": attrs.latex }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-latex]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { class: "math-inline-node" }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathInlineView);
  },

  addCommands() {
    return {
      insertMathInline:
        (latex: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { latex },
          });
        },
    } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  },
});

/* ------------------------------------------------------------------ */
/*  Display / block math  ($$...$$)                                    */
/* ------------------------------------------------------------------ */

export const MathDisplay = Node.create({
  name: "mathDisplay",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      latex: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-latex-display") ?? "",
        renderHTML: (attrs) => ({ "data-latex-display": attrs.latex }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-latex-display]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { class: "math-display-node" }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathDisplayView);
  },

  addCommands() {
    return {
      insertMathDisplay:
        (latex: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { latex },
          });
        },
    } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  },
});

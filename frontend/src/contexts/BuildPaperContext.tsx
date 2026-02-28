import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { buildPaperAPI } from "@/api";
import type { Paper } from "@/types";
import toast from "react-hot-toast";

/* ── Types ──────────────────────────────────────────────────────────────── */

export type BuildStep = "topic" | "papers" | "generating" | "result";

export const ALL_SECTIONS = [
  "Planning",
  "Reasoning & Analysis",
  "Title & Abstract",
  "Introduction",
  "Related Work",
  "Methodology",
  "Results & Discussion",
  "Conclusion",
  "References",
];

interface BuildPaperState {
  // Step
  step: BuildStep;
  setStep: (s: BuildStep) => void;

  // Step 1
  topic: string;
  setTopic: (t: string) => void;
  refining: boolean;
  refinedQuery: string;
  searching: boolean;

  // Step 2
  searchResults: Paper[];
  selectedPapers: Set<number>;
  togglePaper: (idx: number) => void;

  // Step 3
  currentSection: string | null;
  completedSections: Set<string>;
  generatedHTML: string;
  planText: string;
  reasoningText: string;

  // Actions
  handleSearchTopic: () => Promise<void>;
  handleGenerate: () => Promise<void>;
  handleReset: () => void;
}

const BuildPaperContext = createContext<BuildPaperState | null>(null);

export function useBuildPaper() {
  const ctx = useContext(BuildPaperContext);
  if (!ctx) throw new Error("useBuildPaper must be used within BuildPaperProvider");
  return ctx;
}

/* ── Provider ───────────────────────────────────────────────────────────── */

export function BuildPaperProvider({ children }: { children: ReactNode }) {
  // Step
  const [step, setStep] = useState<BuildStep>("topic");

  // Step 1
  const [topic, setTopic] = useState("");
  const [refining, setRefining] = useState(false);
  const [refinedQuery, setRefinedQuery] = useState("");
  const [searching, setSearching] = useState(false);

  // Step 2
  const [searchResults, setSearchResults] = useState<Paper[]>([]);
  const [selectedPapers, setSelectedPapers] = useState<Set<number>>(new Set());

  // Step 3 — these use refs for the SSE callback + state for UI
  const [currentSection, setCurrentSection] = useState<string | null>(null);
  const [completedSections, setCompletedSections] = useState<Set<string>>(new Set());
  const [generatedHTML, setGeneratedHTML] = useState("");
  const [planText, setPlanText] = useState("");
  const [reasoningText, setReasoningText] = useState("");

  // Mutable buffers for SSE accumulation (not tied to render)
  const htmlBuf = useRef("");
  const planBuf = useRef("");
  const reasonBuf = useRef("");

  // ── Toggle paper selection ─────────────────────────────────────────────
  const togglePaper = useCallback((index: number) => {
    setSelectedPapers((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  // ── Search topic → arXiv ──────────────────────────────────────────────
  const handleSearchTopic = useCallback(async () => {
    if (!topic.trim()) return;
    setRefining(true);
    try {
      const { refined_query } = await buildPaperAPI.refineQuery(topic);
      setRefinedQuery(refined_query);

      setSearching(true);
      setRefining(false);
      const data = await buildPaperAPI.searchArxiv(refined_query);
      setSearchResults(data.papers);
      setStep("papers");
    } catch {
      toast.error("Failed to search for papers");
    } finally {
      setRefining(false);
      setSearching(false);
    }
  }, [topic]);

  // ── Generate paper (runs as detached promise) ─────────────────────────
  const handleGenerate = useCallback(async () => {
    const papers = Array.from(selectedPapers).map((i) => searchResults[i]);
    if (papers.length === 0) {
      toast.error("Select at least one paper");
      return;
    }

    // Reset generation state
    setStep("generating");
    setCurrentSection(null);
    setCompletedSections(new Set());
    htmlBuf.current = "";
    planBuf.current = "";
    reasonBuf.current = "";
    setGeneratedHTML("");
    setPlanText("");
    setReasoningText("");

    let prevSection: string | null = null;

    // This promise runs to completion regardless of component mounts
    await buildPaperAPI.generatePaper(
      topic,
      papers.map((p) => ({
        title: p.title,
        authors: p.authors,
        abstract: p.abstract,
        published: p.published,
        url: p.url,
      })),
      // onSection
      (section: string) => {
        if (prevSection) {
          setCompletedSections((prev) => new Set([...prev, prevSection!]));
        }
        prevSection = section;
        setCurrentSection(section);
      },
      // onContent
      (html: string) => {
        htmlBuf.current += html;
        setGeneratedHTML(htmlBuf.current);
      },
      // onDone
      () => {
        if (prevSection) {
          setCompletedSections((prev) => new Set([...prev, prevSection!]));
        }
        setCurrentSection(null);
        setTimeout(() => setStep("result"), 600);
      },
      // onError
      (msg: string) => {
        toast.error(`Generation failed: ${msg}`);
        if (htmlBuf.current) {
          setStep("result");
        } else {
          setStep("papers");
        }
      },
      // onPlan
      (text: string) => {
        planBuf.current += text;
        setPlanText(planBuf.current);
      },
      // onReasoning
      (text: string) => {
        reasonBuf.current += text;
        setReasoningText(reasonBuf.current);
      },
    );
  }, [topic, selectedPapers, searchResults]);

  // ── Reset ─────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setStep("topic");
    setTopic("");
    setRefinedQuery("");
    setSearchResults([]);
    setSelectedPapers(new Set());
    setCurrentSection(null);
    setCompletedSections(new Set());
    setGeneratedHTML("");
    setPlanText("");
    setReasoningText("");
    htmlBuf.current = "";
    planBuf.current = "";
    reasonBuf.current = "";
  }, []);

  return (
    <BuildPaperContext.Provider
      value={{
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
      }}
    >
      {children}
    </BuildPaperContext.Provider>
  );
}

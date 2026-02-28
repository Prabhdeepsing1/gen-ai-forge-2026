import { useEffect, useState, useRef, useCallback, type FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { workspacesAPI, papersAPI, chatAPI, aiAPI, semanticSearchAPI, audioAPI } from "../api";
import type { WorkspaceDetail, Paper, ChatMessage, SemanticSearchResult, AnalysisResult } from "../types";
import toast from "react-hot-toast";
import Spinner from "../components/Spinner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { WordEditor } from "../components/editor/WordEditor";
import type { WordEditorHandle } from "../components/editor/WordEditor";
import {
  HiOutlineSearch,
  HiOutlineTrash,
  HiOutlinePaperAirplane,
  HiOutlineArrowLeft,
  HiOutlineExternalLink,
  HiOutlineDocumentText,
  HiOutlineLightBulb,
  HiOutlineBookOpen,
  HiOutlinePlus,
  HiOutlineX,
  HiOutlineChatAlt2,
  HiOutlineClock,
  HiOutlineCollection,
  HiOutlinePencilAlt,
  HiOutlineClipboardCopy,
  HiOutlineCheck,
  HiOutlineChevronDown,
  HiOutlineMicrophone,
  HiOutlineVolumeUp,
  HiOutlineStop,
} from "react-icons/hi";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { useTextToSpeech } from "../hooks/useTextToSpeech";
import { useTypewriter } from "../hooks/useTypewriter";

type Tab = "papers" | "chat" | "ai" | "search" | "history";

export function PaperCard({ paper, onDelete }: { paper: Paper; onDelete?: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="group bg-[#111118] border border-zinc-800 rounded-xl hover:border-zinc-600 transition-all">
      <div className="flex items-start gap-3 p-5 pb-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-zinc-100 leading-snug">
            {paper.title}
          </h3>
          <p className="text-xs text-zinc-500 mt-1.5">
            {paper.authors?.slice(0, 4).join(", ")}
            {(paper.authors?.length ?? 0) > 4 && " et al."}
            {paper.published && ` · ${paper.published}`}
          </p>
          <div className="flex items-center gap-3 mt-2.5">
            {paper.url && (
              <a
                href={paper.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-zinc-500 hover:text-indigo-400 transition-colors"
                title="View on arXiv"
              >
                <HiOutlineExternalLink size={15} />
              </a>
            )}
            {paper.pdf_url && (
              <a
                href={paper.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-zinc-500 hover:text-indigo-400 transition-colors"
                title="View PDF"
              >
                <HiOutlineDocumentText size={15} />
              </a>
            )}
          </div>
        </div>
        {onDelete && (
          <button
            onClick={onDelete}
            className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 p-1.5 transition-all"
            title="Remove"
          >
            <HiOutlineTrash size={15} />
          </button>
        )}
      </div>

      {/* Abstract dropdown toggle */}
      {paper.abstract && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center gap-1.5 px-5 py-2 text-[11px] font-medium text-zinc-500 hover:text-zinc-300 border-t border-zinc-800/60 transition-colors"
          >
            <HiOutlineChevronDown
              size={13}
              className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            />
            {expanded ? "Hide abstract" : "Show abstract"}
          </button>

          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              expanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <div className="px-5 pb-4 pt-1">
              <p className="text-sm text-zinc-400 leading-relaxed">
                {paper.abstract}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SearchResultCard({ paper, onImport }: { paper: Paper; onImport: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-zinc-800 rounded-lg hover:border-zinc-700 transition-colors">
      <div className="flex items-start justify-between gap-2 p-3 pb-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-200 leading-snug">
            {paper.title}
          </p>
          <p className="text-xs text-zinc-500 mt-1 truncate">
            {paper.authors?.slice(0, 3).join(", ")}
            {(paper.authors?.length ?? 0) > 3 && " et al."}
            {paper.published && ` · ${paper.published}`}
          </p>
        </div>
        <button
          onClick={onImport}
          className="shrink-0 text-zinc-500 hover:text-indigo-400 transition-colors"
          title="Import paper"
        >
          <HiOutlinePlus size={18} />
        </button>
      </div>

      {paper.abstract && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium text-zinc-500 hover:text-zinc-300 border-t border-zinc-800/50 transition-colors"
          >
            <HiOutlineChevronDown
              size={11}
              className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            />
            {expanded ? "Hide abstract" : "Show abstract"}
          </button>

          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              expanded ? "max-h-[300px] opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <div className="px-3 pb-3 pt-0.5">
              <p className="text-xs text-zinc-400 leading-relaxed">
                {paper.abstract}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Markdown → HTML converter for applying to editor ─────────────────
function markdownToHtml(md: string): string {
  let html = md;
  // Headings (### → <h3>, ## → <h2>, # → <h1>)
  html = html.replace(/^#### (.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  // Bold + Italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Italic
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  // Unordered list items
  html = html.replace(/^[-*] (.+)$/gm, "<li>$1</li>");
  // Ordered list items
  html = html.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");
  // Wrap consecutive <li> in <ul> (simple approach)
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>");
  // Blockquote
  html = html.replace(/^> (.+)$/gm, "<blockquote><p>$1</p></blockquote>");
  // Horizontal rule
  html = html.replace(/^---$/gm, "<hr>");
  // Paragraphs: lines that aren't already wrapped in tags
  html = html.replace(/^(?!<[a-z])((?!<\/)[^\n]+)$/gm, "<p>$1</p>");
  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, "");
  return html;
}

export default function WorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const workspaceId = Number(id);

  const [workspace, setWorkspace] = useState<WorkspaceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("papers");

  // ── Papers search ──────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Paper[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // ── Chat ───────────────────────────────────────────────────────
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Audio (STT + TTS) ──────────────────────────────────────────
  const { recording, elapsed, startRecording, stopRecording } = useAudioRecorder();
  const { speaking, speakingId, speak, stop: stopSpeech } = useTextToSpeech();
  const [transcribing, setTranscribing] = useState(false);
  const { displayedText, isTyping, typewrite, cancel: cancelTypewriter } = useTypewriter(28);
  const [pipelinePhase, setPipelinePhase] = useState<string | null>(null);
  const typingMsgIdx = useRef<number>(-1);

  // ── AI tools ───────────────────────────────────────────────────
  const [aiResult, setAiResult] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiTool, setAiTool] = useState<string>("");

  // ── Semantic search ────────────────────────────────────────────
  const [semQuery, setSemQuery] = useState("");
  const [semResults, setSemResults] = useState<SemanticSearchResult[]>([]);
  const [semSearching, setSemSearching] = useState(false);

  // ── Analysis history ───────────────────────────────────────────
  const [analysisHistory, setAnalysisHistory] = useState<AnalysisResult[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedResult, setExpandedResult] = useState<number | null>(null);
  // ── Editor panel ───────────────────────────────────────────
  const [editorOpen, setEditorOpen] = useState(false);
  const editorRef = useRef<WordEditorHandle>(null);

  // ── Apply content to editor at cursor position ─────────────
  const handleApplyToEditor = useCallback((markdown: string) => {
    const html = markdownToHtml(markdown);
    if (!editorOpen) {
      setEditorOpen(true);
      // Editor needs a frame to mount — apply after it renders
      setTimeout(() => {
        editorRef.current?.insertContentAtCursor(html);
        toast.success("Applied to editor");
      }, 300);
    } else {
      editorRef.current?.insertContentAtCursor(html);
      toast.success("Applied to editor at cursor position");
    }
  }, [editorOpen]);

  const handleCopyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  }, []);

  // ── Fetch workspace ────────────────────────────────────────────
  const fetchWorkspace = async () => {
    try {
      const data = await workspacesAPI.get(workspaceId);
      setWorkspace(data);
    } catch {
      toast.error("Workspace not found");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const fetchChat = async () => {
    try {
      const data = await chatAPI.history(workspaceId);
      setMessages(data);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    fetchWorkspace();
    fetchChat();
  }, [workspaceId]);

  useEffect(() => {
    if (tab === "history") fetchHistory();
  }, [tab]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Semantic search ────────────────────────────────────────────
  const handleSemanticSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!semQuery.trim()) return;
    setSemSearching(true);
    setSemResults([]);
    try {
      const { data } = await semanticSearchAPI.search(workspaceId, semQuery.trim());
      setSemResults(data.results);
      if (data.results.length === 0) toast("No matching papers found");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? "Semantic search failed");
    } finally {
      setSemSearching(false);
    }
  };

  // ── Analysis history ───────────────────────────────────────────
  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data } = await aiAPI.analysisHistory(workspaceId);
      setAnalysisHistory(data.results);
    } catch {
      toast.error("Failed to load analysis history");
    } finally {
      setHistoryLoading(false);
    }
  };

  // ── Search arXiv ───────────────────────────────────────────────
  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const data = await papersAPI.search(searchQuery.trim());
      setSearchResults(data.papers);
    } catch {
      toast.error("Search failed");
    } finally {
      setSearching(false);
    }
  };

  const handleImport = async (paper: Paper) => {
    try {
      await papersAPI.import({ ...paper, workspace_id: workspaceId });
      toast.success("Paper imported");
      fetchWorkspace();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? "Import failed");
    }
  };

  const handleRemovePaper = async (paperId: number) => {
    try {
      await workspacesAPI.removePaper(workspaceId, paperId);
      toast.success("Paper removed");
      fetchWorkspace();
    } catch {
      toast.error("Failed to remove paper");
    }
  };

  // ── Chat ───────────────────────────────────────────────────────
  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || sending) return;
    const content = chatInput.trim();
    setChatInput("");
    setMessages((m) => [...m, { role: "user", content }]);
    setSending(true);

    // Show pipeline phases
    setPipelinePhase("Embedding query via MiniLM-L6…");
    const phaseTimer1 = setTimeout(() => setPipelinePhase("Searching FAISS vector index…"), 800);
    const phaseTimer2 = setTimeout(() => setPipelinePhase("Retrieving relevant paper context…"), 1600);
    const phaseTimer3 = setTimeout(() => setPipelinePhase("Generating response via Groq LLaMA 3.3…"), 2400);

    try {
      const data = await chatAPI.send(content, workspaceId);
      clearTimeout(phaseTimer1);
      clearTimeout(phaseTimer2);
      clearTimeout(phaseTimer3);
      setPipelinePhase(null);

      // Add empty assistant msg, then typewrite into it
      setMessages((m) => [...m, { role: "assistant", content: "" }]);
      typingMsgIdx.current = -1; // will be set after state update
      // Small delay to let state settle
      await new Promise((r) => setTimeout(r, 50));
      setMessages((prev) => {
        typingMsgIdx.current = prev.length - 1;
        return prev;
      });

      await typewrite(data.response);

      // Set final full message
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: data.response };
        return updated;
      });
    } catch {
      clearTimeout(phaseTimer1);
      clearTimeout(phaseTimer2);
      clearTimeout(phaseTimer3);
      setPipelinePhase(null);
      toast.error("Chat failed");
    } finally {
      setSending(false);
    }
  };

  const handleClearChat = async () => {
    if (!confirm("Clear all chat history?")) return;
    try {
      await chatAPI.clear(workspaceId);
      setMessages([]);
      toast.success("Chat cleared");
    } catch {
      toast.error("Failed to clear chat");
    }
  };

  // ── Voice input handler ────────────────────────────────────────
  const handleVoiceInput = async () => {
    if (recording) {
      stopRecording();
      return;
    }
    try {
      const blob = await startRecording();
      setTranscribing(true);
      const text = await audioAPI.transcribe(blob);
      if (text) setChatInput((prev) => (prev ? prev + " " + text : text));
    } catch (err: any) {
      toast.error(err?.message || "Voice input failed");
    } finally {
      setTranscribing(false);
    }
  };

  // ── AI tools ───────────────────────────────────────────────────
  const runAI = async (
    tool: "summarize" | "insights" | "litReview",
    label: string
  ) => {
    setAiLoading(true);
    setAiTool(label);
    setAiResult("");
    try {
      const data = await aiAPI[tool](workspaceId);
      const result =
        "summary" in data
          ? data.summary
          : "insights" in data
          ? data.insights
          : (data as any).literature_review;
      setAiResult(result);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? `${label} failed`);
    } finally {
      setAiLoading(false);
    }
  };

  if (loading || !workspace) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "papers", label: "Papers" },
    { key: "chat", label: "Chat" },
    { key: "ai", label: "AI Tools" },
    { key: "search", label: "Semantic Search" },
    { key: "history", label: "History" },
  ];

  const renderTabContent = () => (
    <>
      {/* ── Papers tab ────────────────────────────────────────────── */}
      {tab === "papers" && (
        <div>
          {/* Search toggle */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-zinc-400">
              {workspace.papers.length} paper
              {workspace.papers.length !== 1 ? "s" : ""}
            </span>
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-indigo-300 transition-colors"
            >
              {showSearch ? (
                <HiOutlineX size={14} />
              ) : (
                <HiOutlineSearch size={14} />
              )}
              {showSearch ? "Close" : "Search arXiv"}
            </button>
          </div>

          {/* Search panel */}
          {showSearch && (
            <div className="bg-[#111118] border border-zinc-800 rounded-xl p-5 mb-4">
              <form onSubmit={handleSearch} className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search papers on arXiv…"
                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={searching || !searchQuery.trim()}
                  className="bg-indigo-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-indigo-500 disabled:opacity-50 transition-colors"
                >
                  {searching ? "…" : "Search"}
                </button>
              </form>

              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {searchResults.map((p, i) => (
                    <SearchResultCard key={p.external_id ?? i} paper={p} onImport={() => handleImport(p)} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Paper list */}
          {workspace.papers.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-xl">
              No papers yet. Use search to find and import papers.
            </div>
          ) : (
            <div className="space-y-3">
              {workspace.papers.map((p) => (
                <div
                  key={p.id}
                  className="group bg-[#111118] border border-zinc-800 rounded-xl p-5 hover:border-zinc-600 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-zinc-100 leading-snug">
                        {p.title}
                      </h3>
                      <p className="text-xs text-zinc-500 mt-1.5">
                        {p.authors?.slice(0, 4).join(", ")}
                        {(p.authors?.length ?? 0) > 4 && " et al."}
                        {p.published && ` · ${p.published}`}
                      </p>
                      {p.abstract && (
                        <p className="text-sm text-zinc-500 mt-2 line-clamp-2 leading-relaxed">
                          {p.abstract}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-3">
                        {p.url && (
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-zinc-500 hover:text-indigo-400 transition-colors"
                            title="View on arXiv"
                          >
                            <HiOutlineExternalLink size={15} />
                          </a>
                        )}
                        {p.pdf_url && (
                          <a
                            href={p.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-zinc-500 hover:text-indigo-400 transition-colors"
                            title="View PDF"
                          >
                            <HiOutlineDocumentText size={15} />
                          </a>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => p.id && handleRemovePaper(p.id)}
                      className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 p-1.5 transition-all"
                      title="Remove from workspace"
                    >
                      <HiOutlineTrash size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Chat tab ──────────────────────────────────────────────── */}
      {tab === "chat" && (
        <div className="flex flex-col" style={{ height: editorOpen ? "calc(100% - 50px)" : "calc(100vh - 260px)" }}>
          {/* RAG Pipeline badges */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Pipeline</span>
            {[
              { label: "MiniLM-L6", color: "text-sky-400 bg-sky-500/10 border-sky-500/20" },
              { label: "FAISS", color: "text-violet-400 bg-violet-500/10 border-violet-500/20" },
              { label: "RAG", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
              { label: "Groq LLaMA 3.3 70B", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
            ].map((b) => (
              <span key={b.label} className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${b.color}`}>
                {b.label}
              </span>
            ))}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto mb-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <HiOutlineChatAlt2
                  size={32}
                  className="mx-auto text-zinc-700 mb-3"
                />
                <p className="text-sm text-zinc-500">
                  Ask questions about the papers in this workspace
                </p>
                <p className="text-[11px] text-zinc-600 mt-2 max-w-sm mx-auto">
                  Your query is embedded, matched against papers via FAISS semantic search, and answered by Groq LLaMA 3.3 70B
                </p>
              </div>
            )}
            {messages.map((m, i) => {
              // For the last assistant message while typing, show typewriter text
              const isCurrentlyTyping = isTyping && i === typingMsgIdx.current;
              const content = isCurrentlyTyping ? displayedText : m.content;

              return (
                <div
                  key={i}
                  className={`flex ${
                    m.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "bg-indigo-600 text-white"
                        : "bg-[#111118] text-zinc-300 border border-zinc-800"
                    }`}
                  >
                    <div className="prose-md">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                      {isCurrentlyTyping && (
                        <span className="inline-block w-1.5 h-4 bg-indigo-400 animate-pulse ml-0.5 align-text-bottom rounded-sm" />
                      )}
                    </div>
                    {/* Apply / Copy / Listen buttons for completed assistant messages */}
                    {m.role === "assistant" && !isCurrentlyTyping && m.content && (
                      <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-zinc-700/50">
                        <button
                          onClick={() => handleApplyToEditor(m.content)}
                          className="flex items-center gap-1 text-[11px] font-medium text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-2.5 py-1 rounded-md transition-all"
                          title="Insert into editor at cursor position"
                        >
                          <HiOutlinePencilAlt size={12} />
                          Apply to Editor
                        </button>
                        <button
                          onClick={() => handleCopyToClipboard(m.content)}
                          className="flex items-center gap-1 text-[11px] font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-700/30 hover:bg-zinc-700/50 px-2.5 py-1 rounded-md transition-all"
                          title="Copy response to clipboard"
                        >
                          <HiOutlineClipboardCopy size={12} />
                          Copy
                        </button>
                        <button
                          onClick={() =>
                            speaking && speakingId === `ws-${i}`
                              ? stopSpeech()
                              : speak(m.content, `ws-${i}`)
                          }
                          className={`flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md transition-all ${
                            speaking && speakingId === `ws-${i}`
                              ? "text-amber-400 bg-amber-500/10 hover:bg-amber-500/20"
                              : "text-zinc-400 hover:text-zinc-200 bg-zinc-700/30 hover:bg-zinc-700/50"
                          }`}
                          title={speaking && speakingId === `ws-${i}` ? "Stop listening" : "Listen"}
                        >
                          {speaking && speakingId === `ws-${i}` ? (
                            <><HiOutlineStop size={12} /> Stop</>
                          ) : (
                            <><HiOutlineVolumeUp size={12} /> Listen</>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Processing pipeline indicator */}
            {sending && pipelinePhase && (
              <div className="flex justify-start">
                <div className="bg-[#111118] border border-zinc-800 rounded-xl px-4 py-3 max-w-[80%]">
                  <div className="flex items-center gap-2.5">
                    <div className="relative w-4 h-4 flex-shrink-0">
                      <div className="absolute inset-0 rounded-full border-2 border-indigo-500/30 border-t-indigo-400 animate-spin" />
                    </div>
                    <span className="text-xs text-zinc-400 animate-pulse">{pipelinePhase}</span>
                  </div>
                  {/* Pipeline steps visualization */}
                  <div className="flex items-center gap-1 mt-2.5 pt-2 border-t border-zinc-800/60">
                    {[
                      { label: "Embed", done: !pipelinePhase.includes("Embedding") },
                      { label: "Search", done: !pipelinePhase.includes("Embedding") && !pipelinePhase.includes("Searching") },
                      { label: "Retrieve", done: pipelinePhase.includes("Generating") },
                      { label: "Generate", done: false },
                    ].map((step, idx) => (
                      <div key={step.label} className="flex items-center gap-1">
                        {idx > 0 && <div className={`w-3 h-px ${step.done ? "bg-indigo-500" : "bg-zinc-700"}`} />}
                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${
                          step.done
                            ? "text-indigo-300 bg-indigo-500/15"
                            : pipelinePhase.toLowerCase().includes(step.label.toLowerCase())
                            ? "text-amber-300 bg-amber-500/15 animate-pulse"
                            : "text-zinc-600 bg-zinc-800"
                        }`}>
                          {step.done ? "✓ " : ""}{step.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Fallback spinner if pipeline phase hasn't started yet */}
            {sending && !pipelinePhase && !isTyping && (
              <div className="flex justify-start">
                <div className="bg-[#111118] border border-zinc-800 rounded-xl px-4 py-3">
                  <Spinner className="w-4 h-4" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat input */}
          <div className="flex items-center gap-2">
            <form onSubmit={handleSend} className="flex-1 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about your papers…"
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                disabled={sending}
              />
              {/* Mic button */}
              <button
                type="button"
                onClick={handleVoiceInput}
                disabled={sending || transcribing}
                className={`p-2.5 rounded-lg transition-all ${
                  recording
                    ? "bg-red-500 text-white animate-pulse"
                    : transcribing
                    ? "bg-amber-500 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700"
                }`}
                title={recording ? `Recording… ${elapsed}s — click to stop` : transcribing ? "Transcribing…" : "Voice input"}
              >
                <HiOutlineMicrophone size={16} />
              </button>
              <button
                type="submit"
                disabled={sending || !chatInput.trim()}
                className="bg-indigo-600 text-white p-2.5 rounded-lg hover:bg-indigo-500 disabled:opacity-50 transition-colors"
              >
                <HiOutlinePaperAirplane size={16} className="rotate-90" />
              </button>
            </form>
            <button
              onClick={handleClearChat}
              className="text-zinc-600 hover:text-red-400 p-2.5 transition-colors"
              title="Clear chat"
            >
              <HiOutlineTrash size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── AI Tools tab ──────────────────────────────────────────── */}
      {tab === "ai" && (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <button
              onClick={() => runAI("summarize", "Summary")}
              disabled={aiLoading}
              className="bg-[#111118] border border-zinc-800 rounded-xl p-5 text-left hover:border-indigo-500/40 hover:bg-[#15151f] transition-all disabled:opacity-50"
            >
              <HiOutlineDocumentText
                size={20}
                className="text-indigo-400 mb-2"
              />
              <p className="text-sm font-semibold text-zinc-200">Summarize</p>
              <p className="text-xs text-zinc-500 mt-1">
                AI summary of all papers
              </p>
            </button>

            <button
              onClick={() => runAI("insights", "Insights")}
              disabled={aiLoading}
              className="bg-[#111118] border border-zinc-800 rounded-xl p-5 text-left hover:border-amber-500/40 hover:bg-[#15151f] transition-all disabled:opacity-50"
            >
              <HiOutlineLightBulb size={20} className="text-amber-400 mb-2" />
              <p className="text-sm font-semibold text-zinc-200">Insights</p>
              <p className="text-xs text-zinc-500 mt-1">
                Key trends & findings
              </p>
            </button>

            <button
              onClick={() => runAI("litReview", "Literature Review")}
              disabled={aiLoading}
              className="bg-[#111118] border border-zinc-800 rounded-xl p-5 text-left hover:border-emerald-500/40 hover:bg-[#15151f] transition-all disabled:opacity-50"
            >
              <HiOutlineBookOpen size={20} className="text-emerald-400 mb-2" />
              <p className="text-sm font-semibold text-zinc-200">Lit Review</p>
              <p className="text-xs text-zinc-500 mt-1">
                Formal literature review
              </p>
            </button>
          </div>

          {/* Result area */}
          {aiLoading && (
            <div className="bg-[#111118] border border-zinc-800 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="relative w-5 h-5 flex-shrink-0">
                  <div className="absolute inset-0 rounded-full border-2 border-indigo-500/30 border-t-indigo-400 animate-spin" />
                </div>
                <span className="text-sm text-zinc-300 font-medium">Generating {aiTool}…</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { label: "Collecting paper data", delay: "0s" },
                  { label: "Building context window", delay: "0.5s" },
                  { label: "Groq LLM processing", delay: "1s" },
                ].map((step, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] text-zinc-500 bg-zinc-800/50 px-2 py-0.5 rounded animate-pulse"
                    style={{ animationDelay: step.delay }}
                  >
                    {step.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {aiResult && !aiLoading && (
            <div className="bg-[#111118] border border-zinc-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  {aiTool}
                </h3>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleApplyToEditor(aiResult)}
                    className="flex items-center gap-1 text-[11px] font-medium text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-2.5 py-1 rounded-md transition-all"
                    title="Insert into editor at cursor position"
                  >
                    <HiOutlinePencilAlt size={12} />
                    Apply to Editor
                  </button>
                  <button
                    onClick={() => handleCopyToClipboard(aiResult)}
                    className="flex items-center gap-1 text-[11px] font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-700/30 hover:bg-zinc-700/50 px-2.5 py-1 rounded-md transition-all"
                    title="Copy to clipboard"
                  >
                    <HiOutlineClipboardCopy size={12} />
                    Copy
                  </button>
                </div>
              </div>
              <div className="prose-md text-sm text-zinc-300 leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiResult}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Semantic Search tab ───────────────────────────────────── */}
      {tab === "search" && (
        <div>
          <div className="mb-6">
            {/* Tech badges */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Engine</span>
              {[
                { label: "Sentence-Transformers", color: "text-sky-400 bg-sky-500/10 border-sky-500/20" },
                { label: "all-MiniLM-L6-v2", color: "text-violet-400 bg-violet-500/10 border-violet-500/20" },
                { label: "FAISS Index", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
                { label: "Cosine Similarity", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
              ].map((b) => (
                <span key={b.label} className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${b.color}`}>
                  {b.label}
                </span>
              ))}
            </div>
            <p className="text-sm text-zinc-400 mb-4">
              Search papers in this workspace using AI-powered semantic
              similarity. Your query is embedded into a 384-dim vector and matched against all indexed papers via FAISS.
            </p>
            <form onSubmit={handleSemanticSearch} className="flex gap-2">
              <input
                type="text"
                value={semQuery}
                onChange={(e) => setSemQuery(e.target.value)}
                placeholder="Describe what you're looking for…"
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                autoFocus
              />
              <button
                type="submit"
                disabled={semSearching || !semQuery.trim()}
                className="bg-indigo-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-indigo-500 disabled:opacity-50 transition-colors"
              >
                {semSearching ? "Searching…" : "Search"}
              </button>
            </form>
          </div>

          {semSearching && (
            <div className="bg-[#111118] border border-zinc-800 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="relative w-5 h-5 flex-shrink-0">
                  <div className="absolute inset-0 rounded-full border-2 border-violet-500/30 border-t-violet-400 animate-spin" />
                </div>
                <span className="text-sm text-zinc-300">Computing semantic similarities…</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { label: "Embedding query…", delay: "0s" },
                  { label: "FAISS index lookup…", delay: "0.3s" },
                  { label: "Ranking by cosine similarity…", delay: "0.6s" },
                ].map((step, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] text-zinc-500 bg-zinc-800/50 px-2 py-0.5 rounded animate-pulse"
                    style={{ animationDelay: step.delay }}
                  >
                    {step.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {semResults.length > 0 && !semSearching && (
            <div className="space-y-3">
              {semResults.map((r, i) => (
                <div
                  key={r.paper_id}
                  className="bg-[#111118] border border-zinc-800 rounded-xl p-5 hover:border-zinc-600 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-indigo-400">
                          #{i + 1}
                        </span>
                        <span className="text-xs bg-indigo-500/15 text-indigo-300 px-2 py-0.5 rounded-full">
                          {(r.similarity * 100).toFixed(1)}% match
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-zinc-100 leading-snug">
                        {r.title}
                      </h3>
                      {r.abstract && (
                        <p className="text-sm text-zinc-500 mt-2 line-clamp-3 leading-relaxed">
                          {r.abstract}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {semResults.length === 0 && !semSearching && semQuery && (
            <div className="text-center py-12 text-sm text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
              No results. Try a different query or add more papers.
            </div>
          )}
        </div>
      )}

      {/* ── Analysis History tab ──────────────────────────────────── */}
      {tab === "history" && (
        <div>
          <p className="text-sm text-zinc-400 mb-4">
            Previously generated AI analyses for this workspace.
          </p>

          {historyLoading && (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          )}

          {!historyLoading && analysisHistory.length === 0 && (
            <div className="text-center py-12 text-sm text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
              <HiOutlineClock size={28} className="mx-auto text-zinc-700 mb-3" />
              No analysis history yet. Use the AI Tools tab to generate one.
            </div>
          )}

          {!historyLoading && analysisHistory.length > 0 && (
            <div className="space-y-3">
              {analysisHistory.map((ar) => (
                <div
                  key={ar.id}
                  className="bg-[#111118] border border-zinc-800 rounded-xl overflow-hidden"
                >
                  <button
                    onClick={() =>
                      setExpandedResult(
                        expandedResult === ar.id ? null : ar.id
                      )
                    }
                    className="w-full flex items-center justify-between p-5 text-left hover:bg-[#15151f] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs font-semibold uppercase px-2.5 py-1 rounded-full ${
                          ar.analysis_type === "summaries"
                            ? "bg-indigo-500/15 text-indigo-300"
                            : ar.analysis_type === "insights"
                            ? "bg-amber-500/15 text-amber-300"
                            : "bg-emerald-500/15 text-emerald-300"
                        }`}
                      >
                        {ar.analysis_type}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {ar.paper_ids?.length ?? 0} papers
                      </span>
                    </div>
                    <span className="text-xs text-zinc-600">
                      {new Date(ar.created_at).toLocaleString()}
                    </span>
                  </button>

                  {expandedResult === ar.id && (
                    <div className="border-t border-zinc-800 p-5">
                      <div className="prose-md text-sm text-zinc-300 leading-relaxed max-h-96 overflow-y-auto">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{ar.result}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );

  return (
    <div className={editorOpen ? "h-[calc(100vh-80px)]" : "max-w-5xl mx-auto"}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => navigate("/dashboard")}
          className="text-zinc-500 hover:text-zinc-200 transition-colors"
        >
          <HiOutlineArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-zinc-100">{workspace.name}</h1>
          {workspace.description && (
            <p className="text-sm text-zinc-500 mt-0.5">
              {workspace.description}
            </p>
          )}
        </div>
        <button
          onClick={() => setEditorOpen(!editorOpen)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
            editorOpen
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
              : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
          }`}
          title={editorOpen ? "Close editor" : "Open side-by-side editor"}
        >
          <HiOutlinePencilAlt size={16} />
          <span className="hidden sm:inline">{editorOpen ? "Close Editor" : "Editor"}</span>
        </button>
      </div>

      {editorOpen ? (
        /* ── Side-by-side layout ─────────────────────────────────── */
        <PanelGroup direction="horizontal" className="h-[calc(100%-56px)]">
          <Panel defaultSize={50} minSize={30}>
            <div className="h-full overflow-y-auto pr-2">
              {/* Tabs */}
              <div className="flex items-center gap-0 border-b border-zinc-800 mb-4">
                {TABS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-px ${
                      tab === key
                        ? "border-indigo-500 text-indigo-300"
                        : "border-transparent text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {renderTabContent()}
            </div>
          </Panel>
          <PanelResizeHandle className="w-1.5 mx-1 rounded-full bg-zinc-800 hover:bg-indigo-500/40 transition-colors cursor-col-resize" />
          <Panel defaultSize={50} minSize={30}>
            <div className="h-full">
              <WordEditor ref={editorRef} workspaceId={workspaceId} workspaceName={workspace.name} />
            </div>
          </Panel>
        </PanelGroup>
      ) : (
        /* ── Normal full-width layout ──────────────────────────── */
        <>
          {/* Tabs */}
          <div className="flex items-center gap-0 border-b border-zinc-800 mb-6">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  tab === key
                    ? "border-indigo-500 text-indigo-300"
                    : "border-transparent text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {renderTabContent()}
        </>
      )}
    </div>
  );
}

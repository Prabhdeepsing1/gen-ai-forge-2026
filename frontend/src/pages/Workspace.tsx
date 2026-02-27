import { useEffect, useState, useRef, type FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { workspacesAPI, papersAPI, chatAPI, aiAPI } from "../api";
import type { WorkspaceDetail, Paper, ChatMessage } from "../types";
import toast from "react-hot-toast";
import Spinner from "../components/Spinner";
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
} from "react-icons/hi";

type Tab = "papers" | "chat" | "ai";

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

  // ── AI tools ───────────────────────────────────────────────────
  const [aiResult, setAiResult] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiTool, setAiTool] = useState<string>("");

  // ── Fetch workspace ────────────────────────────────────────────
  const fetchWorkspace = async () => {
    try {
      const { data } = await workspacesAPI.get(workspaceId);
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
      const { data } = await chatAPI.history(workspaceId);
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
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Search arXiv ───────────────────────────────────────────────
  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const { data } = await papersAPI.search(searchQuery.trim());
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
    try {
      const { data } = await chatAPI.send(content, workspaceId);
      setMessages((m) => [
        ...m,
        { role: "assistant", content: data.response },
      ]);
    } catch {
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

  // ── AI tools ───────────────────────────────────────────────────
  const runAI = async (
    tool: "summarize" | "insights" | "litReview",
    label: string
  ) => {
    setAiLoading(true);
    setAiTool(label);
    setAiResult("");
    try {
      const { data } = await aiAPI[tool](workspaceId);
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
  ];

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate("/dashboard")}
          className="text-white/30 hover:text-white transition-colors"
        >
          <HiOutlineArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-lg font-semibold text-white">{workspace.name}</h1>
          {workspace.description && (
            <p className="text-xs text-white/35 mt-0.5">
              {workspace.description}
            </p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-white/8 mb-6">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors -mb-px ${
              tab === key
                ? "border-white text-white"
                : "border-transparent text-white/35 hover:text-white/60"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Papers tab ────────────────────────────────────────────── */}
      {tab === "papers" && (
        <div>
          {/* Search toggle */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-white/40">
              {workspace.papers.length} paper
              {workspace.papers.length !== 1 ? "s" : ""}
            </span>
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition-colors"
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
            <div className="border border-white/10 rounded-lg p-4 mb-4">
              <form onSubmit={handleSearch} className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search papers on arXiv…"
                  className="flex-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-white/25 transition-colors"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={searching || !searchQuery.trim()}
                  className="bg-white text-black text-xs font-medium px-3 py-2 rounded-md hover:bg-white/90 disabled:opacity-50 transition-colors"
                >
                  {searching ? "…" : "Search"}
                </button>
              </form>

              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {searchResults.map((p, i) => (
                    <div
                      key={p.external_id ?? i}
                      className="border border-white/8 rounded-md p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-white leading-snug">
                            {p.title}
                          </p>
                          <p className="text-xs text-white/30 mt-1 truncate">
                            {p.authors?.slice(0, 3).join(", ")}
                            {(p.authors?.length ?? 0) > 3 && " et al."}
                            {p.published && ` · ${p.published}`}
                          </p>
                        </div>
                        <button
                          onClick={() => handleImport(p)}
                          className="shrink-0 text-white/30 hover:text-white transition-colors"
                          title="Import paper"
                        >
                          <HiOutlinePlus size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Paper list */}
          {workspace.papers.length === 0 ? (
            <div className="text-center py-12 text-white/25 text-sm">
              No papers yet. Use search to find and import papers.
            </div>
          ) : (
            <div className="space-y-2">
              {workspace.papers.map((p) => (
                <div
                  key={p.id}
                  className="group border border-white/8 rounded-lg p-4 hover:border-white/12 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-medium text-white leading-snug">
                        {p.title}
                      </h3>
                      <p className="text-xs text-white/30 mt-1">
                        {p.authors?.slice(0, 4).join(", ")}
                        {(p.authors?.length ?? 0) > 4 && " et al."}
                        {p.published && ` · ${p.published}`}
                      </p>
                      {p.abstract && (
                        <p className="text-xs text-white/20 mt-2 line-clamp-2 leading-relaxed">
                          {p.abstract}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        {p.url && (
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-white/25 hover:text-white transition-colors"
                            title="View on arXiv"
                          >
                            <HiOutlineExternalLink size={13} />
                          </a>
                        )}
                        {p.pdf_url && (
                          <a
                            href={p.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-white/25 hover:text-white transition-colors"
                            title="View PDF"
                          >
                            <HiOutlineDocumentText size={13} />
                          </a>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => p.id && handleRemovePaper(p.id)}
                      className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 p-1 transition-all"
                      title="Remove from workspace"
                    >
                      <HiOutlineTrash size={14} />
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
        <div className="flex flex-col" style={{ height: "calc(100vh - 260px)" }}>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto mb-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <HiOutlineChatAlt2
                  size={28}
                  className="mx-auto text-white/15 mb-2"
                />
                <p className="text-sm text-white/25">
                  Ask questions about the papers in this workspace
                </p>
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${
                  m.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-white/10 text-white"
                      : "bg-white/5 text-white/80 border border-white/8"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-white/5 border border-white/8 rounded-lg px-4 py-3">
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
                className="flex-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-white/25 transition-colors"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={sending || !chatInput.trim()}
                className="bg-white text-black p-2 rounded-md hover:bg-white/90 disabled:opacity-50 transition-colors"
              >
                <HiOutlinePaperAirplane size={16} className="rotate-90" />
              </button>
            </form>
            <button
              onClick={handleClearChat}
              className="text-white/20 hover:text-red-400 p-2 transition-colors"
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
              className="border border-white/10 rounded-lg p-4 text-left hover:border-white/20 transition-colors disabled:opacity-50"
            >
              <HiOutlineDocumentText
                size={18}
                className="text-white/40 mb-2"
              />
              <p className="text-sm font-medium text-white">Summarize</p>
              <p className="text-xs text-white/30 mt-0.5">
                AI summary of all papers
              </p>
            </button>

            <button
              onClick={() => runAI("insights", "Insights")}
              disabled={aiLoading}
              className="border border-white/10 rounded-lg p-4 text-left hover:border-white/20 transition-colors disabled:opacity-50"
            >
              <HiOutlineLightBulb size={18} className="text-white/40 mb-2" />
              <p className="text-sm font-medium text-white">Insights</p>
              <p className="text-xs text-white/30 mt-0.5">
                Key trends & findings
              </p>
            </button>

            <button
              onClick={() => runAI("litReview", "Literature Review")}
              disabled={aiLoading}
              className="border border-white/10 rounded-lg p-4 text-left hover:border-white/20 transition-colors disabled:opacity-50"
            >
              <HiOutlineBookOpen size={18} className="text-white/40 mb-2" />
              <p className="text-sm font-medium text-white">Lit Review</p>
              <p className="text-xs text-white/30 mt-0.5">
                Formal literature review
              </p>
            </button>
          </div>

          {/* Result area */}
          {aiLoading && (
            <div className="flex items-center gap-2 py-8 justify-center">
              <Spinner />
              <span className="text-sm text-white/40">
                Generating {aiTool}…
              </span>
            </div>
          )}

          {aiResult && !aiLoading && (
            <div className="border border-white/10 rounded-lg p-5">
              <h3 className="text-xs font-medium text-white/50 uppercase tracking-wide mb-3">
                {aiTool}
              </h3>
              <div className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">
                {aiResult}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

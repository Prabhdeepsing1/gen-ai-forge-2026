import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { workspacesAPI, papersAPI, chatAPI, aiAPI } from "@/api";
import type { WorkspaceDetail, Paper, ChatMessage } from "@/types";
import toast from "react-hot-toast";
import { Spinner } from "@/components/Spinner";
import {
  HiOutlineArrowLeft,
  HiOutlineSearch,
  HiOutlinePlus,
  HiOutlineTrash,
  HiOutlineExternalLink,
  HiOutlineDocumentText,
  HiOutlinePaperAirplane,
  HiOutlineLightBulb,
  HiOutlineBookOpen,
  HiOutlineChatAlt2,
  HiOutlineX,
} from "react-icons/hi";

type Tab = "papers" | "chat" | "ai";

export default function WorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const workspaceId = Number(id);

  const [workspace, setWorkspace] = useState<WorkspaceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("papers");

  useEffect(() => {
    workspacesAPI.get(workspaceId)
      .then(setWorkspace)
      .catch(() => { toast.error("Failed to load workspace"); navigate("/dashboard"); })
      .finally(() => setLoading(false));
  }, [workspaceId, navigate]);

  if (loading) return <div className="flex justify-center py-20"><Spinner className="w-7 h-7" /></div>;
  if (!workspace) return null;

  return (
    <div className="max-w-5xl mx-auto fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/dashboard")} className="p-1.5 rounded-lg btn-ghost">
          <HiOutlineArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-foreground">{workspace.name}</h1>
          {workspace.description && <p className="text-sm text-muted-foreground">{workspace.description}</p>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-border mb-6">
        {(["papers", "chat", "ai"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`tab-button ${tab === t ? "active" : ""}`}>
            {t === "papers" ? "Papers" : t === "chat" ? "Chat" : "AI Tools"}
          </button>
        ))}
      </div>

      {tab === "papers" && <PapersTab workspace={workspace} setWorkspace={setWorkspace} />}
      {tab === "chat" && <ChatTab workspaceId={workspaceId} />}
      {tab === "ai" && <AIToolsTab workspaceId={workspaceId} />}
    </div>
  );
}

/* ─── Papers Tab ─── */
function PapersTab({ workspace, setWorkspace }: { workspace: WorkspaceDetail; setWorkspace: (w: WorkspaceDetail) => void }) {
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Paper[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const data = await papersAPI.search(query);
      setResults(data.papers);
    } catch { toast.error("Search failed"); }
    finally { setSearching(false); }
  };

  const handleImport = async (paper: Paper) => {
    try {
      await papersAPI.import({ ...paper, workspace_id: workspace.id });
      const updated = await workspacesAPI.get(workspace.id);
      setWorkspace(updated);
      toast.success("Paper imported");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? "Import failed");
    }
  };

  const handleRemove = async (paperId: number) => {
    if (!confirm("Remove this paper from the workspace?")) return;
    try {
      await workspacesAPI.removePaper(workspace.id, paperId);
      setWorkspace({ ...workspace, papers: workspace.papers.filter((p) => p.id !== paperId) });
      toast.success("Paper removed");
    } catch { toast.error("Failed to remove"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{workspace.papers.length} papers</p>
        <button onClick={() => setShowSearch(!showSearch)} className="btn-ghost flex items-center gap-1.5 text-sm">
          <HiOutlineSearch className="w-4 h-4" />
          Search arXiv
        </button>
      </div>

      {showSearch && (
        <div className="card-interactive p-4 space-y-3 fade-in-up">
          <div className="flex gap-2">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search papers on arXiv…" className="flex-1 input-field"
              onKeyDown={(e) => e.key === "Enter" && handleSearch()} />
            <button onClick={handleSearch} disabled={searching} className="btn-primary flex items-center gap-2">
              {searching ? <Spinner className="w-4 h-4" /> : <HiOutlineSearch className="w-4 h-4" />}
              Search
            </button>
          </div>
          {results.length > 0 && (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {results.map((p, i) => (
                <div key={i} className="flex items-start justify-between gap-3 p-3 rounded-lg bg-surface-2 border border-border">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground line-clamp-1">{p.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {p.authors?.slice(0, 3).join(", ")}{(p.authors?.length ?? 0) > 3 && " et al."}
                    </p>
                  </div>
                  <button onClick={() => handleImport(p)} className="p-1.5 text-primary hover:text-primary-hover transition-colors flex-shrink-0">
                    <HiOutlinePlus className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {workspace.papers.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-xl p-10 text-center">
          <HiOutlineDocumentText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No papers yet. Search arXiv to add some.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {workspace.papers.map((p) => (
            <PaperCard key={p.id} paper={p} onRemove={() => p.id && handleRemove(p.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function PaperCard({ paper, onRemove, onDelete }: { paper: Paper; onRemove?: () => void; onDelete?: () => void }) {
  return (
    <div className="group card-interactive p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground line-clamp-2">{paper.title}</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {paper.authors?.slice(0, 4).join(", ")}{(paper.authors?.length ?? 0) > 4 && " et al."}
            {paper.published && ` · ${paper.published}`}
          </p>
          {paper.abstract && <p className="text-sm text-secondary-foreground mt-2 line-clamp-2">{paper.abstract}</p>}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {paper.url && (
            <a href={paper.url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
              <HiOutlineExternalLink className="w-4 h-4" />
            </a>
          )}
          {paper.pdf_url && (
            <a href={paper.pdf_url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
              <HiOutlineDocumentText className="w-4 h-4" />
            </a>
          )}
          {(onRemove || onDelete) && (
            <button onClick={onRemove ?? onDelete} className="p-1.5 btn-danger-ghost">
              <HiOutlineTrash className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Chat Tab ─── */
function ChatTab({ workspaceId }: { workspaceId: number }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatAPI.history(workspaceId).then(setMessages).catch(() => {}).finally(() => setLoadingHistory(false));
  }, [workspaceId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const content = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content }]);
    setSending(true);
    try {
      const data = await chatAPI.send(content, workspaceId);
      setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
    } catch { toast.error("Failed to get response"); }
    finally { setSending(false); }
  };

  const handleClear = async () => {
    if (!confirm("Clear all chat history?")) return;
    try {
      await chatAPI.clear(workspaceId);
      setMessages([]);
      toast.success("Chat cleared");
    } catch { toast.error("Failed to clear"); }
  };

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 260px)" }}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-4">
        {loadingHistory ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <HiOutlineChatAlt2 className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Ask questions about the papers in this workspace</p>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] px-4 py-3 rounded-xl text-sm whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-secondary-foreground"
              }`}>
                {m.content}
              </div>
            </div>
          ))
        )}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-xl px-4 py-3">
              <Spinner className="w-4 h-4" />
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 pt-3 border-t border-border">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="Ask about your papers…"
          className="flex-1 input-field"
          disabled={sending}
        />
        <button onClick={handleSend} disabled={sending || !input.trim()} className="btn-primary p-2.5">
          <HiOutlinePaperAirplane className="w-4 h-4 rotate-90" />
        </button>
        {messages.length > 0 && (
          <button onClick={handleClear} className="p-2.5 btn-ghost">
            <HiOutlineTrash className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── AI Tools Tab ─── */
function AIToolsTab({ workspaceId }: { workspaceId: number }) {
  const [result, setResult] = useState<{ label: string; content: string } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const tools = [
    { key: "summarize", label: "Summarize", desc: "Generate a summary of all papers", icon: HiOutlineDocumentText, color: "text-primary", borderHover: "hover:border-primary/40" },
    { key: "insights", label: "Insights", desc: "Extract key insights and patterns", icon: HiOutlineLightBulb, color: "text-warning", borderHover: "hover:border-warning/40" },
    { key: "litreview", label: "Literature Review", desc: "Generate a literature review", icon: HiOutlineBookOpen, color: "text-success", borderHover: "hover:border-success/40" },
  ];

  const run = async (key: string) => {
    setLoading(key);
    setResult(null);
    try {
      if (key === "summarize") {
        const d = await aiAPI.summarize(workspaceId);
        setResult({ label: "Summary", content: d.summary });
      } else if (key === "insights") {
        const d = await aiAPI.insights(workspaceId);
        setResult({ label: "Insights", content: d.insights });
      } else {
        const d = await aiAPI.litReview(workspaceId);
        setResult({ label: "Literature Review", content: d.literature_review });
      }
    } catch { toast.error("AI tool failed"); }
    finally { setLoading(null); }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {tools.map((t) => (
          <button
            key={t.key}
            onClick={() => run(t.key)}
            disabled={loading !== null}
            className={`card-interactive p-5 text-left ${t.borderHover} disabled:opacity-50`}
          >
            <t.icon className={`w-6 h-6 ${t.color} mb-3`} />
            <p className="text-sm font-semibold text-foreground">{t.label}</p>
            <p className="text-xs text-muted-foreground mt-1">{t.desc}</p>
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground py-8 justify-center fade-in">
          <Spinner />
          <span>Generating {loading}…</span>
        </div>
      )}

      {result && (
        <div className="card-interactive p-5 fade-in-up">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">{result.label}</span>
            <button onClick={() => setResult(null)} className="p-1 btn-ghost"><HiOutlineX className="w-4 h-4" /></button>
          </div>
          <div className="text-sm text-secondary-foreground whitespace-pre-wrap leading-relaxed">{result.content}</div>
        </div>
      )}
    </div>
  );
}

export { PaperCard };

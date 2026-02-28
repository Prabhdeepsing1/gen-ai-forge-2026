import { useState, useEffect, useRef } from "react";
import { papersAPI } from "@/api";
import type { Paper } from "@/types";
import toast from "react-hot-toast";
import { Spinner } from "@/components/Spinner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  HiOutlineSearch,
  HiOutlineDocumentText,
  HiOutlineX,
  HiOutlineChevronDown,
  HiOutlineArrowLeft,
} from "react-icons/hi";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

/* ── Paper Card (clickable, no + button) ─────────────────────────────────── */
function PaperChatCard({
  paper,
  onClick,
}: {
  paper: Paper;
  onClick: () => void;
}) {
  const [showAbstract, setShowAbstract] = useState(false);

  return (
    <div
      className="card-interactive p-4 cursor-pointer hover:border-primary/40 transition-all group"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
            {paper.title}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {paper.authors?.slice(0, 3).join(", ")}
            {(paper.authors?.length ?? 0) > 3 && " et al."}
            {paper.published && (
              <span className="ml-2 text-muted-foreground/70">
                · {paper.published}
              </span>
            )}
          </p>
        </div>
        <span className="text-xs text-primary/60 bg-primary/5 px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5">
          Chat →
        </span>
      </div>

      {paper.abstract && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowAbstract(!showAbstract);
            }}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground mt-2 transition-colors"
          >
            <HiOutlineChevronDown
              className={`w-3 h-3 transition-transform ${showAbstract ? "rotate-180" : ""}`}
            />
            Abstract
          </button>
          <div
            className={`overflow-hidden transition-all duration-300 ${
              showAbstract ? "max-h-40 mt-1" : "max-h-0"
            }`}
          >
            <p className="text-xs text-muted-foreground leading-relaxed overflow-y-auto max-h-36">
              {paper.abstract}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Chat with Paper Panel ───────────────────────────────────────────────── */
function PaperChatPanel({
  paper,
  onClose,
}: {
  paper: Paper;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: ChatMsg = { role: "user", content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setSending(true);

    // Add an empty assistant message that we'll stream into
    const assistantIdx = updatedMessages.length;
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    await papersAPI.chatStream(
      paper,
      text,
      updatedMessages.map((m) => ({ role: m.role, content: m.content })),
      // onToken — append each token to the streaming message
      (token: string) => {
        setMessages((prev) => {
          const updated = [...prev];
          updated[assistantIdx] = {
            ...updated[assistantIdx],
            content: updated[assistantIdx].content + token,
          };
          return updated;
        });
      },
      // onDone
      () => setSending(false),
      // onError
      (err: string) => {
        toast.error("Failed to get response");
        setMessages((prev) => {
          const updated = [...prev];
          updated[assistantIdx] = {
            ...updated[assistantIdx],
            content: updated[assistantIdx].content || "Sorry, something went wrong. Please try again.",
          };
          return updated;
        });
        setSending(false);
      }
    );
  };

  return (
    <div className="flex flex-col h-full fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border bg-surface-2/50">
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-surface-2 transition-colors text-muted-foreground hover:text-foreground"
        >
          <HiOutlineArrowLeft className="w-4 h-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-foreground line-clamp-1">
            {paper.title}
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {paper.authors?.slice(0, 3).join(", ")}
            {(paper.authors?.length ?? 0) > 3 && " et al."}
          </p>
        </div>
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Initial context card */}
        <div className="bg-primary/5 border border-primary/10 rounded-lg p-3">
          <p className="text-xs font-medium text-primary mb-1">Paper Context</p>
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">
            {paper.abstract || "No abstract available."}
          </p>
          <p className="text-[11px] text-muted-foreground/60 mt-2">
            Ask anything about this paper — methods, findings, implications, etc.
          </p>
        </div>

        {messages.length === 0 && (
          <div className="text-center py-8">
            <HiOutlineDocumentText className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Start a conversation about this paper
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-3">
              {[
                "Summarize this paper",
                "What methods are used?",
                "Key findings?",
                "Limitations?",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    setInput(q);
                  }}
                  className="text-xs px-3 py-1.5 rounded-full bg-surface-2 border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface-2 border border-border text-foreground"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </ReactMarkdown>
                  {sending && i === messages.length - 1 && (
                    <span className="inline-block w-1.5 h-4 bg-primary/60 animate-pulse ml-0.5 align-text-bottom rounded-sm" />
                  )}
                </div>
              ) : (
                <p>{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {sending && messages[messages.length - 1]?.content === "" && (
          <div className="flex justify-start">
            <div className="bg-surface-2 border border-border rounded-lg px-4 py-3">
              <Spinner className="w-4 h-4" />
            </div>
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="p-3 border-t border-border bg-surface-2/30">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this paper…"
            className="flex-1 input-field text-sm"
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            disabled={sending}
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="btn-primary px-4 text-sm disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Papers Page ────────────────────────────────────────────────────── */
export default function Papers() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Paper[]>([]);
  const [searching, setSearching] = useState(false);
  const [chatPaper, setChatPaper] = useState<Paper | null>(null);

  useEffect(() => {
    papersAPI
      .my()
      .then(setPapers)
      .catch(() => toast.error("Failed to load papers"))
      .finally(() => setLoading(false));
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const data = await papersAPI.search(query);
      setResults(data.papers);
    } catch {
      toast.error("Search failed");
    } finally {
      setSearching(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this paper permanently?")) return;
    try {
      await papersAPI.delete(id);
      setPapers((prev) => prev.filter((p) => p.id !== id));
      toast.success("Paper deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  // ── If a paper is selected for chat, show the chat panel ──
  if (chatPaper) {
    return (
      <div className="max-w-3xl mx-auto h-[calc(100vh-6rem)] flex flex-col fade-in">
        <PaperChatPanel paper={chatPaper} onClose={() => setChatPaper(null)} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto fade-in">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold text-foreground">Papers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Click any paper to chat with it
          </p>
        </div>
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="btn-primary flex items-center gap-1.5 text-sm"
        >
          <HiOutlineSearch className="w-4 h-4" />
          Search arXiv
        </button>
      </div>

      {showSearch && (
        <div className="card-interactive p-4 space-y-3 mb-6 fade-in-up">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search papers on arXiv…"
              className="flex-1 input-field"
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <button
              onClick={handleSearch}
              disabled={searching}
              className="btn-primary flex items-center gap-2"
            >
              {searching ? (
                <Spinner className="w-4 h-4" />
              ) : (
                <HiOutlineSearch className="w-4 h-4" />
              )}
              Search
            </button>
          </div>
          {results.length > 0 && (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              <p className="text-xs text-muted-foreground">
                Click a result to chat with it
              </p>
              {results.map((p, i) => (
                <div
                  key={i}
                  onClick={() => setChatPaper(p)}
                  className="flex items-start gap-3 p-3 rounded-lg bg-surface-2 border border-border cursor-pointer hover:border-primary/40 transition-all group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                      {p.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {p.authors?.slice(0, 3).join(", ")}
                      {(p.authors?.length ?? 0) > 3 && " et al."}
                    </p>
                  </div>
                  <span className="text-xs text-primary/60 bg-primary/5 px-2 py-0.5 rounded-full flex-shrink-0">
                    Chat →
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner className="w-7 h-7" />
        </div>
      ) : papers.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-xl p-12 text-center">
          <HiOutlineDocumentText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            No papers yet. Search arXiv to find papers and chat with them.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {papers.map((p, i) => (
            <div
              key={p.id ?? i}
              className="fade-in-up"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <PaperChatCard paper={p} onClick={() => setChatPaper(p)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

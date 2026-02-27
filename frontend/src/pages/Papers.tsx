import { useState, useEffect } from "react";
import { papersAPI } from "@/api";
import type { Paper } from "@/types";
import toast from "react-hot-toast";
import { Spinner } from "@/components/Spinner";
import { PaperCard } from "./Workspace";
import {
  HiOutlineSearch,
  HiOutlineDocumentText,
  HiOutlinePlus,
} from "react-icons/hi";

export default function Papers() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Paper[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    papersAPI.my().then(setPapers).catch(() => toast.error("Failed to load papers")).finally(() => setLoading(false));
  }, []);

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
      const res = await papersAPI.import(paper);
      setPapers((prev) => [{ ...paper, id: res.paper?.id }, ...prev]);
      toast.success("Paper imported");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? "Import failed");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this paper permanently?")) return;
    try {
      await papersAPI.delete(id);
      setPapers((prev) => prev.filter((p) => p.id !== id));
      toast.success("Paper deleted");
    } catch { toast.error("Failed to delete"); }
  };

  return (
    <div className="max-w-4xl mx-auto fade-in">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold text-foreground">Papers</h1>
          <p className="text-sm text-muted-foreground mt-1">Your imported research paper library</p>
        </div>
        <button onClick={() => setShowSearch(!showSearch)} className="btn-primary flex items-center gap-1.5 text-sm">
          <HiOutlineSearch className="w-4 h-4" />
          Search arXiv
        </button>
      </div>

      {showSearch && (
        <div className="card-interactive p-4 space-y-3 mb-6 fade-in-up">
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

      {loading ? (
        <div className="flex justify-center py-20"><Spinner className="w-7 h-7" /></div>
      ) : papers.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-xl p-12 text-center">
          <HiOutlineDocumentText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No papers yet. Search arXiv to import.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {papers.map((p, i) => (
            <div key={p.id ?? i} className="fade-in-up" style={{ animationDelay: `${i * 40}ms` }}>
              <PaperCard paper={p} onDelete={() => p.id && handleDelete(p.id)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

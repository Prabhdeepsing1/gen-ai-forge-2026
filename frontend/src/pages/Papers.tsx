import { useEffect, useState, type FormEvent } from "react";
import { papersAPI } from "../api";
import type { Paper } from "../types";
import toast from "react-hot-toast";
import Spinner from "../components/Spinner";
import {
  HiOutlineSearch,
  HiOutlineTrash,
  HiOutlineExternalLink,
  HiOutlineDocumentText,
  HiOutlinePlus,
} from "react-icons/hi";

export default function Papers() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);

  // Search
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Paper[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const fetchPapers = async () => {
    try {
      const { data } = await papersAPI.my();
      setPapers(data.papers);
    } catch {
      toast.error("Failed to load papers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPapers();
  }, []);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const { data } = await papersAPI.search(query.trim());
      setResults(data.papers);
    } catch {
      toast.error("Search failed");
    } finally {
      setSearching(false);
    }
  };

  const handleImport = async (paper: Paper) => {
    try {
      await papersAPI.import(paper);
      toast.success("Paper imported");
      fetchPapers();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? "Import failed");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this paper?")) return;
    try {
      await papersAPI.delete(id);
      toast.success("Paper deleted");
      setPapers((p) => p.filter((x) => x.id !== id));
    } catch {
      toast.error("Failed to delete paper");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-white">Papers</h1>
          <p className="text-sm text-white/40 mt-0.5">
            Your imported research paper library
          </p>
        </div>
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="flex items-center gap-1.5 bg-white text-black text-xs font-medium px-3 py-1.5 rounded-md hover:bg-white/90 transition-colors"
        >
          <HiOutlineSearch size={14} />
          Search arXiv
        </button>
      </div>

      {/* Search panel */}
      {showSearch && (
        <div className="border border-white/10 rounded-lg p-4 mb-6">
          <form onSubmit={handleSearch} className="flex gap-2 mb-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search papers on arXiv…"
              className="flex-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-white/25 transition-colors"
              autoFocus
            />
            <button
              type="submit"
              disabled={searching || !query.trim()}
              className="bg-white text-black text-xs font-medium px-3 py-2 rounded-md hover:bg-white/90 disabled:opacity-50 transition-colors"
            >
              {searching ? "…" : "Search"}
            </button>
          </form>

          {results.length > 0 && (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {results.map((p, i) => (
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
      {papers.length === 0 ? (
        <div className="text-center py-16 text-white/25 text-sm">
          No papers yet. Search arXiv to import some.
        </div>
      ) : (
        <div className="space-y-2">
          {papers.map((p) => (
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
                        className="text-white/25 hover:text-white transition-colors"
                      >
                        <HiOutlineExternalLink size={13} />
                      </a>
                    )}
                    {p.pdf_url && (
                      <a
                        href={p.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white/25 hover:text-white transition-colors"
                      >
                        <HiOutlineDocumentText size={13} />
                      </a>
                    )}
                    <span className="text-xs text-white/15 ml-1">
                      {p.source}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => p.id && handleDelete(p.id)}
                  className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 p-1 transition-all"
                  title="Delete paper"
                >
                  <HiOutlineTrash size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

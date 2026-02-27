import { useState, useEffect } from "react";
import { uploadAPI } from "@/api";
import type { UploadedDocument } from "@/types";
import toast from "react-hot-toast";
import { Spinner } from "@/components/Spinner";
import {
  HiOutlineUpload,
  HiOutlineDocumentText,
  HiOutlineTrash,
  HiOutlineX,
  HiOutlineChevronDown,
} from "react-icons/hi";

export default function Documents() {
  const [docs, setDocs] = useState<UploadedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<UploadedDocument | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    uploadAPI.list().then(setDocs).catch(() => toast.error("Failed to load documents")).finally(() => setLoading(false));
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadAPI.pdf(file);
      setDocs((prev) => [{ id: res.id, filename: res.filename, summary: res.summary, created_at: new Date().toISOString() }, ...prev]);
      toast.success("PDF uploaded & processed");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleExpand = async (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
      setShowText(false);
      return;
    }
    setExpandedId(id);
    setLoadingDetail(true);
    setShowText(false);
    try {
      const d = await uploadAPI.get(id);
      setDetail(d);
    } catch { toast.error("Failed to load document"); }
    finally { setLoadingDetail(false); }
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm("Delete this document?")) return;
    try {
      await uploadAPI.delete(id);
      setDocs((prev) => prev.filter((d) => d.id !== id));
      if (expandedId === id) { setExpandedId(null); setDetail(null); }
      toast.success("Document deleted");
    } catch { toast.error("Failed to delete"); }
  };

  return (
    <div className="max-w-4xl mx-auto fade-in">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold text-foreground">Documents</h1>
          <p className="text-sm text-muted-foreground mt-1">Upload PDFs for AI text extraction & summarization</p>
        </div>
        <label className={`btn-primary flex items-center gap-1.5 text-sm cursor-pointer ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
          {uploading ? <Spinner className="w-4 h-4" /> : <HiOutlineUpload className="w-4 h-4" />}
          {uploading ? "Processing…" : "Upload PDF"}
          <input type="file" accept=".pdf" onChange={handleUpload} className="hidden" />
        </label>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner className="w-7 h-7" /></div>
      ) : docs.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-xl p-12 text-center">
          <HiOutlineDocumentText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No documents yet. Upload a PDF to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {docs.map((doc, i) => (
            <div key={doc.id} className="fade-in-up" style={{ animationDelay: `${i * 40}ms` }}>
              <div
                onClick={() => handleExpand(doc.id)}
                className="group card-interactive p-5 cursor-pointer"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-foreground">{doc.filename}</h3>
                    {doc.summary && <p className="text-sm text-secondary-foreground mt-1 line-clamp-2">{doc.summary}</p>}
                    <p className="text-xs text-muted-foreground mt-2">{new Date(doc.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={(e) => handleDelete(e, doc.id)} className="opacity-0 group-hover:opacity-100 p-1.5 btn-danger-ghost transition-all">
                      <HiOutlineTrash className="w-4 h-4" />
                    </button>
                    <HiOutlineChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expandedId === doc.id ? "rotate-180" : ""}`} />
                  </div>
                </div>
              </div>

              {expandedId === doc.id && (
                <div className="bg-surface-2 border border-border border-t-0 rounded-b-xl p-5 fade-in">
                  {loadingDetail ? (
                    <div className="flex justify-center py-6"><Spinner /></div>
                  ) : detail ? (
                    <div className="space-y-4">
                      {detail.summary && (
                        <div>
                          <span className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">AI Summary</span>
                          <p className="text-sm text-secondary-foreground mt-2 whitespace-pre-wrap leading-relaxed">{detail.summary}</p>
                        </div>
                      )}
                      {detail.content && (
                        <div>
                          <button onClick={() => setShowText(!showText)} className="text-xs text-primary hover:text-primary-hover font-medium transition-colors">
                            {showText ? "Hide extracted text" : "Show extracted text"}
                          </button>
                          {showText && (
                            <pre className="mt-2 text-xs text-muted-foreground bg-surface-3 rounded-lg p-4 max-h-64 overflow-y-auto whitespace-pre-wrap font-mono">
                              {detail.content}
                            </pre>
                          )}
                        </div>
                      )}
                      <button onClick={() => { setExpandedId(null); setDetail(null); }} className="btn-ghost text-xs flex items-center gap-1">
                        <HiOutlineX className="w-3.5 h-3.5" /> Close
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

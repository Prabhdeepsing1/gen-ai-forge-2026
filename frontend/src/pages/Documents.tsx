import { useEffect, useState, useRef } from "react";
import { uploadAPI } from "../api";
import type { UploadedDocument } from "../types";
import toast from "react-hot-toast";
import Spinner from "../components/Spinner";
import {
  HiOutlineUpload,
  HiOutlineTrash,
  HiOutlineDocumentText,
  HiOutlineX,
} from "react-icons/hi";

export default function Documents() {
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<UploadedDocument | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = async () => {
    try {
      const { data } = await uploadAPI.list();
      setDocuments(data.documents);
    } catch {
      toast.error("Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Only PDF files are accepted");
      return;
    }
    setUploading(true);
    try {
      await uploadAPI.pdf(file);
      toast.success("PDF uploaded & processed");
      fetchDocuments();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this document?")) return;
    try {
      await uploadAPI.delete(id);
      toast.success("Document deleted");
      setDocuments((d) => d.filter((doc) => doc.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch {
      toast.error("Failed to delete document");
    }
  };

  const handleView = async (doc: UploadedDocument) => {
    if (selected?.id === doc.id) {
      setSelected(null);
      return;
    }
    setDetailLoading(true);
    try {
      const { data } = await uploadAPI.get(doc.id);
      setSelected(data);
    } catch {
      toast.error("Failed to load document");
    } finally {
      setDetailLoading(false);
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
          <h1 className="text-lg font-semibold text-white">Documents</h1>
          <p className="text-sm text-white/40 mt-0.5">
            Upload PDFs for AI text extraction &amp; summarization
          </p>
        </div>
        <label className="flex items-center gap-1.5 bg-white text-black text-xs font-medium px-3 py-1.5 rounded-md hover:bg-white/90 transition-colors cursor-pointer">
          <HiOutlineUpload size={14} />
          {uploading ? "Uploading…" : "Upload PDF"}
          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      </div>

      {/* Drag-drop hint */}
      {documents.length === 0 && (
        <div className="text-center py-16 border border-dashed border-white/10 rounded-lg">
          <HiOutlineDocumentText
            size={28}
            className="mx-auto text-white/15 mb-2"
          />
          <p className="text-sm text-white/25">
            No documents yet. Upload a PDF to get started.
          </p>
        </div>
      )}

      {/* Document list */}
      <div className="space-y-2">
        {documents.map((doc) => (
          <div key={doc.id}>
            <div
              className="group border border-white/8 rounded-lg p-4 hover:border-white/12 transition-colors cursor-pointer"
              onClick={() => handleView(doc)}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-medium text-white truncate">
                    {doc.filename}
                  </h3>
                  {doc.summary && (
                    <p className="text-xs text-white/30 mt-1 line-clamp-2">
                      {doc.summary}
                    </p>
                  )}
                  <p className="text-xs text-white/20 mt-1">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(doc.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 p-1 transition-all"
                  title="Delete document"
                >
                  <HiOutlineTrash size={14} />
                </button>
              </div>
            </div>

            {/* Expanded detail */}
            {selected?.id === doc.id && (
              <div className="border border-white/10 border-t-0 rounded-b-lg p-4 -mt-0.5">
                {detailLoading ? (
                  <div className="flex justify-center py-4">
                    <Spinner />
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-medium text-white/50 uppercase tracking-wide">
                        AI Summary
                      </h4>
                      <button
                        onClick={() => setSelected(null)}
                        className="text-white/25 hover:text-white transition-colors"
                      >
                        <HiOutlineX size={14} />
                      </button>
                    </div>
                    {selected.summary && (
                      <p className="text-sm text-white/60 leading-relaxed whitespace-pre-wrap mb-4">
                        {selected.summary}
                      </p>
                    )}
                    {selected.content && (
                      <details className="mt-2">
                        <summary className="text-xs text-white/30 cursor-pointer hover:text-white/50 transition-colors">
                          Show extracted text
                        </summary>
                        <pre className="mt-2 text-xs text-white/25 max-h-60 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                          {selected.content}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

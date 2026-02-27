import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { workspacesAPI } from "../api";
import type { Workspace } from "../types";
import toast from "react-hot-toast";
import Spinner from "../components/Spinner";
import { HiOutlinePlus, HiOutlineTrash } from "react-icons/hi";

export default function Dashboard() {
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchWorkspaces = async () => {
    try {
      const { data } = await workspacesAPI.list();
      setWorkspaces(data.workspaces);
    } catch {
      toast.error("Failed to load workspaces");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      await workspacesAPI.create(name.trim(), desc.trim() || undefined);
      toast.success("Workspace created");
      setName("");
      setDesc("");
      setShowCreate(false);
      fetchWorkspaces();
    } catch {
      toast.error("Failed to create workspace");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number, wsName: string) => {
    if (!confirm(`Delete "${wsName}"? This cannot be undone.`)) return;
    try {
      await workspacesAPI.delete(id);
      toast.success("Workspace deleted");
      setWorkspaces((ws) => ws.filter((w) => w.id !== id));
    } catch {
      toast.error("Failed to delete workspace");
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
          <h1 className="text-lg font-semibold text-white">Workspaces</h1>
          <p className="text-sm text-white/40 mt-0.5">
            Organize your research papers into workspaces
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 bg-white text-black text-xs font-medium px-3 py-1.5 rounded-md hover:bg-white/90 transition-colors"
        >
          <HiOutlinePlus size={14} />
          New
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="mb-6 border border-white/10 rounded-lg p-4 space-y-3"
        >
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Workspace name"
            className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-white/25 transition-colors"
            autoFocus
          />
          <input
            type="text"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Description (optional)"
            className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-white/25 transition-colors"
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="text-xs text-white/40 hover:text-white px-3 py-1.5 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !name.trim()}
              className="bg-white text-black text-xs font-medium px-3 py-1.5 rounded-md hover:bg-white/90 disabled:opacity-50 transition-colors"
            >
              {creating ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      )}

      {/* Workspace list */}
      {workspaces.length === 0 ? (
        <div className="text-center py-16 text-white/30 text-sm">
          No workspaces yet. Create one to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              className="group border border-white/8 rounded-lg p-4 hover:border-white/15 transition-colors cursor-pointer"
              onClick={() => navigate(`/workspace/${ws.id}`)}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-medium text-white truncate">
                    {ws.name}
                  </h3>
                  {ws.description && (
                    <p className="text-xs text-white/35 mt-0.5 truncate">
                      {ws.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-white/25">
                    <span>{ws.paper_count ?? 0} papers</span>
                    <span>
                      {new Date(ws.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(ws.id, ws.name);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-white/25 hover:text-red-400 p-1 transition-all"
                  title="Delete workspace"
                >
                  <HiOutlineTrash size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

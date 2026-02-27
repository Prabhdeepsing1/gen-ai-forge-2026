import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { workspacesAPI } from "@/api";
import type { Workspace } from "@/types";
import toast from "react-hot-toast";
import { Spinner } from "@/components/Spinner";
import { HiOutlinePlus, HiOutlineTrash, HiOutlineViewGrid } from "react-icons/hi";

export default function Dashboard() {
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    workspacesAPI.list().then(setWorkspaces).catch(() => toast.error("Failed to load workspaces")).finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const ws = await workspacesAPI.create(name.trim(), desc.trim() || undefined);
      setWorkspaces((prev) => [ws, ...prev]);
      setName("");
      setDesc("");
      setShowCreate(false);
      toast.success("Workspace created");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? "Failed to create workspace");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm("Delete this workspace? This cannot be undone.")) return;
    try {
      await workspacesAPI.delete(id);
      setWorkspaces((prev) => prev.filter((w) => w.id !== id));
      toast.success("Workspace deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  return (
    <div className="max-w-4xl mx-auto fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold text-foreground">Workspaces</h1>
          <p className="text-sm text-muted-foreground mt-1">Organize your research papers into workspaces</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary flex items-center gap-1.5 text-sm">
          <HiOutlinePlus className="w-4 h-4" />
          New
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="card-interactive p-5 mb-6 fade-in-up">
          <div className="space-y-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Workspace name" className="w-full input-field" autoFocus />
            <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description (optional)" className="w-full input-field" />
            <div className="flex items-center gap-2 justify-end">
              <button onClick={() => setShowCreate(false)} className="btn-ghost">Cancel</button>
              <button onClick={handleCreate} disabled={creating || !name.trim()} className="btn-primary flex items-center gap-2">
                {creating && <Spinner className="w-4 h-4" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex justify-center py-20"><Spinner className="w-7 h-7" /></div>
      ) : workspaces.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-xl p-12 text-center fade-in">
          <HiOutlineViewGrid className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No workspaces yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {workspaces.map((ws, i) => (
            <div
              key={ws.id}
              onClick={() => navigate(`/workspace/${ws.id}`)}
              className="group card-interactive p-5 cursor-pointer fade-in-up"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-foreground">{ws.name}</h3>
                  {ws.description && <p className="text-sm text-muted-foreground mt-0.5 truncate">{ws.description}</p>}
                  <div className="flex items-center gap-3 mt-2.5">
                    <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                      {ws.paper_count ?? 0} papers
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(ws.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => handleDelete(e, ws.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 btn-danger-ghost transition-all"
                >
                  <HiOutlineTrash className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

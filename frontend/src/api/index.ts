import axios from "axios";
import type {
  AuthResponse,
  User,
  Workspace,
  WorkspaceDetail,
  Paper,
  ChatMessage,
  UploadedDocument,
  AISummaryResponse,
  AIInsightsResponse,
  AILitReviewResponse,
} from "../types";

// ── Axios instance ───────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: "http://127.0.0.1:8000",
  headers: { "Content-Type": "application/json" },
});

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      // only redirect if not already on auth pages
      if (
        !window.location.pathname.startsWith("/login") &&
        !window.location.pathname.startsWith("/register")
      ) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────

export const authAPI = {
  register: (email: string, username: string, password: string) =>
    api.post<AuthResponse>("/auth/register", { email, username, password }),

  login: (email: string, password: string) => {
    const form = new URLSearchParams();
    form.append("username", email); // backend uses OAuth2 form with "username" field
    form.append("password", password);
    return api.post<AuthResponse>("/auth/login", form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  },

  me: () => api.get<User>("/auth/me"),
};

// ── Workspaces ───────────────────────────────────────────────────────────────

export const workspacesAPI = {
  list: () => api.get<{ workspaces: Workspace[] }>("/workspaces/"),

  get: (id: number) => api.get<WorkspaceDetail>(`/workspaces/${id}`),

  create: (name: string, description?: string) =>
    api.post<Workspace>("/workspaces/", { name, description }),

  update: (id: number, data: { name?: string; description?: string }) =>
    api.put(`/workspaces/${id}`, data),

  delete: (id: number) => api.delete(`/workspaces/${id}`),

  addPaper: (workspaceId: number, paperId: number) =>
    api.post(`/workspaces/${workspaceId}/papers`, { paper_id: paperId }),

  removePaper: (workspaceId: number, paperId: number) =>
    api.delete(`/workspaces/${workspaceId}/papers/${paperId}`),
};

// ── Papers ───────────────────────────────────────────────────────────────────

export const papersAPI = {
  search: (query: string, maxResults = 10) =>
    api.get<{ papers: Paper[]; total: number; query: string }>(
      `/papers/search`,
      { params: { query, max_results: maxResults } }
    ),

  import: (paper: Partial<Paper> & { workspace_id?: number }) =>
    api.post("/papers/import", paper),

  my: () => api.get<{ papers: Paper[] }>("/papers/my"),

  delete: (id: number) => api.delete(`/papers/${id}`),
};

// ── Chat ─────────────────────────────────────────────────────────────────────

export const chatAPI = {
  send: (content: string, workspaceId: number) =>
    api.post<{ response: string; workspace_id: number }>("/chat/", {
      content,
      workspace_id: workspaceId,
    }),

  history: (workspaceId: number, limit = 50) =>
    api.get<ChatMessage[]>(`/chat/history/${workspaceId}`, {
      params: { limit },
    }),

  clear: (workspaceId: number) =>
    api.delete(`/chat/history/${workspaceId}`),
};

// ── AI Tools ─────────────────────────────────────────────────────────────────

export const aiAPI = {
  summarize: (workspaceId: number) =>
    api.post<AISummaryResponse>("/ai/summarize", {
      workspace_id: workspaceId,
    }),

  insights: (workspaceId: number) =>
    api.post<AIInsightsResponse>("/ai/insights", {
      workspace_id: workspaceId,
    }),

  litReview: (workspaceId: number) =>
    api.post<AILitReviewResponse>("/ai/literature-review", {
      workspace_id: workspaceId,
    }),
};

// ── Upload ───────────────────────────────────────────────────────────────────

export const uploadAPI = {
  pdf: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post<{
      id: number;
      filename: string;
      summary: string;
      page_count: number;
      text_length: number;
    }>("/upload/pdf", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  list: () => api.get<{ documents: UploadedDocument[] }>("/upload/documents"),

  get: (id: number) => api.get<UploadedDocument>(`/upload/documents/${id}`),

  delete: (id: number) => api.delete(`/upload/documents/${id}`),
};

export default api;

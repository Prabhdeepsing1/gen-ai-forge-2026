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
} from "@/types";

const api = axios.create({
  baseURL: "http://127.0.0.1:8000",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const path = window.location.pathname;
      if (!["/login", "/register"].includes(path)) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  register: (email: string, username: string, password: string) =>
    api.post<AuthResponse>("/auth/register", { email, username, password }).then((r) => r.data),
  login: (email: string, password: string) => {
    const params = new URLSearchParams();
    params.append("username", email);
    params.append("password", password);
    return api
      .post<AuthResponse>("/auth/login", params, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      })
      .then((r) => r.data);
  },
  me: () => api.get<User>("/auth/me").then((r) => r.data),
};

export const workspacesAPI = {
  list: () => api.get<{ workspaces: Workspace[] }>("/workspaces/").then((r) => r.data.workspaces),
  get: (id: number) => api.get<WorkspaceDetail>(`/workspaces/${id}`).then((r) => r.data),
  create: (name: string, description?: string) =>
    api.post<Workspace>("/workspaces/", { name, description }).then((r) => r.data),
  update: (id: number, data: { name?: string; description?: string }) =>
    api.put(`/workspaces/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/workspaces/${id}`).then((r) => r.data),
  addPaper: (workspaceId: number, paperId: number) =>
    api.post(`/workspaces/${workspaceId}/papers`, { paper_id: paperId }).then((r) => r.data),
  removePaper: (workspaceId: number, paperId: number) =>
    api.delete(`/workspaces/${workspaceId}/papers/${paperId}`).then((r) => r.data),
};

export const papersAPI = {
  search: (query: string, maxResults = 10) =>
    api.get<{ papers: Paper[]; total: number; query: string }>(`/papers/search?query=${encodeURIComponent(query)}&max_results=${maxResults}`).then((r) => r.data),
  import: (paper: Partial<Paper> & { workspace_id?: number }) =>
    api.post("/papers/import", paper).then((r) => r.data),
  my: () => api.get<{ papers: Paper[] }>("/papers/my").then((r) => r.data.papers),
  delete: (id: number) => api.delete(`/papers/${id}`).then((r) => r.data),
};

export const chatAPI = {
  send: (content: string, workspaceId: number) =>
    api.post<{ response: string; workspace_id: number }>("/chat/", { content, workspace_id: workspaceId }).then((r) => r.data),
  history: (workspaceId: number, limit = 50) =>
    api.get<ChatMessage[]>(`/chat/history/${workspaceId}?limit=${limit}`).then((r) => r.data),
  clear: (workspaceId: number) => api.delete(`/chat/history/${workspaceId}`).then((r) => r.data),
};

export const aiAPI = {
  summarize: (workspaceId: number) =>
    api.post<AISummaryResponse>("/ai/summarize", { workspace_id: workspaceId }).then((r) => r.data),
  insights: (workspaceId: number) =>
    api.post<AIInsightsResponse>("/ai/insights", { workspace_id: workspaceId }).then((r) => r.data),
  litReview: (workspaceId: number) =>
    api.post<AILitReviewResponse>("/ai/literature-review", { workspace_id: workspaceId }).then((r) => r.data),
  analysisHistory: (workspaceId: number) =>
    api.get(`/ai/history/${workspaceId}`),
};

export const semanticSearchAPI = {
  search: (workspaceId: number, query: string, topK = 5) =>
    api.post(`/semantic-search/workspace/${workspaceId}`, { query, top_k: topK }),
};

export const uploadAPI = {
  pdf: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post("/upload/pdf", fd, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
  },
  list: () => api.get<{ documents: UploadedDocument[] }>("/upload/documents").then((r) => r.data.documents),
  get: (id: number) => api.get<UploadedDocument>(`/upload/documents/${id}`).then((r) => r.data),
  delete: (id: number) => api.delete(`/upload/documents/${id}`).then((r) => r.data),
};

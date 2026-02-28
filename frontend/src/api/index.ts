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
  chatStream: async (
    paper: { title: string; abstract?: string | null; authors?: string[] | null },
    message: string,
    history: { role: string; content: string }[] = [],
    onToken: (token: string) => void,
    onDone: () => void,
    onError: (err: string) => void,
  ) => {
    const token = localStorage.getItem("token");
    const res = await fetch("http://127.0.0.1:8000/papers/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        title: paper.title,
        abstract: paper.abstract ?? "",
        authors: paper.authors ?? [],
        message,
        history,
      }),
    });

    if (!res.ok || !res.body) {
      onError("Failed to connect");
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const payload = trimmed.slice(6);
        if (payload === "[DONE]") {
          onDone();
          return;
        }
        try {
          const parsed = JSON.parse(payload);
          if (parsed.error) {
            onError(parsed.error);
            return;
          }
          if (parsed.token) onToken(parsed.token);
        } catch {
          // skip malformed chunks
        }
      }
    }
    onDone();
  },
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

export const buildPaperAPI = {
  refineQuery: (userTopic: string) =>
    api.post<{ original: string; refined_query: string }>("/build-paper/refine-query", { user_topic: userTopic }).then((r) => r.data),

  searchArxiv: (query: string, maxResults = 20) =>
    api.get<{ papers: Paper[]; total: number; query: string }>(`/build-paper/search?query=${encodeURIComponent(query)}&max_results=${maxResults}`).then((r) => r.data),

  generatePaper: async (
    topic: string,
    papers: { title: string; authors?: string[] | null; abstract?: string | null; published?: string | null; url?: string | null }[],
    onSection: (section: string) => void,
    onContent: (html: string) => void,
    onDone: () => void,
    onError: (msg: string) => void,
    onPlan?: (text: string) => void,
    onReasoning?: (text: string) => void,
  ) => {
    const token = localStorage.getItem("token");
    const res = await fetch("http://127.0.0.1:8000/build-paper/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ topic, papers }),
    });

    if (!res.ok || !res.body) {
      onError("Failed to connect to paper generation service");
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const payload = trimmed.slice(6);
        try {
          const parsed = JSON.parse(payload);
          if (parsed.type === "section") onSection(parsed.section);
          else if (parsed.type === "content") onContent(parsed.html);
          else if (parsed.type === "plan") onPlan?.(parsed.text);
          else if (parsed.type === "reasoning") onReasoning?.(parsed.text);
          else if (parsed.type === "done") { onDone(); return; }
          else if (parsed.type === "error") { onError(parsed.message); return; }
        } catch {
          // skip malformed chunks
        }
      }
    }
    onDone();
  },
};

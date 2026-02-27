// ── Auth ──────────────────────────────────────────────────────────────────────

export interface User {
  id: number;
  email: string;
  username: string;
  is_active?: boolean;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

// ── Workspaces ───────────────────────────────────────────────────────────────

export interface Workspace {
  id: number;
  name: string;
  description: string | null;
  paper_count?: number;
  created_at: string;
  updated_at?: string;
}

export interface WorkspaceDetail extends Workspace {
  papers: Paper[];
}

// ── Papers ───────────────────────────────────────────────────────────────────

export interface Paper {
  id?: number;
  external_id?: string;
  title: string;
  authors: string[] | null;
  abstract: string | null;
  published: string | null;
  source: string;
  url: string | null;
  pdf_url: string | null;
  added_at?: string;
}

// ── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id?: number;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
}

// ── Documents ────────────────────────────────────────────────────────────────

export interface UploadedDocument {
  id: number;
  filename: string;
  content?: string;
  summary: string | null;
  created_at: string;
}

// ── AI Tools ─────────────────────────────────────────────────────────────────

export interface AISummaryResponse {
  summary: string;
  paper_count: number;
}

export interface AIInsightsResponse {
  insights: string;
  paper_count: number;
}

export interface AILitReviewResponse {
  literature_review: string;
  paper_count: number;
}

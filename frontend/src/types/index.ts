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

export interface ChatMessage {
  id?: number;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
}

export interface UploadedDocument {
  id: number;
  filename: string;
  content?: string;
  summary: string | null;
  created_at: string;
}

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

export interface SemanticSearchResult {
  paper_id: number;
  title: string;
  abstract: string | null;
  similarity: number;
}

export interface AnalysisResult {
  id: number;
  analysis_type: string;
  result: string;
  paper_ids: number[] | null;
  created_at: string;
}

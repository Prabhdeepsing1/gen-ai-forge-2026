# Gen AI Forge 2026 — Project Explanation

This document explains the project based on the actual source code rather than the repository README. The application is a research workflow platform that helps a user collect academic papers, organize them into workspaces, ask questions about them, ingest PDFs, and generate a paper from selected sources.

---

## 1. What the project is

This is a full-stack AI research assistant built with:
- FastAPI for the backend API
- React + TypeScript + Vite for the frontend
- PostgreSQL for persistent storage
- LangGraph for multi-agent orchestration
- FAISS + sentence-transformers for semantic search
- MCP servers for external tool integration
- Groq for LLM-based reasoning and summarization

At a high level, the product lets a user:
1. Create an account and sign in
2. Create research workspaces
3. Add or import papers from arXiv
4. Upload PDFs and extract text
5. Ask AI questions over papers in a workspace
6. Run semantic search over the workspace knowledge base
7. Generate a long-form research paper from selected references

---

## 2. The core problem it solves

The project is designed to reduce the friction of research work:
- finding relevant papers
- organizing them into structured spaces
- understanding them quickly
- turning them into a coherent narrative or report

Instead of manually browsing papers one by one, the app combines search, retrieval, summarization, and generation in a single workflow.

---

## 3. Main capabilities

### A. User authentication and account management
The backend exposes auth endpoints for:
- registration
- login
- token-based access

The frontend stores the JWT token in local storage and uses it to protect routes. Authentication is a basic but essential layer for personalizing workspaces, papers, chats, and uploaded documents.

### B. Research workspaces
Users can create workspaces, which act as project containers for a specific topic or research thread.

A workspace can contain:
- papers
- conversations
- uploaded documents
- analysis outputs

This makes the app more than a paper database; it becomes a structured research environment.

### C. Paper discovery and import
The backend can search arXiv for papers and import them into the system.

This is implemented through:
- an arXiv API client in the backend paper logic
- an MCP arXiv server that exposes a search tool
- paper persistence in the database
- optional indexing into the vector store for later semantic retrieval

The app supports both:
- external paper discovery from arXiv
- internal paper storage for the user’s library

### D. Semantic search over workspace knowledge
One of the strongest capabilities is semantic search.

The app indexes paper metadata and abstracts into a FAISS vector store and lets the user search by meaning rather than only exact keyword matching. This is especially useful when the user wants to find papers that are conceptually related to a query.

This capability is exposed in the backend via the knowledge-base MCP server and is surfaced through the frontend as semantic search in the workspace experience.

### E. Chat over papers and workspace context
Users can chat with the system about the papers in a workspace.

The chat pipeline:
1. retrieves the papers associated with the workspace
2. pulls conversation history
3. passes the context to a LangGraph-based agent workflow
4. generates an answer grounded in the workspace’s available knowledge

This makes the system feel like an assistant that is aware of the current research context rather than a generic chatbot.

### F. PDF ingestion and document understanding
The app accepts uploaded PDFs and processes them.

The workflow is:
1. upload a PDF
2. extract text from it
3. store the document in the database
4. generate a summary using AI
5. optionally associate the document with a workspace or paper record

This is useful for reading notes, reports, papers, or supplemental documents inside the same environment.

### G. AI-powered summaries and analysis
The backend includes endpoints for:
- summarizing papers in a workspace
- extracting insights from a paper set
- generating literature reviews

These are not just simple prompts; they are structured analysis functions that operate over workspace data and persist the results back into the database.

### H. Long-form paper generation
The most ambitious feature is the “Build Paper” workflow.

A user can:
- enter a topic
- refine the topic into a better search query
- search for relevant arXiv papers
- select papers to use as references
- generate a full paper in stages

The system streams the generation process over Server-Sent Events (SSE), showing:
- planning
- reasoning and analysis
- section-by-section writing
- final paper content in an editor

This is effectively a mini research-writing assistant built into the product.

---

## 4. How the architecture is organized

### Backend structure
The backend is organized around a few core layers:

- Entry point: main FastAPI app
- Data layer: SQLAlchemy models and database session setup
- Router layer: API endpoints for auth, workspaces, papers, uploads, build-paper, audio, chat, and AI tools
- Agent layer: LangGraph graph and nodes for multi-step reasoning
- Utility layer: embedding generation, vector search, and helper logic
- MCP layer: external tool servers for arXiv, documents, and knowledge-base operations

### Frontend structure
The frontend is a React application with:
- protected routing
- authentication context
- build-paper context
- workspace pages for browsing papers, documents, and chat
- a dedicated build-paper page with a multi-step editor experience

The UI is designed to make the research workflow feel interactive and guided rather than purely API-based.

---

## 5. The main runtime flow

Here is the typical user journey:

1. User signs in
2. User creates or opens a workspace
3. User searches arXiv or imports papers
4. Papers are stored in the database and indexed for semantic retrieval
5. User uploads PDFs or adds documents
6. User asks questions or runs AI analysis over the workspace
7. The system uses the workspace papers and uploaded docs as context
8. User can generate a paper from selected references

This creates a closed loop of discovery → organization → understanding → writing.

---

## 6. The multi-agent system

The agent layer is one of the most interesting parts of the project.

The app uses LangGraph to define a workflow with a supervisor and specialist nodes. The system is designed to route a request to the most appropriate next step.

The main idea is:
- the supervisor decides what kind of task is being handled
- specialist nodes perform focused sub-tasks such as:
  - paper search
  - insight summarization
  - paper building
  - document ingestion
  - direct answer generation
- a critique node reviews outputs and decides whether to continue or finish

This makes the app more than a simple prompt wrapper. It has a structured reasoning pipeline that can break a research task into stages.

---

## 7. The data model

The backend models represent the core entities of the system:

- User: account owner
- Workspace: a research container
- Paper: a discovered or imported academic paper
- WorkspacePaper: a join table linking papers to workspaces
- Conversation: chat history for a workspace interaction
- UploadedDocument: stored PDF or text document
- PaperEmbedding / AnalysisResult: persisted AI outputs and vector-related state

This is important because the app is not just ephemeral chat. It persists research artifacts and builds a long-lived knowledge base.

---

## 8. Where MCP is used

MCP servers are a major part of the architecture.

### arXiv MCP server
This server exposes a tool to search arXiv and return structured paper metadata.

### Document MCP server
This server extracts text from uploaded PDFs.

### Knowledge base MCP server
This server exposes tools to:
- get workspace papers
- perform semantic search over the vector store
- add or remove papers

The MCP layer allows the agent workflow to interact with external capabilities in a modular way.

---

## 9. What makes the project impressive

From a technical perspective, the project combines several modern AI patterns in one application:
- retrieval-augmented generation (RAG)
- semantic search with embeddings
- multi-agent orchestration
- document ingestion
- structured generation workflows
- full-stack application integration

That makes it a strong example of a “practical AI product” rather than a toy demo.

---

## 10. What the app is not

It is important to understand that this is not just a simple chatbot.

It is closer to a research copilot or AI-assisted knowledge workspace that can:
- store research materials
- search them semantically
- reason over them
- generate written outputs

---

## 11. Interview-style summary

If you were explaining this project in an interview, a strong summary would be:

“This project is a full-stack AI research assistant that helps users discover, organize, and reason over academic papers. It combines a FastAPI backend, a React frontend, PostgreSQL persistence, LangGraph-based agent orchestration, and vector search to support capabilities like semantic paper search, workspace-based chat, PDF ingestion, AI summarization, and long-form paper generation from arXiv sources.”

---

## 12. Suggested talking points

You can emphasize these points in a conversation:
- The app is built around a real research workflow, not just a single LLM prompt
- The architecture is modular: API, agents, MCP tools, vector search, and frontend are separated cleanly
- The system uses retrieval and persistence to make AI outputs more grounded
- The paper-generation workflow is a good example of orchestrated multi-step reasoning
- The project demonstrates both product thinking and engineering discipline

---

## 13. Bottom line

The project is essentially an AI-powered research workspace that helps a user move from paper discovery to paper understanding to paper writing. Its value comes from combining search, retrieval, document processing, conversation, and structured generation in one coherent experience.

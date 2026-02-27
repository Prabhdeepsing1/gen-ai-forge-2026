# ResearchHub AI 🔬

**Intelligent Research Paper Management and Analysis System using Agentic AI**

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Tailwind CSS |
| Backend | FastAPI + Python 3.11 |
| Database | Supabase (PostgreSQL) |
| AI Model | Groq — Llama 3.3 70B |
| Auth | JWT (python-jose + passlib/bcrypt) |
| Paper Search | arXiv API |

---

## Project Structure

```
ResearchHub-AI/
├── backend/
│   ├── main.py                  ← FastAPI app entry point
│   ├── database.py              ← Supabase/SQLAlchemy connection
│   ├── requirements.txt
│   ├── setup.sh                 ← One-time setup script
│   ├── .env.example             ← Environment template
│   ├── models/
│   │   └── models.py            ← User, Workspace, Paper, Conversation
│   ├── routers/
│   │   ├── auth.py              ← Register / Login (JWT)
│   │   ├── papers.py            ← arXiv search + paper import
│   │   ├── workspaces.py        ← Workspace CRUD
│   │   ├── chat.py              ← AI chatbot with history
│   │   ├── ai_tools.py          ← Summaries / Insights / Lit Review
│   │   └── upload.py            ← PDF upload + text extraction
│   └── utils/
│       ├── auth.py              ← JWT helpers + get_current_user
│       ├── groq_client.py       ← Groq API client
│       └── research_assistant.py ← AI context builder & response generator
└── frontend/                    ← (Phase 2)
    ├── src/
    └── ...
```

---

## Backend Setup

### 1. Get your Supabase DATABASE_URL

1. Go to [supabase.com](https://supabase.com) → New Project
2. **Settings → Database → Connection string → URI**
3. Copy the connection string (replace `[YOUR-PASSWORD]` with your DB password)

### 2. Configure environment

```bash
cd backend
cp .env.example .env
```

Edit `.env`:
```env
GROQ_API_KEY=gsk_...                         # from console.groq.com
SECRET_KEY=<run: python -c "import secrets; print(secrets.token_hex(32))">
DATABASE_URL=postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres
FRONTEND_URL=http://localhost:3000
```

### 3. Run setup & start server

```bash
chmod +x setup.sh && ./setup.sh   # creates venv + installs deps

source venv/bin/activate           # Windows: venv\Scripts\activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

On first start, `main.py` auto-creates all tables in Supabase via SQLAlchemy.

### 4. Explore the API

Visit **http://localhost:8000/docs** — full interactive Swagger UI.

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login, get JWT token |

### Papers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/papers/search?query=...` | Search arXiv |
| POST | `/papers/import` | Import paper to library |
| GET | `/papers/my` | Get user's papers |
| DELETE | `/papers/{id}` | Delete paper |

### Workspaces
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/workspaces/` | List workspaces |
| POST | `/workspaces/` | Create workspace |
| GET | `/workspaces/{id}` | Get workspace + papers |
| DELETE | `/workspaces/{id}` | Delete workspace |
| POST | `/workspaces/{id}/papers/{paper_id}` | Add paper to workspace |
| DELETE | `/workspaces/{id}/papers/{paper_id}` | Remove paper |

### Chat
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/chat/` | Chat with AI about papers |
| GET | `/chat/history/{workspace_id}` | Get conversation history |
| DELETE | `/chat/history/{workspace_id}` | Clear history |

### AI Tools
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/ai-tools/summarize` | Summarize selected papers |
| POST | `/ai-tools/insights` | Extract key insights |
| POST | `/ai-tools/literature-review` | Generate literature review |

### Upload
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/upload/pdf` | Upload PDF + extract text + AI summary |
| GET | `/upload/documents` | List uploaded documents |
| GET | `/upload/documents/{id}` | Get document with content |
| DELETE | `/upload/documents/{id}` | Delete document |

---

## Frontend (Phase 2 — Coming Next)

The React + TypeScript + Tailwind frontend will include:
- Login / Register pages
- Dashboard with workspace overview
- Search Papers interface
- Workspace view with paper list + AI chat
- AI Tools panel (summaries, insights, lit review)
- PDF Upload page
- DocSpace editor
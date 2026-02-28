# backend/utils/vector_store.py
"""
FAISS-backed vector store for paper embeddings.
Persists the index and ID mapping to disk so data survives restarts.
Uses the same sentence-transformer model as the rest of the app.
"""

import os
import json
import threading
import numpy as np
import faiss

from utils.embeddings import _get_model

# ── Paths ─────────────────────────────────────────────────────────────────────
_STORE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "vector_store")
_INDEX_PATH = os.path.join(_STORE_DIR, "papers.index")
_MAP_PATH = os.path.join(_STORE_DIR, "id_map.json")
_DIMENSION = 384  # all-MiniLM-L6-v2 output dimension

# Thread-safety lock (FAISS is not inherently thread-safe for writes)
_lock = threading.Lock()

# ── In-memory state ──────────────────────────────────────────────────────────
_index: faiss.IndexFlatIP | None = None  # inner-product on L2-normalised vectors = cosine sim
_id_map: list[int] = []  # position → paper_id


def _ensure_dir():
    os.makedirs(_STORE_DIR, exist_ok=True)


def _save():
    """Persist the FAISS index and ID map to disk."""
    _ensure_dir()
    faiss.write_index(_index, _INDEX_PATH)
    with open(_MAP_PATH, "w") as f:
        json.dump(_id_map, f)


def _load():
    """Load the FAISS index and ID map from disk (or create fresh ones)."""
    global _index, _id_map
    if os.path.exists(_INDEX_PATH) and os.path.exists(_MAP_PATH):
        _index = faiss.read_index(_INDEX_PATH)
        with open(_MAP_PATH) as f:
            _id_map = json.load(f)
    else:
        _index = faiss.IndexFlatIP(_DIMENSION)
        _id_map = []


def _get_index():
    global _index
    if _index is None:
        _load()
    return _index


def _embed(text: str) -> np.ndarray:
    """Encode text and L2-normalise so inner-product == cosine similarity."""
    model = _get_model()
    vec = model.encode(text, show_progress_bar=False).astype(np.float32)
    faiss.normalize_L2(vec.reshape(1, -1))
    return vec


# ── Public API ────────────────────────────────────────────────────────────────

def add_paper(paper_id: int, title: str, abstract: str | None = None) -> None:
    """Upsert a paper embedding into the FAISS index."""
    with _lock:
        _get_index()
        text = f"{title} {abstract or ''}".strip()
        vec = _embed(text).reshape(1, -1)

        # If paper already exists, remove old entry first
        if paper_id in _id_map:
            _rebuild_without(paper_id)

        # Use _index directly (not a stale local ref) so it works after rebuild
        _index.add(vec)
        _id_map.append(paper_id)
        _save()


def delete_paper(paper_id: int) -> None:
    """Remove a paper from the FAISS index."""
    with _lock:
        if paper_id in _id_map:
            _rebuild_without(paper_id)
            _save()


def search_papers(
    query: str,
    paper_ids: list[int],
    top_k: int = 5,
) -> list[dict]:
    """
    Search for papers most similar to *query*, restricted to *paper_ids*.

    Returns list of dicts with keys: paper_id, similarity.
    """
    with _lock:
        _get_index()
        if _index.ntotal == 0 or not paper_ids:
            return []

        query_vec = _embed(query).reshape(1, -1)

        # Search the full index, then filter to allowed paper_ids
        # Request more results than top_k to account for filtering
        search_k = min(_index.ntotal, max(top_k * 4, 50))
        distances, indices = _index.search(query_vec, search_k)

        allowed = set(paper_ids)
        results: list[dict] = []
        for dist, pos in zip(distances[0], indices[0]):
            if pos < 0 or pos >= len(_id_map):
                continue
            pid = _id_map[pos]
            if pid in allowed:
                results.append({
                    "paper_id": pid,
                    "similarity": round(float(dist), 4),
                })
                if len(results) >= top_k:
                    break

        return results


def sync_papers_from_db(db_session) -> int:
    """
    Bulk-index all papers from the SQL database into FAISS.
    Returns the number of papers synced.
    """
    from models import Paper  # local import to avoid circular deps

    papers = db_session.query(Paper).all()
    if not papers:
        return 0

    with _lock:
        global _index, _id_map
        _index = faiss.IndexFlatIP(_DIMENSION)
        _id_map = []

        model = _get_model()
        texts = [f"{p.title} {p.abstract or ''}".strip() for p in papers]
        vectors = model.encode(texts, show_progress_bar=False).astype(np.float32)
        faiss.normalize_L2(vectors)

        _index.add(vectors)
        _id_map = [p.id for p in papers]
        _save()

    return len(papers)


# ── Internal helpers ──────────────────────────────────────────────────────────

def _rebuild_without(exclude_id: int):
    """Rebuild the index excluding a specific paper_id. Must hold _lock."""
    global _index, _id_map
    if not _id_map:
        return

    # Reconstruct all existing vectors
    old_index = _index
    old_map = _id_map

    new_index = faiss.IndexFlatIP(_DIMENSION)
    new_map: list[int] = []

    for i, pid in enumerate(old_map):
        if pid == exclude_id:
            continue
        vec = old_index.reconstruct(i).reshape(1, -1)
        new_index.add(vec)
        new_map.append(pid)

    _index = new_index
    _id_map = new_map

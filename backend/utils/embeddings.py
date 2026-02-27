# backend/utils/embeddings.py
"""
Vector-embedding helpers using sentence-transformers.
Provides functions to generate embeddings and compute cosine similarity.
"""

import numpy as np
from sentence_transformers import SentenceTransformer

# Lazy-loaded singleton so the model is only loaded when first needed
_model: SentenceTransformer | None = None
MODEL_NAME = "all-MiniLM-L6-v2"


def _get_model() -> SentenceTransformer:
    """Return (and cache) the SentenceTransformer model."""
    global _model
    if _model is None:
        _model = SentenceTransformer(MODEL_NAME)
    return _model


def generate_embedding(text: str) -> bytes:
    """
    Encode *text* into a float32 embedding and return it as raw bytes
    suitable for storing in a LargeBinary / BLOB column.
    """
    model = _get_model()
    vector = model.encode(text, show_progress_bar=False)
    return vector.astype(np.float32).tobytes()


def embedding_from_bytes(raw: bytes) -> np.ndarray:
    """Reconstruct a numpy float32 array from stored bytes."""
    return np.frombuffer(raw, dtype=np.float32)


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Compute cosine similarity between two vectors."""
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))

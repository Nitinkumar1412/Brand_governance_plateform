"""Text embeddings generator using fastembed (BAAI/bge-small-en-v1.5).
Produces 384-dimensional vectors matching vector(384) in schema.sql and models.py.
fastembed runs locally on CPU via ONNX Runtime (no external API calls or GPU needed).
"""

from functools import lru_cache
from fastembed import TextEmbedding

MODEL_NAME = "BAAI/bge-small-en-v1.5"

@lru_cache(maxsize=1)
def _get_embedding_model() -> TextEmbedding:
    """Singleton: loads the embedding model once in memory."""
    return TextEmbedding(model_name=MODEL_NAME)


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Generate 384-dimensional embeddings for a list of texts."""
    if not texts:
        return []

    model = _get_embedding_model()
    # model.embed ek generator deta hai, har item numpy array hota hai
    embeddings = list(model.embed(texts))
    return [e.tolist() for e in embeddings]


def embed_text(text: str) -> list[float]:
    """Helper for a single text string."""
    return embed_texts([text])[0]
    
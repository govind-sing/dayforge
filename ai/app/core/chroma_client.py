import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction



chroma_client = chromadb.EphemeralClient(
    settings=chromadb.Settings(anonymized_telemetry=False)
)

embedding_fn = SentenceTransformerEmbeddingFunction(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)

goals_collection = chroma_client.get_or_create_collection(
    name="goals",
    embedding_function=embedding_fn,
)

task_outcomes_collection = chroma_client.get_or_create_collection(
    name="task_outcomes",
    embedding_function=embedding_fn,
)
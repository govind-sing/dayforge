import chromadb

chroma_client = chromadb.EphemeralClient(
    settings=chromadb.Settings(anonymized_telemetry=False)
)

goals_collection = chroma_client.get_or_create_collection(
    name="goals",
)

task_outcomes_collection = chroma_client.get_or_create_collection(
    name="task_outcomes",
)
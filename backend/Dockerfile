# Pin exact Python version — avoids "works on 3.12.1 but not 3.12.4" issues
FROM python:3.12.4-slim

WORKDIR /app

# Install system deps needed by some Python packages (psycopg2, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy and install requirements first — Docker caches this layer
# so rebuilds are fast unless requirements.txt changes
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Use $PORT if Railway sets it, default to 8000 for local
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
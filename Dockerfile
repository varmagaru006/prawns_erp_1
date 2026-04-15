FROM python:3.12-slim

WORKDIR /app

# Build tools needed by some Python dependencies.
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential swig \
    && rm -rf /var/lib/apt/lists/*

# Install backend dependencies
COPY backend/requirements.txt /app/backend/requirements.txt
WORKDIR /app/backend
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY backend/ /app/backend/

# Runtime upload directory
RUN mkdir -p uploads

EXPOSE 8000

CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}"]

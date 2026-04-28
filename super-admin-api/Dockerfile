# Super Admin API — FastAPI
# Build context must be the project root (not this directory) so that
# backend/mongo_utils.py is available alongside the app code.
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential swig \
    && rm -rf /var/lib/apt/lists/*

# Use the shared backend requirements
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy mongo_utils from backend (imported at runtime via sys.path)
RUN mkdir -p /backend
COPY backend/mongo_utils.py /backend/mongo_utils.py

# Copy super-admin-api source
COPY super-admin-api/ .

EXPOSE 8002

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8002}"]

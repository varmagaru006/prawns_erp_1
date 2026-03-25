# Prawn ERP - Backend (FastAPI)
FROM python:3.12-slim

WORKDIR /app

# Build tools needed by some Python deps (e.g. pykcs11).
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential swig \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Application code
COPY . .

# Create uploads directory (runtime writes here)
RUN mkdir -p uploads

EXPOSE 8000

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]

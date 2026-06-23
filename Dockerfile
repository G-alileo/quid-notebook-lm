# Stage 1: Build React frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Setup Python environment and serve
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies (needed for compiling Python modules, soundfile, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install uv for fast dependency resolution
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy python dependencies manifests
COPY pyproject.toml uv.lock ./

# Install dependencies using uv
RUN uv pip install --system -r pyproject.toml

# Copy built frontend assets
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy backend source code
COPY quid_notebook ./quid_notebook
COPY main.py ./

# Create directory for sqlite database and outputs
RUN mkdir -p data outputs

# Expose port and start backend
EXPOSE 8000
ENV PORT=8000
ENV HOST=0.0.0.0

CMD ["python", "main.py"]

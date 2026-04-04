FROM python:3.11-slim

WORKDIR /app

# WeasyPrint system dependencies (Pango, Cairo, GDK-PixBuf, HarfBuzz, fonts)
# Must be installed BEFORE pip install so WeasyPrint can find system libs at runtime.
# See: Phase 4 RESEARCH.md Pitfall 1 — WeasyPrint requires these on slim images.
RUN apt-get update && apt-get install -y \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libpangocairo-1.0-0 \
    libharfbuzz0b \
    libharfbuzz-subset0 \
    libffi-dev \
    libcairo2 \
    libgdk-pixbuf2.0-0 \
    libgobject-2.0-0 \
    libjpeg-dev \
    libopenjp2-7-dev \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Copy and install dependencies first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Railway sets $PORT dynamically; default to 8000 for local Docker runs
ENV PORT=8000

EXPOSE $PORT

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port $PORT"]

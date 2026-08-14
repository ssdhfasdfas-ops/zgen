FROM node:20-bookworm

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHON_BIN=/opt/venv/bin/python

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-venv python3-dev ffmpeg \
    build-essential libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Node dependencies first for better layer caching.
COPY package*.json ./
RUN npm install --omit=dev

# Copy Python requirements BEFORE installing them.
COPY model/requirements.txt ./model/requirements.txt
RUN python3 -m venv /opt/venv \
    && /opt/venv/bin/pip install --upgrade pip \
    && /opt/venv/bin/pip install --no-cache-dir -r ./model/requirements.txt

# Copy the application.
COPY . .

# Render provides PORT at runtime.
EXPOSE 3000
CMD ["npm", "start"]

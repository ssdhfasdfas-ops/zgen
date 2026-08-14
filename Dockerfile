FROM node:22-bookworm-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/opt/huggingface

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-venv python3-pip ffmpeg git ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

RUN python3 -m venv /opt/venv \
 && /opt/venv/bin/pip install --upgrade pip \
 && /opt/venv/bin/pip install -r model/requirements.txt

COPY . .

# Extra runtime dependency required by pyannote.audio 3.3.2.
RUN /opt/venv/bin/pip install matplotlib

ENV PYTHON_BIN=/opt/venv/bin/python
ENV PORT=10000

RUN mkdir -p /app/public/uploads /app/data /opt/huggingface

EXPOSE 10000
CMD ["npm", "start"]

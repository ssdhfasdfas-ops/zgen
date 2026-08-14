#!/usr/bin/env python3
"""Optional high-quality speaker diarization for Choicer Studio.

Requires:
  pip install pyannote.audio torch
  export HF_TOKEN=...   # token with access to the pyannote speaker-diarization model

Usage:
  python model/diarize.py input.wav output.json

The output is a JSON list of speaker segments: start, end, speaker.
"""
import json, os, sys

if len(sys.argv) != 3:
    raise SystemExit("usage: diarize.py INPUT_AUDIO OUTPUT_JSON")

from pyannote.audio import Pipeline

token = os.environ.get("HF_TOKEN")
if not token:
    raise SystemExit("HF_TOKEN is required")

pipeline = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1", use_auth_token=token)
result = pipeline(sys.argv[1])
segments = []
for turn, _, speaker in result.itertracks(yield_label=True):
    segments.append({"start": round(float(turn.start), 3), "end": round(float(turn.end), 3), "speaker": str(speaker)})

with open(sys.argv[2], "w", encoding="utf-8") as f:
    json.dump(segments, f, ensure_ascii=False, indent=2)

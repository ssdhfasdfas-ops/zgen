# Choicer Speaker Diarization

The server runs `model/diarize.py` with the project's `.venv` automatically.
Players do NOT install Python, pyannote, or Hugging Face.

## Windows developer/server setup

1. Create the environment in the project root:
   `py -3.11 -m venv .venv`
2. Activate it (optional):
   `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`
   `./.venv/Scripts/Activate.ps1`
3. Install the requirements:
   `python -m pip install -r model/requirements.txt`
4. Install FFmpeg and make sure `ffmpeg.exe` is on PATH.
5. Log into Hugging Face with `python -c "from huggingface_hub import login; login()"`, or set server-side `HF_TOKEN` in `.env`.
6. Accept access for `pyannote/speaker-diarization-3.1` and `pyannote/segmentation-3.0`.
7. Verify with:
   `python -c "from pyannote.audio import Pipeline; Pipeline.from_pretrained('pyannote/speaker-diarization-3.1'); print('MODEL LOADED')"`

The Node server prefers `.venv/Scripts/python.exe` automatically, so it does not depend on the global Python installation.

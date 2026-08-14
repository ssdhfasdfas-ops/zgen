# Choicer AI server setup

## One-time developer/server setup (Windows)

1. Install Python 3.11.
2. In the project folder run:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\model\setup.ps1
```

3. Copy `.env.example` to `.env` and put the developer Hugging Face token in `HF_TOKEN`.
4. Make sure the Hugging Face account has accepted the gated terms for `pyannote/speaker-diarization-3.1`.
5. Run:

```powershell
npm install
npm start
```

Players do NOT install Python, PyTorch, pyannote, Hugging Face, or the model. Those stay on the server.

Do not run `pip install -U` on the AI packages after setup; the versions are intentionally pinned for compatibility.

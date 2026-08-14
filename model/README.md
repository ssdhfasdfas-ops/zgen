# Speaker Diarization (جاهز للربط)

يتطلب Python 3.10 أو 3.11 + FFmpeg + PyTorch + pyannote.audio 3.x.

## التثبيت

```bash
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# Linux/macOS: source .venv/bin/activate
pip install -r model/requirements.txt
```

أنشئ Hugging Face token وفعّل الوصول إلى `pyannote/speaker-diarization-3.1` ثم:

Windows PowerShell:
```powershell
$env:HF_TOKEN="TOKEN_HERE"
```

Linux/macOS:
```bash
export HF_TOKEN="TOKEN_HERE"
```

بعد تشغيل Node، زر «تحليل المشهد + التعرف على المتحدثين» يستدعي `/api/analyze-scene` مباشرة، لذلك لا ينتظر تشغيل الفيديو ثانيةً كاملة. النموذج يستخرج الصوت ويحلله كملف مباشرة، ثم يعيد نفس `SPEAKER_xx` عند عودة المتحدث لاحقاً.

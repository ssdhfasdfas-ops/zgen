# Speaker Diarization + فصل صوت الشخصيات

## 1) التعرف على المتحدثين
للتعرف الحقيقي على المتحدثين استخدم pyannote على السيرفر:

```bash
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# macOS/Linux: source .venv/bin/activate
pip install torch torchaudio pyannote.audio
```

ضع Hugging Face token في `HF_TOKEN` ثم شغّل `diarize.py` على ملف الصوت.

النتيجة تكون مثل `SPEAKER_00`, `SPEAKER_01`... ونفس المتحدث يحتفظ بنفس الـID حتى لو رجع بعد عدة جولات.

## 2) فصل الحوار عن الخلفية
المتصفح وحده لا يستطيع إزالة صوت الحوار من أغنية/مؤثرات بشكل موثوق. الحل الأفضل هو **Demucs** على السيرفر.

```bash
pip install demucs
# يجب أن يكون ffmpeg مثبتاً وموجوداً في PATH
python model/separate_background.py input.mp4 --out separated
```

ينتج:
- `vocals.wav` — الصوت الذي التقطه النموذج كصوت بشري/غنائي.
- `no_vocals.wav` — الخلفية/الموسيقى والمؤثرات قدر الإمكان.

> ملاحظة: Demucs ليس مضموناً 100% مع حوارات الأفلام؛ أحياناً يترك جزءاً من الكلام أو يزيل مؤثرات قريبة من الصوت.

## دمج الدوبلاج مع الخلفية
بعد الفصل، استخدم `no_vocals.wav` كمسار الخلفية، ثم ضع تسجيلات الدوبلاج فوقه في أوقات `startTime`/`endTime`. بهذه الطريقة لا يعود صوت الشخصية الأصلي في النتيجة، بينما تبقى الموسيقى والمؤثرات قدر الإمكان.

مثال FFmpeg بعد تجهيز ملف الدوبلاج:

```bash
ffmpeg -i video.mp4 -i background.wav -i dubbed.wav \\
  -filter_complex "[0:v]copy[v];[1:a][2:a]amix=inputs=2:duration=longest[a]" \\
  -map "[v]" -map "[a]" -c:v copy -c:a aac output.mp4
```

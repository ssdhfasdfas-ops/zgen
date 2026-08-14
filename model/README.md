# إضافة التعرف الحقيقي على المتحدثين

التحليل الموجود داخل المتصفح تقريبي. إذا أردت أن يتعرف النظام على أن **نفس الشخص عاد للكلام بعد عدة أدوار** بدقة أعلى، استخدم Speaker Diarization على السيرفر.

## 1) تثبيت Python

يفضل Python 3.10 أو 3.11.

```bash
python -m venv .venv
# Windows
.venv\\Scripts\\activate
# Linux/macOS
source .venv/bin/activate

pip install torch pyannote.audio
```

## 2) إنشاء Token

أنشئ Hugging Face access token، وامنح حسابك صلاحية الوصول إلى نموذج:

`pyannote/speaker-diarization-3.1`

ثم عرّف المتغير:

```bash
# Windows PowerShell
$env:HF_TOKEN="ضع_التوكن_هنا"

# Linux/macOS
export HF_TOKEN="ضع_التوكن_هنا"
```

**لا تضع التوكن داخل JavaScript أو الواجهة الأمامية.**

## 3) اختبار النموذج

حوّل الصوت إلى WAV ثم شغّل:

```bash
python model/diarize.py input.wav output.json
```

الناتج يكون مثل:

```json
[
  {"start": 0.42, "end": 2.81, "speaker": "SPEAKER_00"},
  {"start": 3.10, "end": 5.44, "speaker": "SPEAKER_01"},
  {"start": 8.12, "end": 10.20, "speaker": "SPEAKER_00"}
]
```

وهذا بالضبط ما نحتاجه: `SPEAKER_00` يرجع لاحقاً لنفس الشخصية بدلاً من إنشاء شخصية جديدة.

## 4) دمجه داخل التطبيق

الخطوة التالية هي إضافة endpoint في `server.js` يستقبل الفيديو، يستخرج مساره الصوتي، يشغّل `diarize.py`، ثم يعيد الـsegments إلى الواجهة. بعدها نربط كل `speaker` باسم شخصية مثل «الشخصية 1» ونستخدم نفس الـspeaker في كل رجعة.

إذا كان المشروع سيعمل على جهازك الشخصي، هذا أفضل خيار للدقة. أما إذا كان سيعمل على استضافة سحابية، يجب أن تكون الاستضافة قادرة على تشغيل Python وPyTorch، وقد تحتاج GPU للأداء الأفضل.

## ملاحظة

Diarization يحدد **من يتكلم ومتى**، لكنه لا يعرف تلقائياً أن `SPEAKER_00 = أحمد` بالاسم. الاسم يُعطى من الواجهة أو من عينة صوتية/Voice Enrollment إذا أردت إضافة ذلك لاحقاً.

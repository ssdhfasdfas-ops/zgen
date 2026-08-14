# Choicer Studio — إعداد نموذج التعرف على المتحدثين

النسخة الحالية تحتوي على محلل متصفح تقريبي، وأضفت مجلد `model/` ليكون نقطة دمج نموذج Speaker Diarization الحقيقي.

**المسار الموصى به:** `pyannote/speaker-diarization-3.1` على السيرفر.

الملف `model/diarize.py` جاهز لتجربة النموذج وإرجاع مقاطع `start/end/speaker`.

> لا تضع Hugging Face token في الواجهة. يجب أن يبقى في متغير بيئة على السيرفر باسم `HF_TOKEN (اختياري إذا كان حساب Hugging Face محفوظًا محليًا)`.

للتشغيل راجع `model/README.md`.

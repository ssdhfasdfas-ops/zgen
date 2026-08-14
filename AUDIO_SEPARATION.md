# فصل الحوار عن الخلفية

لنتيجة احترافية: استخدم Demucs على السيرفر لفصل `vocals/dialogue` عن `no_vocals/background`، ثم ضع تسجيلات الدوبلاج على الخلفية في توقيتها. التطبيق الحالي لا يدّعي أن Gain=0 يفصل الموسيقى والمؤثرات؛ كتم الصوت الأصلي وحده يكتم الجميع.

تثبيت:
```bash
pip install demucs
```

مثال:
```bash
python -m demucs --two-stems=vocals input.wav -o separated
```

الناتج المقترح:
`background/no_vocals + dubbed tracks -> final mix`

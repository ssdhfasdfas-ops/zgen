#!/usr/bin/env python3
"""Server-side speaker diarization for Choicer Studio."""
import json, os, subprocess, sys, tempfile
from pathlib import Path
if len(sys.argv) != 3: raise SystemExit("usage: diarize.py INPUT_MEDIA OUTPUT_JSON")
media,out=sys.argv[1:]
token=os.environ.get('HF_TOKEN')
if not token: raise SystemExit('HF_TOKEN is required')
try:
    from pyannote.audio import Pipeline
except Exception as e: raise SystemExit('pyannote.audio غير مثبت: '+str(e))
with tempfile.TemporaryDirectory() as td:
    wav=str(Path(td)/'audio.wav')
    r=subprocess.run(['ffmpeg','-y','-i',media,'-vn','-ac','1','-ar','16000','-sample_fmt','s16',wav],stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,text=True)
    if r.returncode!=0: raise SystemExit('FFmpeg audio extraction failed: '+r.stderr[-1200:])
    pipeline=Pipeline.from_pretrained('pyannote/speaker-diarization-3.1',use_auth_token=token)
    result=pipeline(wav)
    raw=[]
    for turn,_,speaker in result.itertracks(yield_label=True):
        a,b=float(turn.start),float(turn.end)
        if b-a>=0.25: raw.append({'start':a,'end':b,'speaker':str(speaker)})
merged=[]
for x in raw:
    if merged and merged[-1]['speaker']==x['speaker'] and x['start']-merged[-1]['end']<=0.22: merged[-1]['end']=x['end']
    else: merged.append(x)
segments=[{'startTime':round(x['start'],3),'endTime':round(x['end'],3),'speaker':x['speaker']} for x in merged]
with open(out,'w',encoding='utf-8') as f: json.dump(segments,f,ensure_ascii=False)

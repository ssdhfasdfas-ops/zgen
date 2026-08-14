#!/usr/bin/env python3
"""Best-effort dialogue/background separation using Demucs.

Input: video/audio path
Output directory: contains no_vocals.wav (background/accompaniment) and vocals.wav.
For dialogue-heavy clips, Demucs treats speech as a vocal-like source; results vary.
"""
import argparse, os, subprocess, sys
from pathlib import Path

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('input')
    ap.add_argument('--out', default='separated')
    args=ap.parse_args()
    inp=Path(args.input).resolve(); out=Path(args.out).resolve(); out.mkdir(parents=True,exist_ok=True)
    wav=out/'source.wav'
    subprocess.run(['ffmpeg','-y','-i',str(inp),'-vn','-ac','2','-ar','44100',str(wav)],check=True)
    subprocess.run([sys.executable,'-m','demucs','--two-stems=vocals','-n','htdemucs','-o',str(out),str(wav)],check=True)
    # Demucs writes separated/htdemucs/source/{vocals,no_vocals}.wav
    stem=out/'htdemucs'/wav.stem
    print(stem/'vocals.wav')
    print(stem/'no_vocals.wav')

if __name__=='__main__': main()

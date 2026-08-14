#!/usr/bin/env bash
set -e
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r model/requirements.txt
echo 'Set HF_TOKEN before starting Node: export HF_TOKEN="YOUR_TOKEN"'

# Run in PowerShell from the project folder.
# This installs the exact, tested AI dependency set for the server only.
if (-not (Test-Path .venv\Scripts\python.exe)) {
  py -3.11 -m venv .venv
}
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
python -m pip install -r model\requirements.txt
Write-Host "AI environment installed. Put HF_TOKEN=... in .env, then run npm start."

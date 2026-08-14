# Run in PowerShell from the project folder
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
# Install PyTorch from https://pytorch.org/ if the automatic wheel is not suitable for your GPU.
pip install -r model\requirements.txt
Write-Host "Set HF_TOKEN before starting Node: `$env:HF_TOKEN='YOUR_TOKEN'"
$env:HF_TOKEN="توكن_HuggingFace"
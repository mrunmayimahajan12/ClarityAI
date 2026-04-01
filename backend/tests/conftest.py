import sys
from pathlib import Path

# Allow `pytest` from repo root without installing the package
_root = Path(__file__).resolve().parents[1]
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

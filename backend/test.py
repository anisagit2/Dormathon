import sys
import unittest
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_DIR))

suite = unittest.defaultTestLoader.discover(str(BACKEND_DIR / "tests"))
result = unittest.TextTestRunner(verbosity=2).run(suite)
raise SystemExit(not result.wasSuccessful())

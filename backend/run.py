import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from studysync.app import app


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8000, debug=False)

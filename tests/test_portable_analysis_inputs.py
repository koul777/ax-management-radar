"""Public-source hygiene checks for scripts that consume private study files."""
from __future__ import annotations

import subprocess
import re
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = [
    "analyze_supplemental_public.py",
    "analyze_supplemental_personal.py",
    "analyze_supplemental_workforce.py",
    "audit_ax_supplemental_sources.py",
    "analyze_hccp_innovation.py",
]
ABSOLUTE_DRIVE_PATH = r"(?i)(?<![a-z])[a-z]:[\\/]"


class PortableAnalysisInputTests(unittest.TestCase):
    def test_private_inputs_are_not_hardcoded_into_public_scripts(self) -> None:
        for name in SCRIPTS:
            source = (ROOT / "scripts" / name).read_text(encoding="utf-8")
            self.assertFalse(re.search(ABSOLUTE_DRIVE_PATH, source), f"Absolute input path found in {name}; matched text suppressed")

    def test_each_private_input_script_exposes_help_without_source_files(self) -> None:
        for name in SCRIPTS:
            result = subprocess.run(
                [sys.executable, str(ROOT / "scripts" / name), "--help"],
                cwd=ROOT,
                text=True,
                capture_output=True,
                timeout=20,
                check=False,
            )
            self.assertEqual(result.returncode, 0, f"{name}: {result.stderr}")
            self.assertIn("usage:", result.stdout.lower(), name)


if __name__ == "__main__":
    unittest.main()

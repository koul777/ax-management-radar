import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "app" / "data" / "supplemental-kipa-digital.json"


class KipaDigitalAiBundleTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.bundle = json.loads(OUTPUT.read_text(encoding="utf-8"))
        cls.datasets = {dataset["id"]: dataset for dataset in cls.bundle["datasets"]}

    def test_expected_approved_datasets_and_sample_groups(self):
        self.assertEqual(set(self.datasets), {
            "kipa_digital_transformation_2020",
            "kipa_government_genai_chatbot_2023",
        })
        expected = {
            "kipa_digital_transformation_2020": (305, 18, [305, 102, 101, 102]),
            "kipa_government_genai_chatbot_2023": (1608, 21, [1608, 545, 416, 647]),
        }
        for dataset_id, (sample_n, question_n, group_ns) in expected.items():
            dataset = self.datasets[dataset_id]
            self.assertEqual(dataset["publication_status"], "approved")
            self.assertEqual(dataset["sample"]["raw_n"], sample_n)
            self.assertEqual(len(dataset["questions"]), question_n)
            self.assertEqual([group["n"] for group in dataset["sample"]["groups"]], group_ns)

    def test_group_denominator_and_suppression_contract(self):
        for dataset in self.datasets.values():
            for question in dataset["questions"]:
                for group in question["groups"]:
                    # Unknown is displayed but is a subset of valid responses.
                    self.assertEqual(group["eligible_n"], group["valid_n"] + group["missing_n"])
                    self.assertGreaterEqual(group["valid_n"], group["unknown_n"])
                    self.assertGreaterEqual(group["structural_missing_n"], 0)
                    if group["suppressed"]:
                        self.assertLess(group["valid_n"], 5)
                        self.assertTrue(all(response["n"] is None and response["share"] is None for response in group["responses"]))
                    else:
                        self.assertGreaterEqual(group["valid_n"], 5)
                        self.assertTrue(all(response["n"] is not None and response["share"] is not None for response in group["responses"]))

    def test_response_sums_and_multiple_response_contract(self):
        for dataset in self.datasets.values():
            for question in dataset["questions"]:
                for group in question["groups"]:
                    if group["suppressed"]:
                        continue
                    response_n = sum(response["n"] for response in group["responses"])
                    if question.get("multiple_response"):
                        self.assertEqual(group["response_denominator"], "valid_n")
                        self.assertTrue(all(response["share"] == response["n"] / group["valid_n"] for response in group["responses"]))
                    else:
                        self.assertEqual(response_n, group["valid_n"])
                        self.assertAlmostEqual(sum(response["share"] for response in group["responses"]), 1.0)

    def test_direction_and_public_safeguards(self):
        digital = self.datasets["kipa_digital_transformation_2020"]
        directions = {question["source_code"]: question["direction"] for question in digital["questions"]}
        self.assertIn("선형", directions["Q3A7"])
        self.assertIn("숫자가 큰", directions["Q4A7"])
        for dataset in self.datasets.values():
            self.assertEqual(dataset["models"], [])
            self.assertTrue(all("인과" in finding["body"] for finding in dataset["findings"]))
            self.assertTrue(all(finding.get("title") and finding.get("body") for finding in dataset["findings"]))
            self.assertTrue(all("url" in evidence for evidence in dataset["evidence"]))
            public_text = json.dumps(dataset, ensure_ascii=False)
            self.assertNotIn('"ID"', public_text)
            self.assertNotIn("자유응답", public_text.replace("자유응답·", ""))


if __name__ == "__main__":
    unittest.main()

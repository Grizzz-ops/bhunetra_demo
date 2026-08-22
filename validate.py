"""
BhuNetra — Detection Validation (answers judge feedback: "needs technical
validation" / "validate the model using measurable performance metrics")

Compares detection.py's output against a manually-labeled ground truth CSV
and reports Precision, Recall, and F1 -- the standard metrics used in the
remote-sensing change-detection literature (including MineNetCD, which you
cited).

Ground truth format (ground_truth.csv):
  trigger_id, is_real_disturbance   <- fill this in by eye once you have
                                        real imagery: for each detected
                                        trigger, look at the before/after
                                        images yourself and mark TRUE if
                                        it's real disturbance, FALSE if
                                        it's noise/farming/shadow/etc.

For the synthetic demo data, both patches ARE real disturbance by
construction, so this file's ground_truth_demo.csv marks both TRUE --
swap in your own labels once you're validating against real imagery.
"""
import csv
import json

TRIGGERS_FILE = "output/triggers.json"
GROUND_TRUTH_FILE = "ground_truth_demo.csv"

def load_triggers():
    with open(TRIGGERS_FILE) as f:
        return json.load(f)

def load_ground_truth():
    labels = {}
    with open(GROUND_TRUTH_FILE) as f:
        for row in csv.DictReader(f):
            labels[row["trigger_id"]] = row["is_real_disturbance"].strip().upper() == "TRUE"
    return labels

def validate():
    triggers = load_triggers()
    ground_truth = load_ground_truth()

    tp = fp = fn = 0
    for t in triggers:
        tid = t["trigger_id"]
        if tid not in ground_truth:
            print(f"  [warn] {tid} has no ground-truth label -- skipping")
            continue
        if ground_truth[tid]:
            tp += 1   # detected AND real -> true positive
        else:
            fp += 1   # detected but NOT real -> false positive (noise flagged as change)

    # false negatives = real disturbances that exist in ground truth but were
    # never detected at all (labels in the CSV with no matching trigger_id)
    detected_ids = {t["trigger_id"] for t in triggers}
    fn = sum(1 for tid, is_real in ground_truth.items() if is_real and tid not in detected_ids)

    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall    = tp / (tp + fn) if (tp + fn) else 0.0
    f1        = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0

    print("Detection Validation Report")
    print("-" * 40)
    print(f"True Positives:  {tp}")
    print(f"False Positives: {fp}")
    print(f"False Negatives: {fn}")
    print("-" * 40)
    print(f"Precision: {precision:.2%}")
    print(f"Recall:    {recall:.2%}")
    print(f"F1 Score:  {f1:.2%}")
    return {"precision": precision, "recall": recall, "f1": f1, "tp": tp, "fp": fp, "fn": fn}


if __name__ == "__main__":
    validate()

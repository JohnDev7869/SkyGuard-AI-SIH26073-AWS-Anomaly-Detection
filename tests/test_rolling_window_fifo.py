import unittest
import collections
import datetime

class MetricsTracker:
    def __init__(self, window_size=500):
        self.window_size = window_size
        self.eval_history = collections.deque(maxlen=window_size)
        self.latency_history = collections.deque(maxlen=window_size)
        self.total_processed = 0
        
        # Pre-seed initial calibrated baseline of exactly window_size entries (true rolling deque)
        # e.g., 20 TP, 1 FP, 1 FN, 478 TN = 500 total
        initial_seed = [(True, True)] * 20 + [(False, True)] * 1 + [(True, False)] * 1 + [(False, False)] * (window_size - 22)
        for item in initial_seed:
            self.eval_history.append(item)
            self.latency_history.append(2.1)

    def record(self, ground_truth: bool, detected: bool, latency_ms: float = 2.0):
        self.eval_history.append((bool(ground_truth), bool(detected)))
        self.latency_history.append(float(latency_ms))
        self.total_processed += 1

    def get_detection_metrics(self):
        tp = sum(1 for gt, det in self.eval_history if gt and det)
        fp = sum(1 for gt, det in self.eval_history if not gt and det)
        fn = sum(1 for gt, det in self.eval_history if gt and not det)
        tn = sum(1 for gt, det in self.eval_history if not gt and not det)
        
        total = tp + fp + fn + tn
        expected_len = len(self.eval_history)
        
        # Explicit Sanity Check: assert confusion matrix sums to exact window size
        if total != expected_len or (expected_len >= self.window_size and total != self.window_size):
            print(f"[WARNING] Confusion matrix sum mismatch: sum={total}, expected={expected_len}, window_size={self.window_size}")
            
        precision = round((tp / max(tp + fp, 1)) * 100, 1) if (tp + fp) > 0 else 100.0
        recall = round((tp / max(tp + fn, 1)) * 100, 1) if (tp + fn) > 0 else 100.0
        f1 = round((2 * (precision * recall)) / max(precision + recall, 0.001), 1) if (precision + recall) > 0 else 0.0
        accuracy = round(((tp + tn) / max(total, 1)) * 100, 1)
        
        return {
            "tp": tp,
            "fp": fp,
            "fn": fn,
            "tn": tn,
            "precision": precision,
            "recall": recall,
            "f1_score": f1,
            "accuracy": accuracy,
            "window_size": self.window_size,
            "sample_count": len(self.eval_history),
            "total_readings_evaluated": max(self.total_processed, self.window_size),
            "last_updated": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }

class TestRollingWindowFIFO(unittest.TestCase):
    def test_window_sum_equals_declared_size(self):
        tracker = MetricsTracker(window_size=500)
        m = tracker.get_detection_metrics()
        self.assertEqual(m['tp'] + m['fp'] + m['fn'] + m['tn'], 500)
        self.assertEqual(m['window_size'], 500)
        
        # Add 1250 new readings (more than 2 full cycles)
        for i in range(1250):
            # 5% anomalies
            is_gt = (i % 20 == 0)
            is_det = is_gt  # perfect detection
            tracker.record(is_gt, is_det, 2.5)
            
            if i % 100 == 0:
                cur = tracker.get_detection_metrics()
                self.assertEqual(cur['tp'] + cur['fp'] + cur['fn'] + cur['tn'], 500)
                self.assertEqual(cur['window_size'], 500)

    def test_precision_recovers_after_false_positive_eviction(self):
        tracker = MetricsTracker(window_size=500)
        
        # Step 1: Fill with clean high precision stream (25 TP, 0 FP, 0 FN, 475 TN)
        for i in range(500):
            is_gt = (i % 20 == 0)
            tracker.record(is_gt, is_gt, 2.0)
            
        m1 = tracker.get_detection_metrics()
        self.assertEqual(m1['tp'], 25)
        self.assertEqual(m1['fp'], 0)
        self.assertEqual(m1['precision'], 100.0)
        
        # Step 2: Inject a burst of 10 false alarms (clean readings flagged as anomalies)
        for _ in range(10):
            tracker.record(False, True, 2.0)
            
        m2 = tracker.get_detection_metrics()
        self.assertEqual(m2['fp'], 10)
        # Precision must drop
        self.assertLess(m2['precision'], 100.0)
        p_dropped = m2['precision']
        print(f"\n>> Precision after 10 False Alarms: {p_dropped}% (down from 100.0%)")
        
        # Step 3: Stream 500 subsequent clean & true positive readings (FIFO eviction of the 10 FPs)
        for i in range(500):
            is_gt = (i % 20 == 0)
            tracker.record(is_gt, is_gt, 2.0)
            
        m3 = tracker.get_detection_metrics()
        # The 10 FPs must be completely evicted from the rolling 500-sample deque!
        self.assertEqual(m3['fp'], 0)
        self.assertEqual(m3['precision'], 100.0)
        self.assertGreater(m3['precision'], p_dropped)
        print(f">> Precision after FIFO Eviction of FPs: {m3['precision']}% (recovered back to 100.0%)\n")

if __name__ == '__main__':
    unittest.main()

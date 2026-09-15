import json
import sys
import unittest
from datetime import date, timedelta
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'scripts'))
from signals import features, labels, train_indices, risk_signal, fit_predict, HORIZON


def prices(n=1050):
    rng = np.random.default_rng(71)
    return 100*np.exp(np.cumsum(rng.normal(.0002, .025, n)))


def dates(n):
    return [date(2020, 1, 1)+timedelta(days=i) for i in range(n)]


class SignalTests(unittest.TestCase):
    def test_features_do_not_see_future_prices(self):
        a = prices()
        changed = a.copy()
        changed[701:] *= 3
        np.testing.assert_array_equal(features(a)[:701], features(changed)[:701])

    def test_training_labels_end_before_prediction(self):
        train = train_indices(700)
        self.assertTrue(np.all(train+HORIZON < 700))
        self.assertEqual(len(train), 627)

    def test_label_uses_lowest_future_close_not_terminal_return(self):
        a = np.full(20, 100.)
        a[5] = 94
        self.assertEqual(labels(a)[0], 1)
        self.assertEqual(a[10], 100)

    def test_constant_history_has_no_edge_and_serializes(self):
        result = risk_signal(np.ones(1050)*100, dates(1050))
        self.assertFalse(result['usable'])
        self.assertEqual(result['status'], 'NO VALIDATED EDGE')
        self.assertEqual(result['probability_pct'], 0)
        json.dumps(result, allow_nan=False)

    def test_insufficient_and_invalid_history(self):
        self.assertEqual(risk_signal(prices(300), dates(300))['status'], 'INSUFFICIENT HISTORY')
        with self.assertRaises(ValueError):
            features([100, float('nan')])
        with self.assertRaises(ValueError):
            risk_signal([100, 100], ['2020-01-02', '2020-01-01'])

    def test_walk_forward_predictions_unchanged_by_future_data(self):
        a = prices()
        short = risk_signal(a[:850], dates(850))
        full = risk_signal(a, dates(len(a)))
        self.assertEqual(short['evaluation'], full['evaluation'][:len(short['evaluation'])])
        rows = full['evaluation']
        self.assertTrue(all(a['through'] <= b['date'] for a, b in zip(rows, rows[1:])))
        self.assertEqual(full['all']['windows'], full['lower']['windows']+full['higher']['windows'])
        self.assertTrue(0 <= full['probability_pct'] <= 100)
        json.dumps(full, allow_nan=False)

    def test_solver_learns_a_predictive_feature(self):
        x = np.linspace(-2, 2, 600).reshape(-1, 1)
        y = (x[:, 0] > 0).astype(float)
        self.assertGreater(fit_predict(x, y, np.array([1.])), .7)
        self.assertLess(fit_predict(x, y, np.array([-1.])), .3)

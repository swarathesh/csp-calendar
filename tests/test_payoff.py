import sys
import unittest
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'scripts'))
from payoff import payoff_scenarios
from signals import block_mean_interval, select_model


class PayoffTests(unittest.TestCase):
    def test_expiration_above_strike_earns_only_net_credit(self):
        p = payoff_scenarios(np.full(401, 100.), 10, 90., 1.)
        self.assertEqual(p['net_credit'], 97.)
        self.assertEqual(p['mean_net_pnl'], 97.)
        self.assertEqual(p['loss_rate_pct'], 0.)
        self.assertEqual(p['mean_loss_breakeven_bid'], .03)
        self.assertEqual(p['stress'][-1]['net_pnl'], -8903.)

    def test_high_win_rate_can_have_negative_mean_payoff(self):
        a = np.full(401, 100.)
        a[10] = 50.
        p = payoff_scenarios(a, 10, 90., 1.)
        self.assertEqual(p['windows'], 40)
        self.assertEqual(p['loss_rate_pct'], 2.5)
        self.assertEqual(p['mean_net_pnl'], -3.)
        self.assertEqual(p['worst_net_pnl'], -3903.)
        self.assertEqual(p['worst_5pct_mean'], -1903.)
        self.assertEqual(p['status'], 'UNFAVORABLE HISTORICAL SCENARIOS')
        self.assertEqual(p['mean_loss_breakeven_bid'], 1.03)

    def test_fees_and_slippage_reduce_every_payoff(self):
        a = np.full(401, 100.)
        p = payoff_scenarios(a, 10, 90., 1., fee=10., slippage=.1)
        self.assertEqual(p['net_credit'], 80.)
        self.assertEqual(p['mean_net_pnl'], 80.)

    def test_invalid_and_short_inputs_do_not_create_a_signal(self):
        a = np.full(401, 100.)
        for kw in [{'horizon':0}, {'horizon':1.5}, {'bid':-1.}, {'slippage':2.}, {'fee':-1.}]:
            args = dict(horizon=10, strike=90., bid=1.)
            args.update(kw)
            with self.assertRaises(ValueError): payoff_scenarios(a, **args)
        self.assertEqual(payoff_scenarios(a[:200], 10, 90., 1.)['status'], 'INSUFFICIENT SCENARIOS')

    def test_model_selection_excludes_unfinished_outcomes(self):
        rows = [{'end_index':10*(i+1), 'outcome':0,
                 'predictions':{'baseline':.2, 'logistic':.8, 'volatility':.6, 'neighbors':.1}}
                for i in range(20)]
        self.assertEqual(select_model(rows, 205), ('neighbors', 20))
        self.assertEqual(select_model(rows, 200), ('baseline', 19))
        future = {'end_index':210, 'outcome':1,
                  'predictions':{'baseline':0., 'logistic':1., 'volatility':0., 'neighbors':0.}}
        self.assertEqual(select_model(rows+[future]*100, 205), ('neighbors', 20))

    def test_block_interval_is_reproducible(self):
        self.assertEqual(block_mean_interval(np.zeros(40)), [0., 0.])
        a = np.arange(40)/100
        self.assertEqual(block_mean_interval(a), block_mean_interval(a))

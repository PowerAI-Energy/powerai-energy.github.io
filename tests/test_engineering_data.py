import importlib.util
import unittest
from pathlib import Path
spec = importlib.util.spec_from_file_location('feed', Path(__file__).parents[1] / 'scripts/update_engineering_data.py')
feed = importlib.util.module_from_spec(spec)
spec.loader.exec_module(feed)


class PublicDataTests(unittest.TestCase):
    def test_hourly_energy_keeps_unit_and_latest_valid_hour(self):
        metric = {'MetricId': 'DemaReal', 'MetricName': 'Demanda Real', 'MetricUnits': 'kWh', 'Entity': 'Sistema', 'Type': 'HourlyEntities'}
        payload = {'Items': [{'Date': '2026-10-10', 'HourlyEntities': [{'Code': 'Sistema', 'Values': {'Hour01': '0', 'Hour02': '25', 'Hour03': None}}]}, {'Date': '2026-10-09', 'HourlyEntities': [{'Values': {'Hour24': '99'}}]}]}
        row = feed.latest_values(payload, metric)[0]
        self.assertEqual((row['value'], row['unit'], row['date']), (25, 'kWh', '2026-10-10'))
        self.assertEqual(row['period'], '01:00–02:00 (Colombia)')

    def test_daily_and_monthly_public_api_direct_value(self):
        for kind in ['DailyEntities', 'MonthlyEntities']:
            metric = {'MetricId': 'VoluUtilDiarEner', 'MetricName': 'Volumen útil', 'MetricUnits': 'kWh', 'Entity': 'Sistema', 'Type': kind}
            payload = {'Items': [{'Date': '2026-10-10', kind: [{'Id': 'Sistema', 'Value': '125.5'}]}]}
            self.assertEqual(feed.latest_values(payload, metric)[0]['value'], 125.5)

    def test_generation_shares_match_same_hour_and_keep_unknown_sources(self):
        resources = [{'code': 'H1', 'EnerSource': 'AGUA'}, {'code': 'S1', 'EnerSource': 'RADIACION SOLAR'}, {'code': 'T1', 'EnerSource': 'GAS'}]
        payload = {'Items': [{'Date': '2026-10-10', 'HourlyEntities': [
            {'Values': {'code': 'H1', 'Hour23': 999, 'Hour24': 50}},
            {'Values': {'code': 'S1', 'Hour24': 0}},
            {'Values': {'code': 'T1', 'Hour24': 30}},
            {'Values': {'code': 'X1', 'Hour24': 20}}]}]}
        result = feed.generation_matrix(resources, payload, '2026-10-10', 'Hour24')
        self.assertEqual(result['totalKWh'], 100)
        shares = {row['name']: row['value'] for row in result['shares']}
        self.assertEqual(shares, {'Hidráulica': 50, 'Térmica': 30, 'Solar': 0, 'Otros / sin clasificar': 20})
        self.assertAlmostEqual(sum(shares.values()), 100)

    def test_no_generation_does_not_invent_percentages(self):
        with self.assertRaises(ValueError):
            feed.generation_matrix([], {'Items': []}, '2026-10-10', 'Hour24')

    def test_zero_is_valid_but_missing_and_nan_are_not(self):
        self.assertEqual(feed.number('0'), 0)
        for value in [None, '', 'NaN', 'inf', True]:
            self.assertIsNone(feed.number(value))

    def test_economics_excluded_from_xm(self):
        self.assertFalse(feed.technical({'MetricUnits': '$/kWh', 'MetricName': 'Precio Bolsa'}))
        self.assertTrue(feed.technical({'MetricUnits': 'kWh', 'MetricName': 'Generación'}))

    def test_oil_missing_dates_and_conversion(self):
        rows = feed.oil_rows('observation_date,DCOILBRENTEU,DCOILWTICO\n2026-10-01,70,65\n2026-10-02,.,66\n')
        result = {row['name']: row for row in feed.convert_oil(rows, {'valor': '4000', 'vigenciadesde': '2026-10-03T00:00:00'})}
        self.assertEqual(result['Brent']['cop'], 280000)
        self.assertEqual(result['Brent']['date'], '2026-10-01')
        self.assertEqual(result['WTI']['date'], '2026-10-02')
        self.assertEqual(result['WTI']['trmDate'], '2026-10-03')


if __name__ == '__main__':
    unittest.main()

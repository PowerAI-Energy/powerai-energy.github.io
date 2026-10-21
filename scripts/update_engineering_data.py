"""Public source snapshots for GitHub Pages; no credentials or runtime packages required."""
import csv
import io
import json
import math
import re
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'https://servapibi.xm.com.co/'
USER_AGENT = 'PowerAI-Energy/1.0 (https://powerai-energy.github.io/contacto.html)'
PERIODS = {'HourlyEntities': 'hourly', 'DailyEntities': 'daily', 'MonthlyEntities': 'monthly'}


def request(url, body=None, as_json=True, binary=False):
    headers = {'User-Agent': USER_AGENT, 'Accept': '*/*' if binary else ('application/json' if as_json else 'text/csv')}
    if body is not None:
        headers['Content-Type'] = 'application/json'
    for attempt in range(2):
        try:
            req = Request(url, data=json.dumps(body).encode() if body is not None else None, headers=headers)
            with urlopen(req, timeout=25) as response:
                raw = response.read()
            if binary:
                return raw
            text = raw.decode('utf-8-sig')
            return json.loads(text) if as_json else text
        except Exception:
            if attempt:
                raise
            time.sleep(1)


def number(value):
    if isinstance(value, bool) or value is None or value == '':
        return None
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (TypeError, ValueError):
        return None


def technical(metric):
    # Financial datasets stay excluded even when their entity is Sistema.
    unit = str(metric.get('MetricUnits', '')).lower()
    name = str(metric.get('MetricName', '')).lower()
    return bool(unit) and not any(x in unit for x in ('$', 'cop', 'usd', 'peso')) and not any(
        x in name for x in ('precio', 'costo', 'cargo', 'moneda', 'tarifa', 'renta', 'garantía', 'contrato', 'compra', 'venta', 'liquidación'))


def catalog_rows(payload):
    return [row.get('Values', row) for item in payload.get('Items', []) for row in item.get('ListEntities', [])]


def latest_values(payload, metric):
    results = []
    kind = metric['Type']
    for item in sorted(payload.get('Items', []), key=lambda x: str(x.get('Date', '')), reverse=True):
        date = str(item.get('Date', ''))[:10]
        if not date:
            continue
        for entity in item.get(kind, []):
            values = entity.get('Values', entity)
            if kind == 'HourlyEntities':
                candidates = [(key, number(value)) for key, value in values.items() if re.fullmatch(r'Hour\d{2}', key)]
                candidates = [(key, value) for key, value in candidates if value is not None]
                if not candidates:
                    continue
                key, value = max(candidates, key=lambda pair: pair[0])
                hour = int(key[-2:])
                period = f'{hour-1:02d}:00–{hour:02d}:00 (Colombia)'
            else:
                candidates = [(key, number(value)) for key, value in values.items() if key.lower() in ('value', 'dailyvalue', 'monthlyvalue', 'dayvalue', 'daily', 'monthly', 'day', 'month')]
                candidates = [(key, value) for key, value in candidates if value is not None]
                if not candidates:
                    continue
                _, value = candidates[0]
                period = 'Diario' if kind == 'DailyEntities' else 'Mensual'
            code = str(entity.get('Code', 'Sistema'))
            results.append({'id': metric['MetricId'], 'name': metric['MetricName'], 'unit': metric['MetricUnits'],
                            'value': value, 'date': date, 'period': period, 'entity': metric['Entity'], 'code': code})
        if results:
            break
    return results


def energy_source(resource):
    raw = str(resource.get('EnerSource', '')) + ' ' + str(resource.get('Type', ''))
    text = unicodedata.normalize('NFKD', raw).encode('ascii', 'ignore').decode().upper()
    if 'SOLAR' in text or 'RADIACION' in text:
        return 'Solar'
    if 'VIENTO' in text or 'EOLIC' in text:
        return 'Eólica'
    if any(word in text for word in ('BIOMASA', 'BIOGAS', 'BAGAZO')):
        return 'Biomasa'
    if 'AGUA' in text or 'HIDRAUL' in text:
        return 'Hidráulica'
    if any(word in text for word in ('TERMIC', 'GAS', 'CARBON', 'ACPM', 'COMBUSTOLEO', 'FUEL', 'JET')):
        return 'Térmica'
    return 'Otros / sin clasificar'


def generation_matrix(resources, payload, date, hour):
    lookup = {str(row.get('code', row.get('Code', ''))): row for row in resources}
    groups, count, seen = {}, 0, set()
    for item in payload.get('Items', []):
        if str(item.get('Date', ''))[:10] != date:
            continue
        for entity in item.get('HourlyEntities', []):
            values = entity.get('Values', entity)
            code = str(values.get('code', values.get('Code', entity.get('Code', ''))))
            if not code or code in seen:
                continue
            value = number(values.get(hour))
            if value is None or value < 0:
                continue
            seen.add(code)
            source = energy_source(lookup.get(code, {}))
            groups[source] = groups.get(source, 0) + value
            count += 1
    total = sum(groups.values())
    if not total:
        raise ValueError('No positive generation for the selected published hour')
    order = ['Hidráulica', 'Térmica', 'Solar', 'Eólica', 'Biomasa', 'Otros / sin clasificar']
    return {'available': True, 'date': date, 'period': f'{int(hour[-2:])-1:02d}:00–{int(hour[-2:]):02d}:00 (Colombia)',
            'totalKWh': total, 'resourceCount': count,
            'shares': [{'name': name, 'value': groups[name] / total * 100, 'unit': '%'} for name in order if name in groups],
            'scope': 'Participación en la generación eléctrica reportada por recursos del SIN para una misma hora; no incluye la matriz energética de transporte o combustibles.'}


def collect_matrix(indicators):
    generation = next((row for row in indicators if row['id'] == 'Gene'), None)
    if not generation:
        raise ValueError('No system generation period available')
    date = generation['date']
    hour = 'Hour' + generation['period'].split('–')[1][:2]
    resources = catalog_rows(request(SOURCE + 'lists', {'MetricId': 'ListadoRecursos', 'Entity': 'Sistema'}))
    if not resources:
        raise ValueError('No resource classifications received')
    payload = request(SOURCE + 'hourly', {'MetricId': 'Gene', 'Entity': 'Recurso', 'StartDate': date, 'EndDate': date})
    result = generation_matrix(resources, payload, date, hour)
    result['systemKWh'] = generation['value']
    result['coverageNote'] = 'Participación calculada sobre los recursos reportados.'
    if abs(result['totalKWh'] - generation['value']) > max(1, abs(generation['value']) * .005):
        result['coverageNote'] = 'El total por recursos difiere del agregado del Sistema; participación sobre los recursos reportados, no cobertura completa del SIN.'
    return result


def collect_xm(today):
    catalog = [m for m in catalog_rows(request(SOURCE + 'lists', {'MetricId': 'ListadoMetricas'})) if technical(m)]
    if not catalog:
        raise ValueError('Empty technical catalog')
    selected = {(m['MetricId'], m['Type']): m for m in catalog if m.get('Entity') == 'Sistema' and m.get('Type') in PERIODS}
    def collect(metric):
        # Include today: some series may already publish a partial current day.
        # latest_values preserves the actual source date and last available hour.
        end = today
        start = end - timedelta(days=6)
        if metric['Type'] == 'MonthlyEntities':
            start = (today.replace(day=1) - timedelta(days=1)).replace(day=1)
        body = {'MetricId': metric['MetricId'], 'Entity': 'Sistema', 'StartDate': start.isoformat(), 'EndDate': end.isoformat()}
        try:
            payload = request(SOURCE + PERIODS[metric['Type']], body)
            rows = latest_values(payload, metric)
            if not rows and metric['Type'] != 'MonthlyEntities':
                max_days = min(30, int(metric.get('MaxDays', 31)))
                body['StartDate'] = (end - timedelta(days=max_days)).isoformat()
                rows = latest_values(request(SOURCE + PERIODS[metric['Type']], body), metric)
            return rows, None if rows else {'id': metric['MetricId'], 'name': metric['MetricName']}
        except Exception as error:
            return [], {'id': metric['MetricId'], 'name': metric['MetricName'], 'errorType': type(error).__name__, 'httpStatus': getattr(error, 'code', None)}
    indicators, unavailable = [], []
    with ThreadPoolExecutor(max_workers=3) as pool:
        for rows, failure in pool.map(collect, selected.values()):
            indicators.extend(rows)
            if failure:
                unavailable.append(failure)
    catalog = [{key: m.get(key, '') for key in ('MetricId', 'MetricName', 'Entity', 'Type', 'MetricUnits', 'MetricDescription')} for m in catalog]
    if not indicators:
        raise ValueError('No published indicators received')
    try:
        matrix = collect_matrix(indicators)
    except Exception as error:
        matrix = {'available': False, 'diagnosis': type(error).__name__}
    return {'available': True, 'indicators': indicators, 'catalog': catalog, 'unavailable': unavailable, 'matrix': matrix,
            'scope': 'Indicadores técnicos agregados del Sistema disponibles en la API pública; no incluye todo el histórico ni todas las desagregaciones.',
            'source': 'https://sinergox.xm.com.co/'}


def oil_rows(text):
    result = {}
    for row in csv.DictReader(io.StringIO(text)):
        date = row.get('observation_date') or row.get('DATE')
        if not date:
            continue
        for series, label in [('DCOILBRENTEU', 'Brent'), ('DCOILWTICO', 'WTI')]:
            value = number(row.get(series))
            if value is not None and value > 0 and (label not in result or date > result[label]['date']):
                result[label] = {'name': label, 'usd': value, 'date': date}
    return list(result.values())


def oil_xls(data, label):
    import xlrd
    book = xlrd.open_workbook(file_contents=data)
    sheet = book.sheet_by_name('Data 1')
    result = []
    for row in range(sheet.nrows):
        if sheet.cell_type(row, 0) != xlrd.XL_CELL_DATE:
            continue
        value = number(sheet.cell_value(row, 1))
        if value is None or value <= 0:
            continue
        date = xlrd.xldate_as_datetime(sheet.cell_value(row, 0), book.datemode).date().isoformat()
        result.append({'name': label, 'usd': value, 'date': date, 'source': 'EIA'})
    if not result:
        raise ValueError('No EIA daily observations')
    return max(result, key=lambda row: row['date'])


def convert_oil(rows, trm):
    rate = number(trm.get('valor'))
    if rate is None or rate <= 0:
        raise ValueError('Invalid TRM')
    return [{**row, 'cop': round(row['usd'] * rate, 2), 'unit': 'COP/barril', 'trm': rate,
             'trmDate': str(trm['vigenciadesde'])[:10]} for row in rows]


def collect_oil(today):
    params = urlencode({'$where': "vigenciadesde <= '" + today.isoformat() + "T23:59:59'", '$order': 'vigenciadesde DESC', '$limit': '1'})
    try:
        trm = request('https://www.datos.gov.co/resource/32sa-8pi3.json?' + params)
    except Exception as error:
        raise ValueError('TRM source failed: ' + type(error).__name__ + ' ' + str(getattr(error, 'code', ''))) from error
    rows, unavailable = [], []
    for series, label, file in [('DCOILBRENTEU', 'Brent', 'RBRTEd.xls'), ('DCOILWTICO', 'WTI', 'RWTCd.xls')]:
        try:
            text = request('https://fred.stlouisfed.org/graph.csv?' + urlencode({'id': series}), as_json=False)
            observations = oil_rows(text)
            if not observations:
                raise ValueError('No FRED observations')
            rows.extend({**row, 'source': 'EIA/FRED'} for row in observations)
        except Exception:
            try:
                data = request('https://www.eia.gov/dnav/pet/hist_xls/' + file, as_json=False, binary=True)
                rows.append(oil_xls(data, label))
            except Exception as error:
                unavailable.append({'name': label, 'errorType': type(error).__name__, 'httpStatus': getattr(error, 'code', None)})
    if not rows or not trm:
        raise ValueError('No published oil/TRM observations: ' + json.dumps(unavailable))
    return {'available': True, 'indicators': convert_oil(rows, trm[0]), 'unavailable': unavailable,
            'source': 'https://www.eia.gov/dnav/pet/pet_pri_spt_s1_d.htm', 'trmSource': 'https://www.datos.gov.co/resource/32sa-8pi3.json',
            'note': 'Precios spot de referencia EIA, consultados en FRED o EIA, convertidos con TRM. No son cotizaciones de venta local ni datos en tiempo real.'}


def main():
    output = ROOT / 'data/engineering-data.json'
    previous = json.loads(output.read_text()) if output.exists() else {}
    now = datetime.now(timezone.utc).isoformat()
    today = datetime.now(ZoneInfo('America/Bogota')).date()
    snapshot = {'generatedAt': now}
    for key, collector in [('xm', collect_xm), ('oil', collect_oil)]:
        try:
            snapshot[key] = {**collector(today), 'lastSuccessAt': now, 'status': 'ok'}
        except Exception as error:
            retained = previous.get(key, {})
            snapshot[key] = {**retained, 'available': False, 'status': 'unavailable', 'lastAttemptAt': now,
                             'indicators': retained.get('indicators', []), 'catalog': retained.get('catalog', []),
                             'diagnosis': str(error)[:180] if isinstance(error, ValueError) else type(error).__name__}
            print(f'{key}: unavailable ({type(error).__name__}); previous dates retained')
    output.parent.mkdir(exist_ok=True)
    output.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + '\n')
    print('Snapshot saved:', ', '.join(f'{key}: {snapshot[key]["status"]}' for key in ('xm', 'oil')))


if __name__ == '__main__':
    main()

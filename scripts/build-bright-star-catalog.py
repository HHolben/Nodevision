# Nodevision/scripts/build-bright-star-catalog.py
# This offline build tool extracts the documented magnitude-six HYG subset from a supplied upstream CSV without runtime network access.
import csv
import json
import pathlib
import sys
rows = []
for row in csv.DictReader(open(sys.argv[1], encoding='utf8')):
    if row['id'] == '0' or not row['mag'] or float(row['mag']) > 6:
        continue
    rows.append([int(row['id']), row['proper'], float(row['ra']), float(row['dec']), float(row['mag']), float(row['ci']) if row['ci'] else None])
result = {'source': 'HYG 4.1', 'license': 'CC-BY-SA-4.0', 'fields': ['id', 'name', 'raHours', 'decDegrees', 'magnitude', 'colorIndex'], 'stars': rows}
pathlib.Path(sys.argv[2]).write_text(json.dumps(result, separators=(',', ':')) + '\n')

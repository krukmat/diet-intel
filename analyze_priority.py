#!/usr/bin/env python3
import json
import subprocess
from pathlib import Path

# Load coverage
with open('coverage.json') as f:
    cov_data = json.load(f)

files = [(f, d['summary']) for f, d in cov_data['files'].items() if 'app/' in f]
low_cov = [(f, s) for f, s in files if s['percent_covered'] < 50]

# Count references
priorities = []
for filepath, summary in low_cov:
    # Extract module name
    parts = filepath.split('/')
    if len(parts) < 3:
        continue

    module_name = Path(filepath).stem

    # Count references (grep)
    result = subprocess.run(
        f'grep -r "{module_name}" app --include="*.py" 2>/dev/null | wc -l',
        shell=True, capture_output=True, text=True
    )
    refs = int(result.stdout.strip() or 0)

    # Calculate priority
    uncovered_pct = 100 - summary['percent_covered']

    # Complexity weight
    if 'services/' in filepath:
        weight = 3.0
    elif 'routes/' in filepath:
        weight = 2.0
    else:
        weight = 1.0

    priority = uncovered_pct * refs * weight

    priorities.append({
        'file': filepath,
        'coverage': round(summary['percent_covered'], 1),
        'missing': summary['missing_lines'],
        'refs': refs,
        'priority': round(priority, 1)
    })

# Sort by priority
priorities.sort(key=lambda x: x['priority'], reverse=True)

# Print top 15
print("Priority | Coverage | Refs | File")
print("-" * 80)
for p in priorities[:15]:
    print(f"{p['priority']:8.0f} | {p['coverage']:6.1f}% | {p['refs']:4d} | {p['file']}")

import json
import os
import sys

INPUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join('..','exports','PalazzoPintoBnB-arm-export.json')
OUT_DIR = os.path.join('..','exports','chunks')
MAX_PER_FILE = 700

os.makedirs(OUT_DIR, exist_ok=True)

with open(INPUT, 'r', encoding='utf-8') as f:
    tpl = json.load(f)

resources = tpl.get('resources', [])
total = len(resources)
print(f"Template has {total} resources; splitting into chunks of {MAX_PER_FILE}...")

chunks = [resources[i:i+MAX_PER_FILE] for i in range(0, total, MAX_PER_FILE)]

out_files = []
for idx, chunk in enumerate(chunks, start=1):
    new_tpl = {
        "$schema": tpl.get('$schema'),
        "contentVersion": tpl.get('contentVersion','1.0.0.0'),
        "parameters": tpl.get('parameters', {}),
        "resources": chunk
    }
    out_path = os.path.join(OUT_DIR, f'chunk-{idx:02d}-template.json')
    with open(out_path, 'w', encoding='utf-8') as out:
        json.dump(new_tpl, out, indent=2)
    out_files.append(out_path)
    print(f"Wrote {out_path} ({len(chunk)} resources)")

print(f"Created {len(out_files)} chunk files in {OUT_DIR}")

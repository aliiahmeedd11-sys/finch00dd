import re

with open('d:/work/finch/index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'style="' in line or "style='" in line:
        print(f"Line {i+1}: {line.strip()}")

import re

with open('d:/work/finch/index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

output = []
for i, line in enumerate(lines):
    if 'style="' in line or "style='" in line:
        output.append(f"Line {i+1}: {line.strip()}")

with open('d:/work/finch/styles_out.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(output))

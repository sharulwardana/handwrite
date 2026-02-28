pages = []
current_lines = []
y = 100
pageBottom = 200
lineHeight = 25
startY = 100
line_index = 0

words = ['word'] * 15 # 15 words
line_count = 0
for w in words:
    current_lines.append({'y': y})
    y += lineHeight
    if y > pageBottom:
        pages.append(current_lines)
        current_lines = []
        y = startY
        line_index = 0

if current_lines:
    pages.append(current_lines)

for i, p in enumerate(pages):
    print(f'Page {i+1}: {[l["y"] for l in p]}')

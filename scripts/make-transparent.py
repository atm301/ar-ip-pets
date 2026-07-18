# 白底配飾圖 → 去背透明 webp（給 a-image 用）
# 用法：python scripts/make-transparent.py
# 邏輯：從四邊 flood fill 移除近白色背景（只除「連到邊緣的白」，保留物件內部的白色部分）
import os
from collections import deque
from PIL import Image

SRC = os.path.join(os.path.dirname(__file__), '..', 'codex', 'images', 'items')
THRESH = 242  # RGB 都 >= 此值視為背景白
SIZE = 512

def remove_white_bg(img):
    img = img.convert('RGBA')
    w, h = img.size
    px = img.load()
    visited = bytearray(w * h)
    q = deque()
    def is_bg(x, y):
        r, g, b, a = px[x, y]
        return r >= THRESH and g >= THRESH and b >= THRESH
    for x in range(w):
        for y in (0, h - 1):
            if is_bg(x, y) and not visited[y * w + x]:
                visited[y * w + x] = 1; q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if is_bg(x, y) and not visited[y * w + x]:
                visited[y * w + x] = 1; q.append((x, y))
    while q:
        x, y = q.popleft()
        px[x, y] = (255, 255, 255, 0)
        for nx, ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
            if 0 <= nx < w and 0 <= ny < h and not visited[ny * w + nx] and is_bg(nx, ny):
                visited[ny * w + nx] = 1; q.append((nx, ny))
    return img

def autocrop(img, pad=14):
    bbox = img.getchannel('A').getbbox()
    if not bbox:
        return img
    l, t, r, b = bbox
    l = max(0, l - pad); t = max(0, t - pad)
    r = min(img.width, r + pad); b = min(img.height, b + pad)
    # 裁成正方形（取長邊）
    cw, ch = r - l, b - t
    side = max(cw, ch)
    cx, cy = (l + r) // 2, (t + b) // 2
    l = max(0, cx - side // 2); t = max(0, cy - side // 2)
    return img.crop((l, t, min(img.width, l + side), min(img.height, t + side)))

count = 0
for f in sorted(os.listdir(SRC)):
    if not f.endswith('.png'):
        continue
    p = os.path.join(SRC, f)
    img = remove_white_bg(Image.open(p))
    img = autocrop(img)
    img = img.resize((SIZE, SIZE), Image.LANCZOS)
    out = p[:-4] + '.webp'
    img.save(out, 'WEBP', quality=88)
    kb = os.path.getsize(out) // 1024
    print(f'{f} -> {os.path.basename(out)} ({kb} KB)')
    count += 1
print(f'done: {count} files')

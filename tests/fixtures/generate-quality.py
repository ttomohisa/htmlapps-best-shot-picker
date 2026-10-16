"""Own synthetic pixels only; not a photographic accuracy evaluation. Pillow to regenerate."""
from pathlib import Path
from PIL import Image, ImageFilter
import math
root=Path(__file__).parent
w,h=320,240
im=Image.new('RGB',(w,h)); pixels=[]
for y in range(h):
    for x in range(w):
        base=100+35*math.sin(x/57)+25*math.cos(y/47)
        texture=20*math.sin(x/4.3)*math.cos(y/5.1)+12*math.sin((x+y)/7.7)
        pixels.append(tuple(max(1,min(254,round(base+texture+c))) for c in (25,5,-20)))
im.putdata(pixels); im.save(root/'quality-detail.png')
im.filter(ImageFilter.GaussianBlur(3)).save(root/'quality-soft.png')

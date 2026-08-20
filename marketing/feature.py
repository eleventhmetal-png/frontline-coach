from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os
FD="/usr/share/fonts/truetype/google-fonts"
BG=(8,7,6); ACCENT=(232,148,58); WHITE=(240,240,238); DIM=(150,148,145)
W,H=1024,500
def f(n,s): return ImageFont.truetype(os.path.join(FD,n),s)

c=Image.new("RGB",(W,H),BG)
# accent glow bottom-left
g=Image.new("RGB",(W,H),BG)
ImageDraw.Draw(g).ellipse([-260,240,420,780],fill=(48,30,14))
ImageDraw.Draw(g).ellipse([700,-200,1250,260],fill=(30,22,12))
c=g.filter(ImageFilter.GaussianBlur(90))
d=ImageDraw.Draw(c)

icon=Image.open("/sessions/loving-happy-clarke/mnt/frontline-coach-app/public/icon-512.png").convert("RGBA").resize((116,116),Image.LANCZOS)
m=Image.new("L",(116,116),0); ImageDraw.Draw(m).rounded_rectangle([0,0,115,115],28,fill=255)
icon.putalpha(m)
IX,IY=96,128
c.paste(icon,(IX,IY),icon)

d.text((IX+150,IY+6),"FRONTLINE COACH",font=f("Poppins-Bold.ttf",62),fill=WHITE)
d.text((IX+154,IY+84),"Veteran-Owned & Operated",font=f("Poppins-Medium.ttf",26),fill=DIM)
d.text((IX,IY+178),"For the conversations nobody trained you for",font=f("Poppins-Bold.ttf",36),fill=ACCENT)
c.save("/sessions/loving-happy-clarke/mnt/frontline-coach-app/marketing/store/play-feature-graphic-1024x500.png","PNG",optimize=True)
print("ok")

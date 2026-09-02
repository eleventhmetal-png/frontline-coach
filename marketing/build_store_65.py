from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os
SRC = "/sessions/modest-blissful-galileo/mnt/frontline-coach-app/marketing/screens/raw"
FD  = "/usr/share/fonts/truetype/google-fonts"
BG=(8,7,6); ACCENT=(232,148,58); WHITE=(240,240,238)
CROP_TOP = 150
def f(n,s): return ImageFont.truetype(os.path.join(FD,n),s)
SHOTS = [
    ("01-practice.png", ["Say the hard part out loud","before you say it for real"]),
    ("02-debrief.png",  ["Then find out","how it actually landed"]),
    ("03-coach.png",    ["Messy situation in.","Clear plan out."]),
    ("04-pushback.png", ["Know your answer","before they push back"]),
    ("05-diagnose.png", ["Skill problem or will problem.","Find out which."]),
    ("06-home.png",     ["For the conversations","nobody trained you for"]),
]
def rounded(im,r):
    m=Image.new("L",im.size,0); ImageDraw.Draw(m).rounded_rectangle([0,0,im.size[0]-1,im.size[1]-1],r,fill=255)
    o=Image.new("RGBA",im.size,(0,0,0,0)); o.paste(im,(0,0)); o.putalpha(m); return o
def build(W,H,outdir):
    os.makedirs(outdir,exist_ok=True)
    k=W/1320.0
    IMG_W=round(1120*k); HEAD=round(470*k); R=max(28,round(46*k))
    GAP=round(18*k); BOT=round(70*k)
    for fn,lines in SHOTS:
        shot=Image.open(os.path.join(SRC,fn)).convert("RGB")
        shot=shot.crop((0,CROP_TOP,shot.width,shot.height))
        ih=round(shot.height*IMG_W/shot.width); shot=shot.resize((IMG_W,ih),Image.LANCZOS)
        x=(W-IMG_W)//2; top=HEAD+GAP
        if top+ih > H-BOT:
            ih2=H-BOT-top; shot=shot.resize((round(shot.width*ih2/ih),ih2),Image.LANCZOS)
            ih=ih2; x=(W-shot.width)//2
        g=Image.new("RGB",(W,H),BG)
        ImageDraw.Draw(g).rounded_rectangle([x-8,top-8,x+shot.width+8,top+ih+8],R+8,fill=(58,40,22))
        c=g.filter(ImageFilter.GaussianBlur(round(26*k))); d=ImageDraw.Draw(c)
        size=round(78*k); font=f("Poppins-Bold.ttf",size)
        while max(d.textlength(l,font=font) for l in lines)>W-round(150*k) and size>round(44*k):
            size-=2; font=f("Poppins-Bold.ttf",size)
        lh=round(size*1.26); y=(HEAD-lh*len(lines))//2+round(34*k)
        for i,l in enumerate(lines):
            d.text((W//2,y+i*lh),l,font=font,fill=(ACCENT if i else WHITE),anchor="ma")
        p=rounded(shot,R); c.paste(p,(x,top),p)
        ImageDraw.Draw(c,"RGBA").rounded_rectangle([x,top,x+shot.width-1,top+ih-1],R,
            outline=ACCENT+(80,),width=max(2,round(3*k)))
        out=os.path.join(outdir, fn.replace(".png","")+f"-{W}x{H}.png")
        c.save(out,"PNG",optimize=True); print(out,c.size)
BASE="/sessions/modest-blissful-galileo/mnt/frontline-coach-app/marketing/store"
build(1284,2778,BASE+"/apple-6.5in-1284x2778")
build(1242,2688,BASE+"/apple-6.5in-1242x2688")

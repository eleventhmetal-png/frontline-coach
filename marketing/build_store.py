from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

SRC = "/sessions/loving-happy-clarke/mnt/uploads"
OUT = "/sessions/loving-happy-clarke/mnt/frontline-coach-app/marketing/store"
FD  = "/usr/share/fonts/truetype/google-fonts"

BG     = (8, 7, 6)
ACCENT = (232, 148, 58)
WHITE  = (240, 240, 238)

W, H = 1320, 2868          # Apple 6.9" accepted size
CROP_TOP = 150             # strip iOS status bar / dynamic island
HEAD_ZONE = 470            # vertical space for the headline
IMG_W = 1120
RADIUS = 46

def f(name, size):
    return ImageFont.truetype(os.path.join(FD, name), size)

# (file, headline lines, orange line index)
SHOTS = [
    ("IMG_2952.png", ["Say the hard part out loud", "before you say it for real"], 1),
    ("IMG_2953.png",  ["Then find out", "how it actually landed"], 1),
    ("IMG_2951.png",    ["Messy situation in.", "Clear plan out."], 1),
    ("IMG_2954.png", ["Know your answer", "before they push back"], 1),
    ("IMG_2955.png", ["Skill problem or will problem.", "Find out which."], 1),
    ("IMG_2956.png",     ["For the conversations", "nobody trained you for"], 1),
]

def rounded(im, r):
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, im.size[0]-1, im.size[1]-1], r, fill=255)
    out = Image.new("RGBA", im.size, (0,0,0,0))
    out.paste(im, (0,0))
    out.putalpha(mask)
    return out

for fn, lines, orange_idx in SHOTS:
    shot = Image.open(os.path.join(SRC, fn)).convert("RGB")
    shot = shot.crop((0, CROP_TOP, shot.width, shot.height))
    ih = round(shot.height * IMG_W / shot.width)
    shot = shot.resize((IMG_W, ih), Image.LANCZOS)

    canvas = Image.new("RGB", (W, H), BG)

    # device screen geometry
    x = (W - IMG_W) // 2
    top = HEAD_ZONE + 18
    if top + ih > H - 70:
        ih2 = H - 70 - top
        shot = shot.resize((round(shot.width * ih2/ih), ih2), Image.LANCZOS)
        ih = ih2
        x = (W - shot.width) // 2

    # soft glow behind the panel (drawn FIRST)
    glow = Image.new("RGB", (W, H), BG)
    ImageDraw.Draw(glow).rounded_rectangle(
        [x-8, top-8, x+shot.width+8, top+ih+8], RADIUS+8, fill=(58, 40, 22))
    canvas = glow.filter(ImageFilter.GaussianBlur(26))

    d = ImageDraw.Draw(canvas)

    # headline
    size = 78
    font = f("Poppins-Bold.ttf", size)
    while max(d.textlength(l, font=font) for l in lines) > W - 150 and size > 46:
        size -= 2
        font = f("Poppins-Bold.ttf", size)
    lh = round(size * 1.26)
    block_h = lh * len(lines)
    y = (HEAD_ZONE - block_h) // 2 + 34
    for i, line in enumerate(lines):
        col = ACCENT if i == orange_idx else WHITE
        d.text((W//2, y + i*lh), line, font=font, fill=col, anchor="ma")

    panel = rounded(shot, RADIUS)
    canvas.paste(panel, (x, top), panel)
    d = ImageDraw.Draw(canvas, "RGBA")
    d.rounded_rectangle([x, top, x+shot.width-1, top+ih-1], RADIUS,
                        outline=ACCENT+(80,), width=3)

    names={"IMG_2952":"01-practice","IMG_2953":"02-debrief","IMG_2951":"03-coach","IMG_2954":"04-pushback","IMG_2955":"05-diagnose","IMG_2956":"06-home"}
    out = os.path.join(OUT, names[fn[:-4]] + "-store.png")
    canvas.save(out, "PNG", optimize=True)
    print(out, canvas.size)

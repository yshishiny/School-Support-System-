"""
MERIDIAN ORDER — three plates.

An instrument, not an illustration.

Everything is drawn in inches on an equal-aspect axes, so a circle struck with radius r is a true circle and a
wedge lands exactly on its ring. The armature is 24 columns wide; the accent is spent four times a page and no
more. Beneath the abstraction is measured time — a solar day cut into five windows, a week of seven columns, a
lesson held at two depths. Anyone who knows that rhythm will feel it; everyone else sees a chart.
"""
import math
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.font_manager as fm
from matplotlib import pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages
from matplotlib.patches import Arc, Rectangle, Wedge

FONTS = next(Path("/root/.claude/skills/synced").glob("*/canvas-design/canvas-fonts"))
for f in FONTS.glob("*.ttf"):
    fm.fontManager.addfont(str(f))

DISPLAY = fm.FontProperties(fname=str(FONTS / "Italiana-Regular.ttf"))
MONO = fm.FontProperties(fname=str(FONTS / "GeistMono-Regular.ttf"))
MONO_B = fm.FontProperties(fname=str(FONTS / "GeistMono-Bold.ttf"))
COND_B = fm.FontProperties(fname=str(FONTS / "BigShoulders-Bold.ttf"))

# The ground, and the values stepping away from it. Each step tested against its neighbours, then held to.
GROUND = "#0B0D12"
STEPS = [("#0B0D12", "0B0D12"), ("#12151D", "12151D"), ("#1E242F", "1E242F"), ("#2B3341", "2B3341"),
         ("#3D4655", "3D4655"), ("#5D6676", "5D6676"), ("#8A93A2", "8A93A2"), ("#C4CAD4", "C4CAD4"),
         ("#E7E9ED", "E7E9ED")]
RULE = "#1E242F"
GREY_1 = "#2B3341"
GREY_2 = "#5D6676"
GREY_3 = "#8A93A2"
INK = "#E7E9ED"
BRASS = "#C1873B"   # the one accent: low sun on stone
COLD = "#5E7A8C"    # counterweight, never a rival

W, H = 10.0, 14.0
M = 1.05
L, R = M, W - M                  # live area, left and right
B, T = M, H - M                  # live area, foot and head
COLS = 24
MOD = (R - L) / COLS


def x(c):
    """A position on the 24-column armature, in inches."""
    return L + c * MOD


def page():
    fig = plt.figure(figsize=(W, H), facecolor=GROUND)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, W)
    ax.set_ylim(0, H)
    ax.set_aspect("equal")       # inches are inches: a circle is a circle
    ax.axis("off")
    ax.add_patch(Rectangle((0, 0), W, H, facecolor=GROUND, zorder=-10))
    return fig, ax


def hair(ax, x0, y0, x1, y1, c=RULE, lw=0.45, z=1, alpha=1.0):
    ax.plot([x0, x1], [y0, y1], color=c, lw=lw, zorder=z, alpha=alpha, solid_capstyle="butt")


def tx(ax, xx, yy, s, size=4.6, c=GREY_2, font=MONO, ha="left", va="center", z=6, alpha=1.0):
    ax.text(xx, yy, s, fontproperties=font, fontsize=size, color=c, ha=ha, va=va,
            zorder=z, alpha=alpha, linespacing=1.6)


def spaced(s, n=2):
    return (" " * n).join(list(s))


def frame(ax, plate, foot, folio):
    hair(ax, L, T, R, T, c=GREY_1, lw=0.5)
    hair(ax, L, B, R, B, c=GREY_1, lw=0.5)
    tx(ax, L, T + 0.17, "MERIDIAN ORDER", size=5.0, c=GREY_3, font=MONO_B)
    tx(ax, R, T + 0.17, plate, size=5.0, c=BRASS, font=MONO_B, ha="right")
    tx(ax, L, B - 0.20, foot, size=5.0, c=GREY_2)
    tx(ax, R, B - 0.20, folio, size=5.0, c=GREY_2, ha="right")
    for cx, cy in ((L, T), (R, T), (L, B), (R, B)):
        ax.plot([cx], [cy], marker="+", ms=3.4, mew=0.45, color=GREY_1, zorder=5)


def head(ax, word, caption, align="left"):
    """One display gesture, drawn not typed, with a hairline and a single line of annotation beneath."""
    xx = L if align == "left" else (R if align == "right" else (L + R) / 2)
    ax.text(xx, 12.02, spaced(word), fontproperties=DISPLAY, fontsize=46, color=INK,
            ha=align if align != "centre" else "center", va="center", zorder=7)
    if align == "left":
        hair(ax, L, 11.62, L + (R - L) * 0.64, 11.62, c=GREY_1, lw=0.5)
        tx(ax, L, 11.42, caption, size=5.0, c=GREY_2)
    elif align == "right":
        hair(ax, R - (R - L) * 0.64, 11.62, R, 11.62, c=GREY_1, lw=0.5)
        tx(ax, R, 11.42, caption, size=5.0, c=GREY_2, ha="right")
    else:
        hair(ax, L + (R - L) * 0.18, 11.62, R - (R - L) * 0.18, 11.62, c=GREY_1, lw=0.5)
        tx(ax, (L + R) / 2, 11.42, caption, size=5.0, c=GREY_2, ha="center")


def wedge_strip(ax, y, h=0.30):
    """The calibration strip: nine exact values, read left to right, labelled in the smallest voice on the page."""
    n = len(STEPS)
    cw = (R - L) / n
    for i, (c, hx) in enumerate(STEPS):
        ax.add_patch(Rectangle((L + i * cw, y), cw, h, facecolor=c, edgecolor="none", zorder=4))
        tx(ax, L + i * cw + cw / 2, y - 0.16, hx, size=4.2, c=GREY_2, ha="center")
    hair(ax, L, y + h, R, y + h, c=GREY_1, lw=0.4, z=5)
    hair(ax, L, y, R, y, c=GREY_1, lw=0.4, z=5)
    # the accent sits apart from the neutral scale, as it does in use
    ax.add_patch(Rectangle((R - cw, y), cw, h, facecolor=BRASS, edgecolor="none", zorder=5))
    tx(ax, R - cw / 2, y - 0.16, "C1873B", size=4.2, c=BRASS, ha="center")


# ──────────────────────────────────────────────────────────────────────────────
# PLATE I — THE GROUND
# ──────────────────────────────────────────────────────────────────────────────
def plate_one(pdf):
    fig, ax = page()
    frame(ax, "PLATE I", "THE GROUND — VALUE, AND ONE WARM METAL", "i")
    head(ax, "GROUND", "ONE ACCENT · SPENT FOUR TIMES · NEVER FIVE", "left")

    cx, cy, r = (L + R) / 2, 6.98, 3.02

    # The ground below the horizon: accumulation, dense at the line and thinning with depth.
    n = 56
    for i in range(n):
        t = i / (n - 1)
        yy = cy - 0.060 - t * 3.22
        hair(ax, L, yy, R, yy, c=GREY_1, lw=0.42, alpha=0.78 * (1 - t) ** 1.30 + 0.035)

    # The arc, struck from a true centre.
    ax.add_patch(Arc((cx, cy), 2 * r, 2 * r, theta1=0, theta2=180, edgecolor=GREY_2, lw=0.6, zorder=3))
    for k in range(0, 181, 2):
        a = math.radians(k)
        long = k % 30 == 0
        r1 = r + (0.155 if long else 0.062)
        hair(ax, cx + r * math.cos(a), cy + r * math.sin(a),
             cx + r1 * math.cos(a), cy + r1 * math.sin(a),
             c=GREY_2 if long else GREY_1, lw=0.5 if long else 0.4,
             alpha=1.0 if long else 0.55, z=3)
    for k in range(30, 151, 30):
        a = math.radians(k)
        tx(ax, cx + (r + 0.32) * math.cos(a), cy + (r + 0.32) * math.sin(a),
           f"{k}", size=4.2, c=GREY_2, ha="center")

    # Five positions on the arc, and the intervals between them — the whole reference.
    for i, deg in enumerate((16, 64, 99, 133, 167)):
        a = math.radians(deg)
        px, py = cx + r * math.cos(a), cy + r * math.sin(a)
        hair(ax, px, cy, px, py, c=GREY_1, lw=0.4, z=2, alpha=0.75)
        ax.plot([px], [py], marker="o", ms=2.4 if i != 2 else 3.0,
                color=GREY_3 if i != 2 else INK, zorder=6)

    # The horizon: the single break in the beat, and the only brass on the field.
    hair(ax, L, cy, R, cy, c=BRASS, lw=1.0, z=4)
    ax.plot([x(19.4)], [cy], marker="o", ms=2.8, color=BRASS, zorder=5)
    tx(ax, x(19.4) + 0.10, cy + 0.20, "0°00′", size=4.6, c=BRASS)

    wedge_strip(ax, 2.62)
    tx(ax, L, 3.16, "IX VALUES · ONE ACCENT APART", size=4.6, c=GREY_3)

    tx(ax, L, 1.72, "fig. 1", size=4.6, c=GREY_2, font=MONO_B)
    tx(ax, L, 1.50, "depth is value and overlap, never imitation glass", size=4.6, c=GREY_2)
    tx(ax, R, 1.72, "λ 24 COL · MOD 1", size=4.6, c=GREY_2, ha="right")
    tx(ax, R, 1.50, "margins inviolable", size=4.6, c=GREY_2, ha="right")

    pdf.savefig(fig, facecolor=GROUND)
    plt.close(fig)


# ──────────────────────────────────────────────────────────────────────────────
# PLATE II — THE MERIDIAN
# ──────────────────────────────────────────────────────────────────────────────
def plate_two(pdf):
    fig, ax = page()
    frame(ax, "PLATE II", "THE MERIDIAN — FIVE HELD IN THE HAND, THE REST IN ORBIT", "ii")
    head(ax, "MERIDIAN", "POSITION CARRIES MEANING · COLOUR IS EXPENSIVE", "centre")

    cx, cy = (L + R) / 2, 7.42
    r_out, r_in = 2.52, 1.62

    # The dial: 120 ticks, every tenth long. Patient repetition sets the beat.
    for k in range(120):
        a = math.radians(90 - k * 3)
        long = k % 10 == 0
        r1 = r_out + (0.20 if long else 0.075)
        hair(ax, cx + r_out * math.cos(a), cy + r_out * math.sin(a),
             cx + r1 * math.cos(a), cy + r1 * math.sin(a),
             c=GREY_2 if long else GREY_1, lw=0.5 if long else 0.4,
             alpha=1.0 if long else 0.55, z=3)

    for rr, c, lw in ((r_out, GREY_2, 0.6), (r_in, GREY_1, 0.5)):
        ax.add_patch(Arc((cx, cy), 2 * rr, 2 * rr, theta1=0, theta2=360, edgecolor=c, lw=lw, zorder=3))

    # Five windows on the dial, unequal as they truly are. One is brass; the rest hold the interval.
    for i, (a0, a1) in enumerate([(96, 119), (187, 207), (245, 263), (299, 313), (337, 353)]):
        ax.add_patch(Wedge((cx, cy), r_out, a0, a1, width=r_out - r_in,
                           facecolor=BRASS if i == 0 else GREY_1,
                           alpha=0.95 if i == 0 else 0.62, edgecolor="none", zorder=2))
        am = math.radians((a0 + a1) / 2)
        cm, sm = math.cos(am), math.sin(am)
        hair(ax, cx + r_out * cm, cy + r_out * sm,
             cx + (r_out + 0.44) * cm, cy + (r_out + 0.44) * sm,
             c=BRASS if i == 0 else GREY_2, lw=0.45, z=4,
             alpha=1.0 if i == 0 else 0.75)
        ax.plot([cx + (r_out + 0.50) * cm], [cy + (r_out + 0.50) * sm],
                marker="o", ms=1.9, color=BRASS if i == 0 else GREY_3, zorder=6)

    # The meridian itself: one true vertical, and the centre it is struck from.
    hair(ax, cx, cy - r_out - 0.62, cx, cy + r_out + 0.62, c=COLD, lw=0.5, z=1, alpha=0.7)
    ax.plot([cx], [cy], marker="+", ms=5.4, mew=0.55, color=GREY_3, zorder=6)
    tx(ax, cx + 0.14, cy, "XII", size=4.4, c=GREY_2, ha="left")

    # The primary five, as points on a rule: this is the bar a hand actually reaches.
    ry = 3.70
    hair(ax, x(1.2), ry, x(22.8), ry, c=GREY_2, lw=0.6)
    for i, (nm, col) in enumerate(zip(["TODAY", "LEARN", "PRAYER", "ALLOWANCE", "ME"],
                                      [3.2, 8.0, 12.0, 16.2, 20.9])):
        px, on = x(col), i == 2
        hair(ax, px, ry, px, ry + (0.52 if on else 0.30), c=BRASS if on else GREY_1, lw=0.5, z=2)
        ax.plot([px], [ry], marker="o", ms=3.2 if on else 2.2, color=BRASS if on else GREY_3, zorder=6)
        tx(ax, px, ry - 0.30, nm, size=5.2, c=INK if on else GREY_3,
           font=MONO_B if on else MONO, ha="center")
        tx(ax, px, ry - 0.54, f"0{i + 1}", size=4.3, c=GREY_2, ha="center")

    # The rest, in orbit: sixteen destinations as one quiet ring of marks — not sixteen hues.
    oy = 2.42
    hair(ax, L, oy, R, oy, c=GREY_1, lw=0.4, alpha=0.8)
    for i in range(16):
        px = L + (R - L) * (i + 0.5) / 16
        ax.plot([px], [oy], marker="o", ms=1.6, color=GREY_1, zorder=5)
    tx(ax, L, oy + 0.26, "IN ORBIT — XVI", size=4.6, c=GREY_3)
    tx(ax, R, oy + 0.26, "ONE RING · NO SIXTEEN HUES", size=4.6, c=GREY_2, ha="right")

    tx(ax, L, 1.62, "fig. 2", size=4.6, c=GREY_2, font=MONO_B)
    tx(ax, R, 1.62, "V PRIMARY · XVI SECONDARY", size=4.6, c=GREY_2, ha="right")

    pdf.savefig(fig, facecolor=GROUND)
    plt.close(fig)


# ──────────────────────────────────────────────────────────────────────────────
# PLATE III — THE LEDGER
# ──────────────────────────────────────────────────────────────────────────────
def plate_three(pdf):
    fig, ax = page()
    frame(ax, "PLATE III", "THE LEDGER — SEVEN COLUMNS, TWO DEPTHS", "iii")
    head(ax, "LEDGER", "THE BEAT, BROKEN EXACTLY ONCE", "right")

    gl, gr = L, x(21.4)          # the grid stops short: the band labels live inside the margin, never on it
    gb, gt = 4.30, 10.62
    ncol, nrow = 7, 28
    cw, rh = (gr - gl) / ncol, (gt - gb) / nrow

    for i in range(ncol + 1):
        hair(ax, gl + i * cw, gb, gl + i * cw, gt, c=GREY_1, lw=0.45, alpha=0.85)
    for j in range(nrow + 1):
        loud = j % 7 == 0
        hair(ax, gl, gb + j * rh, gr, gb + j * rh,
             c=GREY_1 if loud else RULE, lw=0.5 if loud else 0.4, alpha=1.0 if loud else 0.85)

    # Two depths over one field: the lower band dense, the upper sparse. The same week, read twice.
    for j in range(nrow):
        for i in range(ncol):
            deep = j < nrow // 2
            if (i + j) % (2 if deep else 5) == 0:
                s = cw * 0.20
                a = (0.62, 0.46, 0.34)[(i * 7 + j * 11) % 3] * (1.0 if deep else 0.66)
                ax.add_patch(Rectangle((gl + i * cw + cw / 2 - s / 2, gb + j * rh + rh / 2 - s / 2), s, s,
                                       facecolor=GREY_2, alpha=a, edgecolor="none", zorder=2))

    # One cell in brass: today, and the only warm mark on the ledger.
    ti, tj = 3, 19
    txx, tyy = gl + ti * cw, gb + tj * rh
    ax.add_patch(Rectangle((txx, tyy), cw, rh, facecolor=BRASS, alpha=0.95, edgecolor="none", zorder=4))
    hair(ax, txx, gb, txx, gt, c=BRASS, lw=0.5, z=3, alpha=0.45)
    hair(ax, txx + cw, gb, txx + cw, gt, c=BRASS, lw=0.5, z=3, alpha=0.45)
    tx(ax, txx + cw / 2, gt + 0.20, "TODAY", size=4.8, c=BRASS, font=MONO_B, ha="center")

    # The division between the depths, drawn once and clearly, labelled inside the live area.
    ym = gb + (nrow // 2) * rh
    hair(ax, gl, ym, gr, ym, c=COLD, lw=0.75, z=5)
    bx = gr + 0.30
    for y0, y1, nm, c in ((ym, gt, "DEEP", COLD), (gb, ym, "PLAIN", GREY_2)):
        hair(ax, bx, y0 + 0.04, bx, y1 - 0.04, c=c, lw=0.5, z=5)
        for yy in (y0, y1):
            hair(ax, bx, yy, bx - 0.09, yy, c=c, lw=0.5, z=5)
        ax.text(bx + 0.16, (y0 + y1) / 2, nm, fontproperties=MONO_B, fontsize=4.8,
                color=c, ha="center", va="center", rotation=90, zorder=6)

    for i, d in enumerate(["I", "II", "III", "IV", "V", "VI", "VII"]):
        ax.text(gl + i * cw + cw / 2, gt + 0.46, d, fontproperties=COND_B, fontsize=11,
                color=BRASS if i == ti else GREY_3, ha="center", va="bottom", zorder=6)

    # The type scale: four sizes, measured rather than described, with nothing in the middle.
    sy = 3.42
    for k, (nm, wdt, lw, pt) in enumerate([("DISPLAY", 8.6, 1.6, "46"), ("TITLE", 6.0, 1.05, "17"),
                                           ("BODY", 3.9, 0.72, "11"), ("LABEL", 2.3, 0.5, "07")]):
        yy = sy - k * 0.36
        hair(ax, L, yy, x(wdt), yy, c=INK if k == 0 else GREY_2, lw=lw)
        tx(ax, x(9.3), yy, nm, size=4.6, c=GREY_2)
        hair(ax, x(11.4), yy, R - 0.34, yy, c=RULE, lw=0.4, alpha=0.9)
        tx(ax, R, yy, pt, size=4.6, c=GREY_2, ha="right")
    tx(ax, L, sy + 0.34, "IV SIZES · NO MIDDLE", size=4.6, c=GREY_3)
    tx(ax, R, sy + 0.34, "XXVIII ROWS · VII COLUMNS", size=4.6, c=GREY_2, ha="right")

    tx(ax, L, 1.62, "fig. 3", size=4.6, c=GREY_2, font=MONO_B)
    tx(ax, R, 1.62, "an instrument, not an illustration", size=4.6, c=GREY_2, ha="right")

    pdf.savefig(fig, facecolor=GROUND)
    plt.close(fig)


out = Path(__file__).with_name("MERIDIAN-ORDER.pdf")
with PdfPages(out) as pdf:
    plate_one(pdf)
    plate_two(pdf)
    plate_three(pdf)
print("wrote", out)

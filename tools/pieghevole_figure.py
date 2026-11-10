import pdfplumber,re,json,numpy as np
from PIL import Image
S=200/72
pdf=pdfplumber.open('work/pieg/p.pdf'); out={}
def edge(a,x,y,dx,dy,limit):
    # cammina da (x,y) finché trova una linea scura lunga perpendicolare alla direzione
    H,W=a.shape
    for k in range(5,limit):
        xx,yy=x+dx*k,y+dy*k
        if not(0<=xx<W and 0<=yy<H): return xx-dx,yy-dy
        def seg(xx,yy):
            if not(0<=xx<W and 0<=yy<H): return 0
            return (a[max(0,yy-25):yy+25,xx] if dx else a[yy,max(0,xx-25):xx+25]).mean()
        if seg(xx,yy)>0.9 and seg(xx-6*abs(dx),yy-6*abs(dy))<0.5 and seg(xx+6*abs(dx),yy+6*abs(dy))<0.5: return xx,yy
    return None
for pi,p in enumerate(pdf.pages[1:],start=1):
    rgb=Image.open(f'work/pieg/r/p-{pi+1}.png').convert('RGB'); a=np.array(rgb.convert('L'))<120
    for w in p.extract_words():
        if not re.fullmatch(r'\d{1,3}',w['text']) or w['top']>800: continue
        n=int(w['text']); x=int((w['x0']+w['x1'])/2*S); y=int((w['bottom'])*S)+30
        r=edge(a,x,y,1,0,1600); b=edge(a,x,y,0,1,1400); l=edge(a,x,y,-1,0,200); t=edge(a,x,y,0,-1,200)
        if None in (r,b,l,t): print('fail',n,r,b,l,t); continue
        box=(l[0]+3,t[1]+3,r[0]-2,b[1]-2)
        rgb.crop(box).save(f'work/pieg/figs/f{n:03d}.png')
        out[n]=box
print(len(out),sorted(set(range(1,104))-set(out)))
json.dump(out,open('work/pieg/boxes.json','w'))

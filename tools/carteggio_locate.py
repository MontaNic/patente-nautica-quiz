import subprocess,csv,io,json,re,os,difflib
from PIL import Image
src='work/carthr'; out='work/cartimg'; os.makedirs(out,exist_ok=True)
def sim(a,b): return difflib.SequenceMatcher(None,a.lower(),b.lower()).ratio()
res=[];section=None
for pg in range(2,19):
    path=f'{src}/c-{pg:02d}.png'; im=Image.open(path); W,H=im.size
    t=subprocess.run(['tesseract',path,'-','-l','ita','--psm','4','tsv'],capture_output=True,text=True).stdout
    ws=[r for r in csv.DictReader(io.StringIO(t),delimiter='\t',quoting=csv.QUOTE_NONE) if r.get('text','').strip()]
    for w in ws:
        for k in('left','top','width','height'): w[k]=int(w[k])
    lines={}
    for w in ws: lines.setdefault((w['block_num'],w['par_num'],w['line_num']),[]).append(w)
    L=sorted([sorted(v,key=lambda w:w['left']) for v in lines.values()],key=lambda v:v[0]['top'])
    txt=' '.join(w['text'] for w in ws)
    if 'SETTORE' in txt:
        m=re.search(r'SETTORE\s+(NORD OVEST ORIZZONTALE|NORD OVEST VERTICALE|SUD EST|[A-Z]+ [A-Z]+)',txt); section=m.group(0) if m else section
    starts=[];sols=[]
    for l in L:
        f=l[0]; 
        if f['left']<W*0.15: 
            if len(l)>1: f=l[1]
            else: continue
        nxt=l[l.index(f)+1]['text'] if l.index(f)+1<len(l) else ''
        if sim(f['text'],'Partenza')>0.7 or (f['text']=='Si' and sim(nxt,'parte')>0.7): starts.append(f['top'])
        if sim(f['text'],'distanza')>0.7: sols.append(f['top'])
    starts=[x for x in starts if not any(0<x-y<100 for y in sols)]
    textlines=[l for l in L if l[-1]['left']>W*0.15]
    for i,s in enumerate(starts):
        lim=starts[i+1]-5 if i+1<len(starts) else H*0.95
        e=max(w['top']+w['height'] for l in textlines if s<=l[0]['top']<lim for w in l if w['left']>W*0.15)+3
        sol=[y for y in sols if s<y<e]
        num=[w['text'] for w in ws if w['left']<W*0.2 and s-20<w['top']<e and re.fullmatch(r'\d{1,2}[.,]?',w['text'])]
        rec={'page':pg,'section':section,'n':num[0].rstrip('.') if num else None,'y0':s-1,'ys':(sol[0]-10) if sol else None,'y1':e}
        res.append(rec)
json.dump(res,open('work/cart.json','w'),indent=1)
import collections
print(collections.Counter(r['page'] for r in res))
print([(r['section'][8:],r['n']) for r in res])
print([r for r in res if r['ys'] is None or r['y1']-r['y0']>600])
print(len(res))

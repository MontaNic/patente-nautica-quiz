import json,os
from PIL import Image
res=json.load(open('work/cart.json'))
out='work/repo_cart'; os.makedirs(out,exist_ok=True)
items=[];cnt={}
names={'SETTORE NORD OVEST ORIZZONTALE':'Nord-Ovest orizzontale','SETTORE NORD OVEST VERTICALE':'Nord-Ovest verticale','SETTORE SUD EST':'Sud-Est'}
for r in res:
    sec=names[r['section']]; cnt[sec]=cnt.get(sec,0)+1; n=cnt[sec]
    im=Image.open(f"work/carthr/c-{r['page']:02d}.png").convert('L'); W,H=im.size
    x0,x1=int(W*0.07),int(W*0.94)
    sid={'Nord-Ovest orizzontale':'noo','Nord-Ovest verticale':'nov','Sud-Est':'se'}[sec]
    pid=f'{sid}{n:02d}'
    for part,(a,b) in {'p':(r["y0"],r["ys"]),'s':(r['ys'],r['y1'])}.items():
        c=im.crop((x0,a,x1,b)); c=c.resize((int(c.width*0.75),int(c.height*0.75)),Image.LANCZOS)
        c.save(f'{out}/{pid}_{part}.jpg',quality=72,optimize=True)
    items.append({'id':pid,'settore':sec,'n':n,'page':r['page']})
json.dump(items,open('work/carteggio.json','w'),ensure_ascii=False,indent=1)
print(len(items))

import pdfplumber,sys,re,json
VFX=[477,597,724]
def col(x):
    if x<140: return 'num'
    if x<377: return 'q'
    if x<472: return 'a0'
    if x<592: return 'a1'
    return 'a2'
out=[];issues=[]
with pdfplumber.open(sys.argv[1]) as pdf:
    for pi,p in enumerate(pdf.pages):
        ws=p.extract_words(keep_blank_chars=False,use_text_flow=False)
        anchors=[w for w in ws if re.fullmatch(r'\d{1,4}',w['text']) and w['x0']<120]
        anchors.sort(key=lambda w:w['top'])
        tops=[a['top'] for a in anchors]
        pre=[w for w in ws if tops and w['top']<tops[0]-3]
        if pre and pi>0: issues.append(('pre',pi,' '.join(w['text'] for w in pre)[:80]))
        for k,a in enumerate(anchors):
            lo=a['top']-3; hi=(tops[k+1]-3) if k+1<len(tops) else 1e9
            rw=[w for w in ws if lo<=w['top']<hi and w is not a]
            vf={}
            txt={'q':[],'a0':[],'a1':[],'a2':[]}
            for w in sorted(rw,key=lambda w:(round(w['top']),w['x0'])):
                if w['text'] in('V','F','v','f') and any(abs(w['x0']-x)<8 for x in VFX):
                    j=min(range(3),key=lambda j:abs(w['x0']-VFX[j]))
                    if j in vf: issues.append(('dupvf',a['text'],pi))
                    vf[j]=w['text'].upper(); continue
                c=col(w['x0'])
                if c=='num': issues.append(('numcol',a['text'],w['text']));continue
                txt[c].append(w['text'])
            imgs=[im for im in p.images if (im['x1']-im['x0'])>15 and (im['bottom']-im['top'])>15 and lo<= (im['top']+im['bottom'])/2 <hi]
            corr=[j for j in range(3) if vf.get(j)=='V']
            rec={'id':int(a['text']),'q':' '.join(txt['q']),'a':[' '.join(txt[c]) for c in('a0','a1','a2')],
                 'c':corr[0] if len(corr)==1 else None,'vf':[vf.get(j,'') for j in range(3)],'page':pi,
                 'img':[(im['x0'],im['top'],im['x1'],im['bottom']) for im in imgs]}
            if len(corr)!=1 or len(vf)!=3: issues.append(('vf',rec['id'],vf))
            out.append(rec)
json.dump(out,open(sys.argv[2],'w'),ensure_ascii=False,indent=0)
ids=[r['id'] for r in out]
print('n',len(out),'ids ok',ids==list(range(1,len(ids)+1)))
missing=sorted(set(range(1,max(ids)+1))-set(ids)); print('missing',missing[:20])
for i in issues: print(i)
print('with img',sum(1 for r in out if r['img']),'multi img',[r['id'] for r in out if len(r['img'])>1][:30])
print('figura no img',[r['id'] for r in out if re.search('figur|disegn|immagin',r['q'],re.I) and not r['img']])
print('empty',[r['id'] for r in out if not r['q'] or not all(r['a'])])

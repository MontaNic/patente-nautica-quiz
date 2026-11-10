import json,re,sys
from PIL import Image
raw=json.load(open('work/raw.json'))
S=200/72  # (non più usato per le figure: ora arrivano dal pieghevole)
TOPICS=[(1,125,'Scafo, timone ed elica'),(126,229,'Motori'),(230,444,'Sicurezza, dotazioni, soccorso e VHF'),
 (445,497,'Porti, limiti di navigazione e pesca'),(498,599,'Ancoraggio, ormeggio e manovre'),
 (600,726,'Regolamento abbordi (COLREG) e fanali'),(727,846,'Segnalamenti marittimi e navigazione fluviale'),
 (847,966,'Meteorologia'),(967,1288,'Navigazione, bussola e pubblicazioni nautiche'),(1289,1472,'Normativa da diporto')]
def topic(i): return next(k for k,(a,b,_) in enumerate(TOPICS) if a<=i<=b)
FIX_TEXT={
 8:{'a2':'la superficie verticale interna del pozzetto di poppa.'},
 153:{'q':'Quale può essere la causa più probabile in base alla quale un motore entrobordo emette fumo nero dallo scarico?'},
 433:{'a1':'solo in caso di comunicazioni riguardanti la sicurezza.','a2':'solo per la prima chiamata; per proseguire la comunicazione bisogna poi spostarsi su un altro canale.'},
 1025:{'q':'Si usa la carta gnomonica per la navigazione costiera stimata?','a0':'sempre.'},
}
DOUBLE_V={127:1,174:1,188:1,226:0,297:None}
INFERRED={97:2,312:2,433:2,692:0,781:1,1425:1}
NOIMG=[]
FIG={int(k):v for k,v in json.load(open('work/pieg/figmap.json')).items()}
MOVED={688:'Nel PDF dei quiz la figura era stampata sulla riga della domanda precedente (687).',759:'Nel PDF dei quiz la figura era stampata sulla riga della domanda precedente (758).'}
ADDED={654,752,831}
out=[];anom=[]
for r in raw:
    i=r['id']; q=r['q']; a=list(r['a']); c=r['c']; note=None
    for k,v in FIX_TEXT.get(i,{}).items():
        if k=='q': q=v
        else: a[int(k[1])]=v
    a=[re.sub(r'^[vV] (?=è)','',x) for x in a]
    if i in DOUBLE_V:
        c=DOUBLE_V[i]
        note='Nel PDF ufficiale due risposte sono segnate come vere.'+(' Qui è considerata corretta quella indicata: verificala sul manuale.' if c is not None else ' Domanda esclusa dalle simulazioni finché non la verifichi.')
    elif i in INFERRED:
        c=INFERRED[i]; note='Nel PDF ufficiale manca una V/F: la risposta corretta è dedotta dalle altre due segnate F (o dall\'unica V).'
    if i in NOIMG: note='La figura citata manca anche nel PDF ufficiale.'
    if i in FIX_TEXT and not note: note='Testo ricostruito: nel PDF ufficiale era sovrapposto o troncato.'
    img=None
    if i in FIG:
        n=FIG[i]; img=f'f{n:03d}.png'
        import os
        if not os.path.exists('repo/data/img/'+img):
            fim=Image.open(f'work/pieg/figs/f{n:03d}.png').convert('RGB')
            from PIL import ImageDraw
            ImageDraw.Draw(fim).rectangle([0,0,80,48],fill='white')
            fim.save('repo/data/img/'+img,optimize=True)
    if i in MOVED: note=MOVED[i]
    if i in ADDED: note='Nel PDF dei quiz la figura manca: è stata presa dal pieghevole ufficiale delle figure (scelta da verificare).'
    trunc=False
    for k,x in enumerate(a):
        if re.search(r'\b(del|della|dello|dei|degli|di|la|le|il|lo|per|alle|ai|al|con|nel|nella|ed|e|a|da|in|che|previste|sotto|un|una|tra|su|15)$',x.strip()): a[k]=x.rstrip()+' […]'; trunc=True
    if not re.search(r'[.;:!?)"”’,]$',q.strip()) and len(q)>45 and not re.search(r'(è|sono|di|il|la|a|da|per|tra|in|con|deve|devono|mostra|indica|significa|chiamato|denominat[oa]|detto|chiama)$',q.strip()): pass
    if trunc and not note: note='Una o più risposte sono troncate già nel PDF ufficiale (segnate con […]).'
    assert c is None or 0<=c<=2
    rec={'id':i,'t':topic(i),'q':q,'a':a,'c':c}
    if img: rec['img']=img; rec['fig']=FIG[i]
    if note: rec['note']=note; anom.append(i)
    out.append(rec)
json.dump({'source':'Quiz Base patente nautica entro 12 miglia, solo motore — Allegato A al D.D. n. 106 del 12/05/2022',
 'topics':[t[2] for t in TOPICS],'questions':out},open('repo/data/quiz.json','w'),ensure_ascii=False,separators=(',',':'))
print(len(out),'anomalie',anom,'img',sum(1 for x in out if 'img' in x),'c None',[x['id'] for x in out if x['c'] is None])
print([ (x['id'],x['a'][2][:20]) for x in out if x['id'] in (1418,)])

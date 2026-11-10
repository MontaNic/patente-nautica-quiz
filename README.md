# Quiz Patente Nautica — entro 12 miglia, solo motore

App web per allenarsi ai quiz ministeriali della patente nautica **entro 12 miglia dalla costa, a motore**. Funziona da telefono, si installa come app e va anche offline. Non ha server né account: i progressi restano nel browser.

> App non ufficiale. In caso di dubbio vale il testo ministeriale.

## Cosa fa

- **Studio di oggi**: ripassi in scadenza + domande nuove. L'obiettivo giornaliero si calcola dalla data dell'esame, in modo da vedere tutte le 1.472 domande entro 3 giorni dalla prova.
- **Sessione rapida**: 10 domande, da fare la sera in 5 minuti.
- **Ripetizione dilazionata (Leitner a 5 scatole)**: se sbagli una domanda torna nella stessa sessione e il giorno dopo. Se la indovini torna dopo 1, 3, 7 e poi 16 giorni.
- **Risposte mescolate a ogni giro**, così impari il concetto e non la posizione.
- **Simulazione d'esame**: 20 domande, 30 minuti, superata con al massimo 4 errori, risultati solo alla consegna.
- **Per argomento**, **ripasso errori**, **domande segnate ⭐** e **ricerca nel testo**.
- **Carteggio**: i 50 problemi ufficiali sulla carta 5/D con la soluzione nascosta. Il problema si risolve sulla carta, l'app serve per controllare il risultato.
- Backup dei progressi in un file JSON, per passarli da un dispositivo all'altro.

## Fonti

- `data/quiz.json`: Quiz Base, Allegato A al D.D. n. 106 del 12/05/2022 (1.472 domande).
- `data/img/`: le 101 figure numerate del **pieghevole di supporto** ministeriale, quello che ricevi all'esame. Ogni domanda mostra il numero della figura come in sede d'esame, e c'è una galleria che collega ogni figura alle sue domande.
- `data/carteggio.json`: Quesiti problemi carteggio entro 12 miglia con soluzioni (D.M. 323 del 10/08/2021).

### Anomalie del PDF ufficiale

Le domande con un problema nel documento originale mostrano un avviso ⚠️ nell'app:

| Tipo | Domande |
|---|---|
| Due risposte segnate come vere: ne ho scelta una, da verificare | 127, 174, 188, 226 |
| Due risposte vere, scelta non possibile: esclusa dalle simulazioni | 297 |
| V/F mancante: risposta dedotta dalle altre | 97, 312, 433, 692, 781, 1425 |
| Figura stampata sulla riga sbagliata nel PDF dei quiz (spostata) | 687 → 688, 758 → 759 |
| Figura assente nel PDF dei quiz: presa dal pieghevole, abbinamento da verificare | 654 (fig. 49), 752 (fig. 69), 831 (fig. 79) |
| Testo sovrapposto, ricostruito | 8, 153, 433, 1025 |
| Risposte troncate nel PDF (segnate con […]) | 78, 236, 316, 390, 397, 668, 1060, 1080, 1283 |

Gli **argomenti** non sono nel PDF: li ho ricavati dalla numerazione delle domande, quindi i confini sono indicativi. Anche la simulazione d'esame pesca le domande in proporzione agli argomenti: è un'approssimazione, perché le schede ministeriali reali non sono pubbliche.

## Pubblicarla su GitHub Pages

1. Crea un repository pubblico e carica il contenuto di questa cartella.
2. Vai in **Settings → Pages**, scegli **Deploy from a branch**, branch `main`, cartella `/ (root)`.
3. Apri l'indirizzo `https://<utente>.github.io/<repo>/` dal telefono e usa **Aggiungi a schermata Home**.

## Provarla in locale

Il browser non carica i file JSON se apri `index.html` direttamente dal disco. Avvia un server:

```bash
python3 -m http.server 8000
# poi apri http://localhost:8000
```

## Struttura

```
index.html            pagina unica
css/style.css         stile (chiaro/scuro automatico)
js/srs.js             progressi e ripetizione dilazionata (localStorage)
js/app.js             interfaccia: studio, esame, argomenti, carteggio, ricerca
sw.js                 service worker per l'uso offline
data/                 domande, figure e ritagli del carteggio
tools/                script Python usati per estrarre i dati dai PDF
```

Se aggiungi o rinomini file, aggiorna l'elenco `FILES` in `sw.js` e cambia `VERSION`.

## Rigenerare i dati dai PDF

Gli script in `tools/` richiedono `pdfplumber`, `Pillow`, `numpy`, `scipy`, `poppler-utils` e `tesseract` (con la lingua italiana). Sono gli script usati una volta per creare i dati: li lascio come documentazione e i percorsi vanno adattati.

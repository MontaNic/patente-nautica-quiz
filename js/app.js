/* Patente Nautica · Quiz — app a pagina singola, senza dipendenze. */
(() => {
  'use strict';
  const $app = document.getElementById('app');
  const $title = document.getElementById('title');
  const $back = document.getElementById('back');
  const $timer = document.getElementById('timer');

  const EXAM = { n: 20, minutes: 30, maxErrors: 4 };
  const QUICK = 10;
  const LETTERS = ['A', 'B', 'C'];

  let DATA = null;       // { topics, questions }
  let BYID = {};
  let CART = null;       // { items }
  let timerHandle = null;

  // ---------- utilità ----------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const h = (html) => { $app.innerHTML = html; window.scrollTo(0, 0); };
  const allIds = () => DATA.questions.map((q) => q.id);
  const usable = (q) => q.c !== null && q.c !== undefined;

  function setHeader(title, back) {
    $title.textContent = title;
    $back.hidden = !back;
    $back.onclick = back || null;
  }
  function stopTimer() { clearInterval(timerHandle); timerHandle = null; $timer.hidden = true; }

  // ---------- caricamento ----------
  async function init() {
    try {
      const [q, c] = await Promise.all([fetch('data/quiz.json').then((r) => r.json()), fetch('data/carteggio.json').then((r) => r.json())]);
      DATA = q; CART = c;
      DATA.questions.forEach((x) => { BYID[x.id] = x; });
    } catch (e) {
      h('<div class="card"><p>Non riesco a caricare le domande. Se hai aperto il file direttamente dal disco, avvia un piccolo server (vedi README) oppure usa la versione su GitHub Pages.</p></div>');
      return;
    }
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
    window.addEventListener('hashchange', route);
    // un link verso la pagina in cui sei già non genera 'hashchange': in quel caso ricarico la vista a mano
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (a && a.getAttribute('href') === location.hash) { e.preventDefault(); route(); }
    });
    route();
  }

  function route() {
    stopTimer();
    document.onkeydown = null;
    const [view, arg] = location.hash.replace(/^#\/?/, '').split('/');
    switch (view) {
      case 'studio': return startSession(arg || 'quick');
      case 'argomento': return startSession('topic', Number(arg));
      case 'argomenti': return viewTopics();
      case 'esame': return startExam();
      case 'carteggio': return arg ? viewCartItem(arg) : viewCarteggio();
      case 'cerca': return viewSearch();
      case 'figure': return arg ? viewFigure(Number(arg)) : viewFigures();
      case 'domanda': return startSession('single', Number(arg));
      case 'impostazioni': return viewSettings();
      default: return viewHome();
    }
  }
  const go = (hash) => { if (location.hash === hash) route(); else location.hash = hash; };
  const home = () => go('#/');

  // ---------- home ----------
  function counts(ids = allIds()) {
    let seenN = 0, mastered = 0, due = 0, errors = 0, consol = 0;
    for (const id of ids) {
      const r = SRS.rec(id);
      if (r[2] > 0) seenN++;
      if (r[0] === 3) consol++;
      if (r[0] >= SRS.MASTERED) mastered++;
      if (SRS.isDue(id)) due++;
      if (r[2] > 0 && r[0] === 1) errors++;
    }
    return { total: ids.length, seen: seenN, mastered, due, errors, consol };
  }

  function viewHome() {
    setHeader('Patente Nautica');
    const c = counts();
    const left = SRS.daysLeft();
    const target = SRS.dailyNewTarget(allIds());
    const td = SRS.state.days[SRS.today()] || { n: 0, ok: 0, new: 0 };
    const newLeft = Math.max(0, target - td.new);
    const streak = SRS.streak();
    const lastExams = SRS.state.exams.slice(-5);
    const passed = lastExams.filter((e) => e.errors <= EXAM.maxErrors).length;
    const flags = SRS.state.flags.length;

    h(`
      <section class="card hero">
        <div class="countdown"><strong>${left}</strong><span>giorni all'esame<br><small>${fmtDate(SRS.state.settings.examDate)}</small></span></div>
        <div class="streak" title="Giorni consecutivi di studio">🔥 ${streak}</div>
      </section>

      <section class="card">
        <h2>Oggi</h2>
        <p class="today-line">${td.n ? `${td.n} risposte, ${pct(td.ok, td.n)}% giuste` : 'Non hai ancora iniziato.'}</p>
        <ul class="todo">
          <li><span>Ripassi in scadenza</span><b>${c.due}</b></li>
          <li><span>Domande nuove (obiettivo ${target})</span><b>${newLeft}</b></li>
        </ul>
        <a class="btn primary big" href="#/studio/oggi">${c.due + newLeft ? 'Studia il programma di oggi' : 'Fatto per oggi ✓ — continua comunque'}</a>
        <a class="btn big" href="#/studio/quick">⚡ Sessione rapida · ${QUICK} domande</a>
      </section>

      <section class="card">
        <h2>Progressi</h2>
        ${progressBar(c)}
        <p class="muted small">${c.mastered} imparate · ${c.consol} quasi (manca un ripasso) · ${c.seen - c.mastered - c.consol} da rafforzare · ${c.total - c.seen} mai viste</p>
        <p class="muted small">Una domanda diventa "imparata" quando la indovini anche al ripasso, a qualche giorno di distanza.</p>
      </section>

      <nav class="grid">
        <a class="tile" href="#/esame"><span>📝</span>Simulazione esame<small>${lastExams.length ? `superate ${passed}/${lastExams.length} ultime` : '20 domande · 30 min'}</small></a>
        <a class="tile" href="#/studio/errori"><span>🎯</span>Ripasso errori<small>${c.errors} da sistemare</small></a>
        <a class="tile" href="#/argomenti"><span>📚</span>Per argomento<small>${DATA.topics.length} argomenti</small></a>
        <a class="tile" href="#/carteggio"><span>🧭</span>Carteggio<small>${CART.items.length} problemi</small></a>
        <a class="tile" href="#/studio/segnate"><span>⭐</span>Segnate<small>${flags} domande</small></a>
        <a class="tile" href="#/cerca"><span>🔎</span>Cerca<small>nel testo</small></a>
        <a class="tile wide" href="#/figure"><span>🖼️</span>Figure del pieghevole<small>le 101 figure dell'esame, con le domande collegate</small></a>
      </nav>
      <p class="center"><a class="link" href="#/impostazioni">Impostazioni e backup</a></p>
    `);
  }

  function progressBar(c) {
    const m = pct(c.mastered, c.total), k = pct(c.consol, c.total), s = pct(c.seen - c.mastered - c.consol, c.total);
    return `<div class="bar" role="img" aria-label="${m}% imparate"><i class="m" style="width:${m}%"></i><i class="k" style="width:${k}%"></i><i class="s" style="width:${s}%"></i></div>
            <p class="bar-label"><b>${m}%</b> imparate · <b>${pct(c.consol, c.total)}%</b> quasi</p>`;
  }
  const fmtDate = (iso) => new Date(iso + 'T12:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'long' });

  // ---------- costruzione delle code ----------
  function dueSorted(ids) {
    return ids.filter((id) => SRS.isDue(id)).sort((a, b) => SRS.box(a) - SRS.box(b) || SRS.rec(a)[1] - SRS.rec(b)[1]);
  }
  function unseenInOrder(ids) { return ids.filter((id) => !SRS.seen(id)); }

  // Le domande nuove vengono pescate un argomento alla volta, a rotazione,
  // così ogni giorno vedi un po' di tutto invece di 300 domande di scafo di fila.
  function pickNew(n, pool = allIds()) {
    const byTopic = DATA.topics.map(() => []);
    unseenInOrder(pool).forEach((id) => byTopic[BYID[id].t].push(id));
    const out = [];
    let k = 0;
    while (out.length < n && byTopic.some((l) => l.length)) {
      const list = byTopic[k % byTopic.length];
      if (list.length) out.push(...list.splice(0, Math.min(3, n - out.length)));
      k++;
    }
    return out;
  }

  function buildQueue(mode, arg) {
    const ids = allIds();
    switch (mode) {
      case 'oggi': {
        const due = dueSorted(ids);
        const td = SRS.state.days[SRS.today()] || { new: 0 };
        const newLeft = Math.max(0, SRS.dailyNewTarget(ids) - td.new);
        const q = due.concat(pickNew(newLeft));
        return q.length ? q : pickNew(QUICK).concat(lowestBox(ids, QUICK));
      }
      case 'quick': {
        const due = dueSorted(ids).slice(0, 6);
        const q = due.concat(pickNew(QUICK - due.length));
        return q.length >= QUICK ? q.slice(0, QUICK) : q.concat(lowestBox(ids.filter((i) => !q.includes(i)), QUICK - q.length));
      }
      case 'errori': {
        const wrong = ids.filter((id) => SRS.seen(id) && SRS.box(id) <= 2)
          .sort((a, b) => SRS.box(a) - SRS.box(b) || SRS.rec(b)[3] - SRS.rec(a)[3]);
        return wrong.slice(0, 20);
      }
      case 'segnate': return shuffle(SRS.state.flags.filter((id) => BYID[id]));
      case 'topic': {
        const pool = ids.filter((id) => BYID[id].t === arg);
        const due = dueSorted(pool);
        const fresh = unseenInOrder(pool);
        const q = due.concat(fresh).slice(0, 15);
        return q.length >= 15 ? q : q.concat(lowestBox(pool.filter((i) => !q.includes(i)), 15 - q.length));
      }
      case 'single': return BYID[arg] ? [arg] : [];
    }
    return [];
  }
  function lowestBox(ids, n) {
    return shuffle(ids.filter((id) => SRS.seen(id))).sort((a, b) => SRS.box(a) - SRS.box(b)).slice(0, n);
  }

  // ---------- sessione di studio ----------
  const MODE_TITLE = { oggi: 'Studio di oggi', quick: 'Sessione rapida', errori: 'Ripasso errori', segnate: 'Domande segnate', topic: 'Argomento', single: 'Domanda' };

  function startSession(mode, arg) {
    const queue = buildQueue(mode, arg);
    const back = mode === 'topic' ? () => go('#/argomenti') : mode === 'single' ? () => history.back() : home;
    setHeader(mode === 'topic' ? DATA.topics[arg] : MODE_TITLE[mode] || 'Studio', back);
    if (!queue.length) {
      const msg = { errori: 'Nessun errore da ripassare. Ottimo.', segnate: 'Non hai ancora segnato domande. Usa la ⭐ durante lo studio.' }[mode] || 'Niente da fare qui.';
      return h(`<div class="card center"><p>${msg}</p><a class="btn primary" href="#/">Torna alla home</a></div>`);
    }
    const s = { mode, queue: queue.slice(), i: 0, ok: 0, done: 0, wrongs: [], requeued: new Set() };
    showQuestion(s);
  }

  function showQuestion(s) {
    if (s.i >= s.queue.length) return sessionEnd(s);
    const q = BYID[s.queue[s.i]];
    const order = shuffle([0, 1, 2]);
    const b = SRS.box(q.id);
    const tag = !SRS.seen(q.id) ? '<span class="tag new">nuova</span>' : b >= SRS.MASTERED ? '<span class="tag ok">imparata</span>' : `<span class="tag">scatola ${b}</span>`;
    h(`
      <div class="progress-mini"><i style="width:${pct(s.i, s.queue.length)}%"></i></div>
      <div class="meta"><span>${s.i + 1} / ${s.queue.length}</span>${tag}<span class="muted">#${q.id} · ${esc(DATA.topics[q.t])}</span></div>
      <article class="card question">
        ${q.img ? `<figure class="fig"><img class="qimg" src="data/img/${q.img}" alt="Figura ${q.fig}"><figcaption>Figura ${q.fig}</figcaption></figure>` : ''}
        <p class="qtext">${esc(q.q)}</p>
        <div class="answers">
          ${order.map((k, pos) => `<button class="ans" data-k="${k}"><b>${LETTERS[pos]}</b><span>${esc(q.a[k])}</span></button>`).join('')}
        </div>
        ${q.note ? `<p class="note">⚠️ ${esc(q.note)}</p>` : ''}
      </article>
      <div class="actions">
        <button class="btn ghost" id="flag">${SRS.isFlagged(q.id) ? '★ Segnata' : '☆ Segna'}</button>
        <button class="btn primary" id="next" hidden>Avanti →</button>
        <button class="btn ghost" id="skip">Salta</button>
      </div>
    `);
    const $next = document.getElementById('next');
    const $skip = document.getElementById('skip');
    let answered = false;

    const choose = (btn) => {
      if (answered) return;
      answered = true;
      const k = Number(btn.dataset.k);
      const correct = usable(q) ? k === q.c : null;
      $app.querySelectorAll('.ans').forEach((el) => {
        el.disabled = true;
        if (usable(q) && Number(el.dataset.k) === q.c) el.classList.add('right');
      });
      if (correct === false) btn.classList.add('wrong');
      if (correct !== null) {
        SRS.answer(q.id, correct);
        s.done++;
        if (correct) s.ok++;
        else {
          s.wrongs.push(q.id);
          // la ripropongo una volta più avanti nella stessa sessione
          if (!s.requeued.has(q.id) && s.mode !== 'single') {
            s.requeued.add(q.id);
            s.queue.splice(Math.min(s.queue.length, s.i + 4), 0, q.id);
          }
        }
        if (navigator.vibrate && !correct) navigator.vibrate(60);
      }
      $skip.hidden = true;
      $next.hidden = false;
      $next.focus({ preventScroll: true });
    };
    $app.querySelectorAll('.ans').forEach((el) => { el.onclick = () => choose(el); });
    const advance = () => { s.i++; showQuestion(s); };
    $next.onclick = advance;
    $skip.onclick = advance;
    document.getElementById('flag').onclick = (e) => { e.target.textContent = SRS.toggleFlag(q.id) ? '★ Segnata' : '☆ Segna'; };
    document.onkeydown = (e) => {
      if (['1', '2', '3', 'a', 'b', 'c'].includes(e.key.toLowerCase()) && !answered) {
        const pos = '123'.includes(e.key) ? Number(e.key) - 1 : 'abc'.indexOf(e.key.toLowerCase());
        choose($app.querySelectorAll('.ans')[pos]);
      } else if ((e.key === 'Enter' || e.key === ' ') && answered) { e.preventDefault(); advance(); }
    };
  }

  function sessionEnd(s) {
    document.onkeydown = null;
    const uniqueWrong = [...new Set(s.wrongs)];
    const c = counts();
    h(`
      <section class="card center">
        <h2>Sessione finita</h2>
        <p class="big-number">${s.done ? pct(s.ok, s.done) : 0}%</p>
        <p class="muted">${s.ok} giuste su ${s.done} risposte</p>
        ${progressBar(c)}
      </section>
      ${uniqueWrong.length ? `<section class="card"><h2>Da rivedere</h2>${uniqueWrong.map((id) => reviewItem(id)).join('')}</section>` : ''}
      <div class="actions col">
        <a class="btn primary" href="#/studio/quick">Altre ${QUICK} domande</a>
        <a class="btn" href="#/">Home</a>
      </div>
    `);
  }

  function reviewItem(id, chosen) {
    const q = BYID[id];
    return `<details class="review"><summary><span class="muted">#${id}</span> ${esc(q.q)}</summary>
      ${q.img ? `<img class="qimg small" src="data/img/${q.img}" alt="">` : ''}
      ${chosen !== undefined && chosen !== null && chosen !== q.c ? `<p class="wrong-text">✗ ${esc(q.a[chosen])}</p>` : ''}
      <p class="right-text">✓ ${usable(q) ? esc(q.a[q.c]) : 'risposta ufficiale ambigua'}</p>
      ${q.note ? `<p class="note">⚠️ ${esc(q.note)}</p>` : ''}</details>`;
  }

  // ---------- simulazione d'esame ----------
  function examQuestions() {
    // estrazione proporzionale agli argomenti (approssimazione: le schede ministeriali reali non sono pubbliche)
    const pools = DATA.topics.map((_, t) => shuffle(DATA.questions.filter((q) => q.t === t && usable(q)).map((q) => q.id)));
    const total = pools.reduce((a, p) => a + p.length, 0);
    const quota = pools.map((p) => (p.length / total) * EXAM.n);
    const take = quota.map(Math.floor);
    let rest = EXAM.n - take.reduce((a, b) => a + b, 0);
    quota.map((q, i) => [q - Math.floor(q), i]).sort((a, b) => b[0] - a[0]).slice(0, rest).forEach(([, i]) => take[i]++);
    return shuffle(pools.flatMap((p, i) => p.slice(0, take[i])));
  }

  function startExam() {
    setHeader('Simulazione esame', home);
    h(`<section class="card">
        <h2>Simulazione Quiz Base</h2>
        <ul class="plain">
          <li>${EXAM.n} domande estratte da tutti gli argomenti</li>
          <li>${EXAM.minutes} minuti</li>
          <li>superata con al massimo ${EXAM.maxErrors} errori (almeno ${EXAM.n - EXAM.maxErrors} giuste)</li>
          <li>le risposte si vedono solo alla consegna, come all'esame</li>
        </ul>
        <p class="muted small">Le domande non risposte contano come errori.</p>
        <button class="btn primary big" id="go">Inizia</button>
      </section>`);
    document.getElementById('go').onclick = runExam;
  }

  function runExam() {
    const ids = examQuestions();
    const orders = ids.map(() => shuffle([0, 1, 2]));
    const answers = ids.map(() => null);
    const end = Date.now() + EXAM.minutes * 60000;
    let i = 0;
    let finished = false;
    setHeader('Esame in corso', () => { if (confirmLeave()) home(); });

    $timer.hidden = false;
    const tick = () => {
      const ms = end - Date.now();
      if (ms <= 0) { finish(true); return; }
      const m = Math.floor(ms / 60000), sec = Math.floor((ms % 60000) / 1000);
      $timer.textContent = `${m}:${String(sec).padStart(2, '0')}`;
      $timer.classList.toggle('warn', ms < 5 * 60000);
    };
    tick();
    timerHandle = setInterval(tick, 1000);

    function confirmLeave() { return answers.every((a) => a === null) || window.confirm('Abbandonare la simulazione?'); }

    function render() {
      const q = BYID[ids[i]];
      h(`
        <div class="dots">${ids.map((_, k) => `<button class="dot ${answers[k] !== null ? 'done' : ''} ${k === i ? 'cur' : ''}" data-k="${k}" aria-label="Domanda ${k + 1}">${k + 1}</button>`).join('')}</div>
        <article class="card question">
          <div class="meta"><span>Domanda ${i + 1} di ${ids.length}</span></div>
          ${q.img ? `<figure class="fig"><img class="qimg" src="data/img/${q.img}" alt="Figura ${q.fig}"><figcaption>Figura ${q.fig}</figcaption></figure>` : ''}
          <p class="qtext">${esc(q.q)}</p>
          <div class="answers">
            ${orders[i].map((k, pos) => `<button class="ans ${answers[i] === k ? 'picked' : ''}" data-k="${k}"><b>${LETTERS[pos]}</b><span>${esc(q.a[k])}</span></button>`).join('')}
          </div>
        </article>
        <div class="actions">
          <button class="btn" id="prev" ${i === 0 ? 'disabled' : ''}>← Prec.</button>
          <button class="btn" id="nxt" ${i === ids.length - 1 ? 'disabled' : ''}>Succ. →</button>
        </div>
        <button class="btn primary big" id="submit">Consegna (${answers.filter((a) => a !== null).length}/${ids.length})</button>
      `);
      $app.querySelectorAll('.ans').forEach((el) => {
        el.onclick = () => {
          answers[i] = Number(el.dataset.k);
          if (i < ids.length - 1) { i++; } // passa da sola alla successiva
          render();
        };
      });
      $app.querySelectorAll('.dot').forEach((el) => { el.onclick = () => { i = Number(el.dataset.k); render(); }; });
      document.getElementById('prev').onclick = () => { i--; render(); };
      document.getElementById('nxt').onclick = () => { i++; render(); };
      document.getElementById('submit').onclick = () => {
        const missing = answers.filter((a) => a === null).length;
        if (!missing || window.confirm(`Hai ${missing} domande senza risposta. Consegnare lo stesso?`)) finish(false);
      };
      document.onkeydown = (e) => {
        const pos = '123'.indexOf(e.key);
        if (pos >= 0) $app.querySelectorAll('.ans')[pos].click();
        if (e.key === 'ArrowRight' && i < ids.length - 1) { i++; render(); }
        if (e.key === 'ArrowLeft' && i > 0) { i--; render(); }
      };
    }

    function finish(timeout) {
      if (finished) return;
      finished = true;
      stopTimer();
      document.onkeydown = null;
      let errors = 0;
      ids.forEach((id, k) => {
        const ok = answers[k] === BYID[id].c;
        if (!ok) errors++;
        if (answers[k] !== null) SRS.answer(id, ok);
      });
      const passed = errors <= EXAM.maxErrors;
      const used = Math.round((EXAM.minutes * 60000 - Math.max(0, end - Date.now())) / 60000);
      SRS.addExam({ date: Date.now(), errors, minutes: used });
      setHeader('Risultato', home);
      const wrongIdx = ids.map((id, k) => k).filter((k) => answers[k] !== BYID[ids[k]].c);
      h(`
        <section class="card center ${passed ? 'pass' : 'fail'}">
          <p class="verdict">${passed ? 'SUPERATA' : 'NON SUPERATA'}</p>
          <p class="big-number">${errors} <small>errori</small></p>
          <p class="muted">${timeout ? 'Tempo scaduto · ' : ''}${used} min usati · massimo ${EXAM.maxErrors} errori</p>
        </section>
        ${wrongIdx.length ? `<section class="card"><h2>Errori</h2>${wrongIdx.map((k) => reviewItem(ids[k], answers[k])).join('')}</section>` : ''}
        ${examHistory()}
        <div class="actions col">
          <button class="btn primary" id="again">Nuova simulazione</button>
          <a class="btn" href="#/">Home</a>
        </div>
      `);
      document.getElementById('again').onclick = runExam;
    }
    render();
  }

  function examHistory() {
    const ex = SRS.state.exams.slice(-10).reverse();
    if (ex.length < 2) return '';
    return `<section class="card"><h2>Ultime simulazioni</h2><ul class="hist">${ex.map((e) => `<li class="${e.errors <= EXAM.maxErrors ? 'ok' : 'ko'}"><span>${new Date(e.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</span><b>${e.errors} errori</b></li>`).join('')}</ul></section>`;
  }

  // ---------- argomenti ----------
  function viewTopics() {
    setHeader('Per argomento', home);
    const rows = DATA.topics.map((name, t) => {
      const ids = DATA.questions.filter((q) => q.t === t).map((q) => q.id);
      const c = counts(ids);
      let tot = 0, wr = 0;
      ids.forEach((id) => { const r = SRS.rec(id); tot += r[2]; wr += r[3]; });
      const acc = tot ? pct(tot - wr, tot) : null;
      return `<a class="topic" href="#/argomento/${t}">
        <div><b>${esc(name)}</b><small>${c.total} domande · ${c.seen} viste · ${acc === null ? '—' : acc + '% giuste'}</small></div>
        <div class="ring" style="--p:${pct(c.mastered, c.total)}"><span>${pct(c.mastered, c.total)}%</span></div></a>`;
    });
    h(`<p class="muted small pad">Percentuale = domande imparate. Gli argomenti li ho ricavati dalla numerazione del PDF: il documento ufficiale non li riporta.</p>${rows.join('')}`);
  }

  // ---------- carteggio ----------
  function cartState() { if (!SRS.state.cart) SRS.state.cart = {}; return SRS.state.cart; }

  function viewCarteggio() {
    setHeader('Carteggio', home);
    const st = cartState();
    const groups = {};
    CART.items.forEach((it) => { (groups[it.settore] = groups[it.settore] || []).push(it); });
    const done = CART.items.filter((it) => st[it.id] === 'ok').length;
    h(`<section class="card">
        <p>Problemi ufficiali sulla carta 5/D. Risolvili sulla carta con squadrette e compasso, poi confronta qui la soluzione.</p>
        <p class="muted small">${done}/${CART.items.length} risolti correttamente</p>
      </section>
      ${Object.entries(groups).map(([sec, items]) => `<section class="card"><h2>Settore ${esc(sec)}</h2><div class="chips">
        ${items.map((it) => `<a class="chip ${st[it.id] || ''}" href="#/carteggio/${it.id}">${it.n}</a>`).join('')}</div></section>`).join('')}
      <p class="muted small pad">Le immagini sono ritagli della scansione ministeriale: in alcune ci sono annotazioni a penna di chi ha scansionato il documento.</p>`);
  }

  function viewCartItem(id) {
    const idx = CART.items.findIndex((x) => x.id === id);
    const it = CART.items[idx];
    if (!it) return viewCarteggio();
    setHeader(`${it.settore} · n. ${it.n}`, () => go('#/carteggio'));
    const st = cartState();
    const prev = CART.items[idx - 1], next = CART.items[idx + 1];
    h(`<article class="card">
        <div class="scan-wrap"><img class="scan" src="data/carteggio/${it.id}_p.jpg" alt="Testo del problema ${it.n}"></div>
        <p class="muted small">Tocca il testo per ingrandirlo (o gira il telefono).</p>
      </article>
      <button class="btn big" id="show">Mostra soluzione</button>
      <article class="card" id="sol" hidden>
        <div class="scan-wrap"><img class="scan" src="data/carteggio/${it.id}_s.jpg" alt="Soluzione del problema ${it.n}"></div>
        <p class="muted small">I valori sono intervalli di tolleranza: se il tuo risultato cade dentro, è giusto.</p>
        <div class="actions">
          <button class="btn ${st[id] === 'ok' ? 'primary' : ''}" data-v="ok">✓ Mi torna</button>
          <button class="btn ${st[id] === 'ko' ? 'danger' : ''}" data-v="ko">✗ Da rifare</button>
        </div>
      </article>
      <div class="actions">
        ${prev ? `<a class="btn ghost" href="#/carteggio/${prev.id}">← ${prev.n}</a>` : '<span></span>'}
        ${next ? `<a class="btn ghost" href="#/carteggio/${next.id}">${next.n} →</a>` : '<span></span>'}
      </div>`);
    $app.querySelectorAll('.scan-wrap').forEach((w) => { w.onclick = () => w.classList.toggle('zoom'); });
    document.getElementById('show').onclick = (e) => { document.getElementById('sol').hidden = false; e.target.hidden = true; };
    $app.querySelectorAll('[data-v]').forEach((b) => {
      b.onclick = () => { st[id] = st[id] === b.dataset.v ? undefined : b.dataset.v; SRS.save(); viewCartItem(id); document.getElementById('show').click(); };
    });
  }

  // ---------- figure ----------
  function figIndex() {
    const m = {};
    DATA.questions.forEach((q) => { if (q.fig) (m[q.fig] = m[q.fig] || []).push(q.id); });
    return m;
  }
  function viewFigures() {
    setHeader('Figure', home);
    const m = figIndex();
    h(`<p class="muted small pad">All'esame le figure sono in un pieghevole a parte e il testo dice "figura N". Tocca una figura per vedere le domande che la usano.</p>
      <div class="figgrid">${Object.keys(m).map(Number).sort((a, b) => a - b).map((n) => `<a class="figcell" href="#/figure/${n}"><img loading="lazy" src="data/img/f${String(n).padStart(3, '0')}.png" alt="Figura ${n}"><b>${n}</b></a>`).join('')}</div>`);
  }
  function viewFigure(n) {
    const ids = figIndex()[n] || [];
    setHeader(`Figura ${n}`, () => go('#/figure'));
    h(`<article class="card center"><img class="qimg" src="data/img/f${String(n).padStart(3, '0')}.png" alt="Figura ${n}"></article>
      <section class="card"><h2>${ids.length} domand${ids.length === 1 ? 'a' : 'e'}</h2>${ids.map((id) => reviewItem(id)).join('')}</section>
      <div class="actions"><a class="btn primary" href="#/domanda/${ids[0]}">Prova la prima</a></div>`);
  }

  // ---------- ricerca ----------
  function viewSearch() {
    setHeader('Cerca', home);
    h(`<input class="search" id="s" type="search" placeholder="Parola o numero domanda (es. galloccia, 433)" autocomplete="off">
       <div id="res"></div>`);
    const $s = document.getElementById('s'), $r = document.getElementById('res');
    const norm = (x) => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const index = DATA.questions.map((q) => [q.id, norm(q.q + ' ' + q.a.join(' '))]);
    $s.oninput = () => {
      const t = norm($s.value.trim());
      if (t.length < 2) { $r.innerHTML = ''; return; }
      const hits = /^\d+$/.test(t) ? (BYID[t] ? [Number(t)] : []) : index.filter(([, x]) => x.includes(t)).map(([id]) => id);
      $r.innerHTML = `<p class="muted small pad">${hits.length} risultati</p>` + hits.slice(0, 60).map((id) => reviewItem(id)).join('');
    };
    $s.focus();
  }

  // ---------- impostazioni ----------
  function viewSettings() {
    setHeader('Impostazioni', home);
    const st = SRS.state.settings;
    h(`<section class="card form">
        <label>Data dell'esame <input type="date" id="date" value="${st.examDate}"></label>
        <label>Domande nuove al giorno <input type="number" id="daily" min="5" max="300" placeholder="automatico (${SRS.dailyNewTarget(allIds())})" value="${st.dailyNew || ''}"></label>
        <p class="muted small">Automatico = quante ne servono per vederle tutte entro 3 giorni prima dell'esame.</p>
      </section>
      <section class="card">
        <h2>Backup progressi</h2>
        <p class="muted small">I progressi stanno solo in questo browser. Esportali per spostarli su un altro dispositivo.</p>
        <div class="actions"><button class="btn" id="exp">Esporta</button><label class="btn">Importa<input type="file" id="imp" accept="application/json" hidden></label></div>
        <p id="msg" class="small"></p>
      </section>
      <section class="card">
        <h2>Azzera tutto</h2>
        <button class="btn danger" id="reset">Cancella i progressi</button>
      </section>
      <p class="muted small pad">Fonte: ${esc(DATA.source)}. App non ufficiale: in caso di dubbio vale il testo ministeriale.</p>`);
    document.getElementById('date').onchange = (e) => e.target.value && SRS.setSetting('examDate', e.target.value);
    document.getElementById('daily').onchange = (e) => SRS.setSetting('dailyNew', Number(e.target.value) || null);
    document.getElementById('exp').onclick = () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([SRS.exportJSON()], { type: 'application/json' }));
      a.download = `patente-nautica-progressi-${SRS.today()}.json`;
      a.click();
    };
    document.getElementById('imp').onchange = async (e) => {
      try { SRS.importJSON(await e.target.files[0].text()); document.getElementById('msg').textContent = 'Progressi importati ✓'; }
      catch (err) { document.getElementById('msg').textContent = 'File non valido.'; }
    };
    let armed = false;
    document.getElementById('reset').onclick = (e) => {
      if (!armed) { armed = true; e.target.textContent = 'Tocca di nuovo per confermare'; return; }
      SRS.reset(); home();
    };
  }

  init();
})();

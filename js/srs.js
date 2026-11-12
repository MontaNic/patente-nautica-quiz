/* Progressi e ripetizione dilazionata (sistema Leitner a 5 scatole).
   Scatola 0 = mai vista. Risposta giusta: sale di una scatola. Sbagliata: torna alla 1.
   Una domanda è "imparata" dalla scatola 4 in su. */
const SRS = (() => {
  const KEY = 'pn-progress-v1';
  const DAY = 86400000;
  // dopo quanti giorni una domanda della scatola N torna in ripasso
  const INTERVAL = [0, 0, 1, 3, 7, 16];
  const MASTERED = 4;

  const empty = () => ({ v: 1, q: {}, days: {}, exams: [], flags: [], settings: { examDate: '2026-12-16', dailyNew: null } });

  let state = load();

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.v === 1) {
        const st = Object.assign(empty(), s, { settings: Object.assign(empty().settings, s.settings) });
        // migrazione: le domande indovinate al primo colpo con la vecchia regola restavano in scatola 2
        if (!st.mig1) {
          Object.values(st.q).forEach((r) => { if (r[0] === 2 && r[2] === 1 && r[3] === 0) r[0] = 3; });
          st.mig1 = true;
          try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* ignora */ }
        }
        return st;
      }
    } catch (e) { /* storage non disponibile o corrotto */ }
    return empty();
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignora */ }
  }
  const today = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

  // record: [scatola, ultimoTimestamp, risposteTotali, errori]
  const rec = (id) => state.q[id] || [0, 0, 0, 0];
  const box = (id) => rec(id)[0];
  const seen = (id) => rec(id)[2] > 0;

  function isDue(id, now = Date.now()) {
    const r = state.q[id];
    if (!r || r[0] === 0) return false;
    return startOfDay(r[1]) + INTERVAL[r[0]] * DAY <= startOfDay(now) && (r[0] > 1 || now - r[1] > 60000);
  }

  function answer(id, correct, now = Date.now()) {
    const r = rec(id).slice();
    const wasNew = r[2] === 0;
    // Giusta al primo colpo: probabilmente la sai già, salta alla scatola 3 (ripasso tra 3 giorni).
    // Così basta una seconda risposta giusta per considerarla imparata.
    if (correct && wasNew) r[0] = 3;
    else r[0] = correct ? Math.min(5, Math.max(1, r[0]) + 1) : 1;
    r[1] = now; r[2] += 1; if (!correct) r[3] += 1;
    state.q[id] = r;
    const d = today(new Date(now));
    const day = state.days[d] || { n: 0, ok: 0, new: 0 };
    day.n++; if (correct) day.ok++; if (wasNew) day.new++;
    state.days[d] = day;
    save();
  }

  function streak(now = new Date()) {
    let n = 0; const d = new Date(now);
    if (!state.days[today(d)]) d.setDate(d.getDate() - 1); // oggi non ancora fatto: conta da ieri
    while (state.days[today(d)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  function daysLeft(now = new Date()) {
    const [y, m, dd] = state.settings.examDate.split('-').map(Number);
    const exam = new Date(y, m - 1, dd).getTime();
    return Math.max(0, Math.round((exam - startOfDay(now.getTime())) / DAY));
  }

  // Quante domande nuove al giorno servono per vederle tutte entro 3 giorni prima dell'esame
  function dailyNewTarget(ids) {
    if (state.settings.dailyNew) return state.settings.dailyNew;
    const unseen = ids.filter((id) => !seen(id)).length;
    const left = Math.max(1, daysLeft() - 3);
    const doneToday = (state.days[today()] || {}).new || 0;
    return Math.max(0, Math.ceil((unseen + doneToday) / left));
  }

  const toggleFlag = (id) => {
    const i = state.flags.indexOf(id);
    if (i >= 0) state.flags.splice(i, 1); else state.flags.push(id);
    save();
    return i < 0;
  };

  return {
    get state() { return state; },
    save, rec, box, seen, isDue, answer, streak, daysLeft, dailyNewTarget, toggleFlag, today, MASTERED,
    isFlagged: (id) => state.flags.includes(id),
    setSetting(k, v) { state.settings[k] = v; save(); },
    addExam(e) { state.exams.push(e); save(); },
    exportJSON: () => JSON.stringify(state),
    importJSON(txt) { const s = JSON.parse(txt); if (!s || s.v !== 1) throw new Error('File non valido'); state = Object.assign(empty(), s); save(); },
    reset() { state = empty(); save(); },
  };
})();

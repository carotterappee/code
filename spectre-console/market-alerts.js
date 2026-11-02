window.MarketAlerts = (() => {
  const rules = {
    'MC.PA': {name:'LVMH', unit:'€', drop:[35,40], price:[360,400]},
    'AI.PA': {name:'Air Liquide', unit:'€', drop:[20,25], price:[125,135]},
    'MSFT':  {name:'Microsoft', unit:'$', drop:[30,35], price:[270,290]}
  };
  const peaks = new Map();
  const active = new Set();
  const fmt = n => n.toLocaleString('fr-FR',{maximumFractionDigits:2});
  let audio, enabled=false, timer, generation=0;
  let displayed=null;

  async function get(symbol, history=false) {
    const url='/api/spectre-quotes?symbol='+encodeURIComponent(symbol)
      +(history?'&view=history':'');
    const r=await fetch(url,{signal:AbortSignal.timeout(15000)});
    if(!r.ok) throw Error('Source indisponible');
    const data=await r.json();
    if(data.symbol!==symbol) throw Error('Instrument inattendu');
    return data;
  }

  function peakFor(symbol) {
    let entry=peaks.get(symbol);
    if(!entry) {
      entry={value:null, observed:0, next:0, pending:null};
      peaks.set(symbol,entry);
    }
    if(!entry.pending && Date.now()>=entry.next) {
      entry.pending=get(symbol,true).then(data=>{
        const high=data.rows.reduce((v,r)=>Number.isFinite(r.high)?Math.max(v,r.high):v,0);
        if(!(high>0)) throw Error('Sommet indisponible');
        entry.value=high;
        entry.next=Date.now()+3600000;
      }).catch(()=>{
        entry.next=Date.now()+60000;
      }).finally(()=>{
        entry.pending=null;
        if(displayed?.symbol===symbol) paint();
      });
    }
    return entry;
  }

  function high(entry) {
    return entry.value ? Math.max(entry.value,entry.observed) : null;
  }

  function paint() {
    const badge=document.getElementById('peak-gap');
    if(!badge || !displayed) return;
    const {symbol,price}=displayed, entry=peaks.get(symbol);
    const top=entry && high(entry);
    if(!(price>0 && top>0)) {
      badge.textContent='— % du sommet';
      badge.title='En attente du cours ou du sommet historique';
      return;
    }
    const drop=Math.max(0,100*(1-price/top));
    badge.textContent=(drop?'−':'')+fmt(drop)+' % du sommet';
    badge.title='Sommet disponible : '+fmt(top)+' · '+symbol+
      ' · plus haut en séance, historique Yahoo Finance';
  }

  function display(symbol,price,sessionHigh) {
    displayed={symbol,price};
    const entry=peakFor(symbol);
    for(const v of [price,sessionHigh])
      if(Number.isFinite(v)) entry.observed=Math.max(entry.observed,v);
    paint();
  }

  function sound() {
    if(audio?.state!=='running') return;
    [660,880,990].forEach((frequency,i)=>{
      const osc=audio.createOscillator(), gain=audio.createGain();
      const t=audio.currentTime+i*.19;
      osc.frequency.value=frequency;
      gain.gain.setValueAtTime(.001,t);
      gain.gain.exponentialRampToValueAtTime(.14,t+.025);
      gain.gain.exponentialRampToValueAtTime(.001,t+.16);
      osc.connect(gain);gain.connect(audio.destination);
      osc.start(t);osc.stop(t+.17);
    });
  }

  function check(key,inside,message,events) {
    if(inside && !active.has(key)) events.push(message);
    if(inside) active.add(key);
    else active.delete(key);
  }

  async function poll(id) {
    const events=[];
    const statuses = new Map();
    await Promise.all(Object.entries(rules).map(async ([symbol,r])=>{
      try {
        const entry=peakFor(symbol);
        const d=await get(symbol);
        if(id!==generation || !enabled) return;
        // Évite une sonnerie sur la clôture de la veille ou du week-end.
        if (!(d.price > 0) || !Number.isFinite(d.time) || d.time <= 0) {
          statuses.set(symbol, 'cours ou heure indisponible');
          return;
        }
        if (Math.abs(Date.now() - d.time) > 30 * 60000) {
          const when = new Date(d.time).toLocaleString('fr-FR', {
            timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit',
            hour: '2-digit', minute: '2-digit'
          });
          statuses.set(symbol, 'en attente · dernier cours le ' + when + ' (Paris)');
          return;
        }
        statuses.set(symbol, 'surveillance active');
        const p=d.price;
        entry.observed=Math.max(entry.observed,p,Number.isFinite(d.high)?d.high:0);
        const [lo,hi]=r.price;
        check(symbol+'-prix',p>=lo && p<=hi,
          r.name+' · zone de prix · '+fmt(p)+' '+r.unit,events);

        if(entry.pending) await entry.pending;
        if(id!==generation || !enabled) return;
        const top=high(entry);
        if(!top) { statuses.set(symbol, 'prix surveillé · sommet indisponible'); return; }
        const drop=100*(top-p)/top;
        const [min,max]=r.drop;
        check(symbol+'-baisse',drop>=min-1e-9 && drop<=max+1e-9,
          r.name+' · baisse de '+fmt(drop)+' % depuis le sommet',events);
      } catch { statuses.set(symbol, 'source indisponible'); }
    }));
    if(id!==generation || !enabled) return;
    const log=document.getElementById('alerts-log');
    if(events.length) {
      sound();
      log.textContent=new Date().toLocaleTimeString('fr-FR')+' · '+events.join(' | ');
    }
    document.getElementById('alerts-status').textContent=
      Object.entries(rules).map(([key, rule]) =>
        rule.name + ' : ' + (statuses.get(key) || 'en attente')
      ).join('  |  ');
    timer=setTimeout(()=>poll(id),30000);
  }

  async function toggle() {
    const button=document.getElementById('alerts-toggle');
    if(enabled) {
      enabled=false; generation++; clearTimeout(timer); active.clear();
      button.textContent='♬ Activer les alarmes';
      button.setAttribute('aria-pressed','false');
      document.getElementById('alerts-status').textContent='Alarmes en pause';
      return;
    }
    button.disabled=true;
    try {
      const Audio=window.AudioContext||window.webkitAudioContext;
      audio ||= new Audio();
      await audio.resume();
      if(audio.state!=='running') throw Error();
      enabled=true;
      button.textContent='♬ Alarmes activées';
      button.setAttribute('aria-pressed','true');
      document.getElementById('alerts-status').textContent='Vérification des trois actions…';
      sound();
      poll(++generation);
    } catch {
      document.getElementById('alerts-status').textContent='Son indisponible. Autorise le son dans le navigateur puis réessaie.';
    } finally {button.disabled=false}
  }
  document.getElementById('alerts-toggle').addEventListener('click',toggle);
  return {display};
})();

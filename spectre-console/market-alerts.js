window.MarketAlerts = (() => {
  const peaks = new Map();
  const fmt = n => n.toLocaleString('fr-FR',{maximumFractionDigits:2});
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

  return {display};
})();

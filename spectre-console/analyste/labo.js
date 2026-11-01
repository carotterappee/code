window.SpectreLab = (() => {
  const cache = new Map();
  const day = 86400000;
  const fmt = x => Number.isFinite(x) ? x.toLocaleString('fr-FR',{maximumFractionDigits:3}) : '—';
  const date = ts => new Date(ts).toLocaleDateString('fr-FR',{timeZone:'UTC'});
  const avg = a => a.length ? a.reduce((s,x)=>s+x,0)/a.length : NaN;
  function sd(a){
    const mean=avg(a);
    return a.length>1?Math.sqrt(a.reduce((sum,x)=>sum+(x-mean)**2,0)/(a.length-1)):NaN;
  }
  function node(tag,text){const n=document.createElement(tag);if(text!=null)n.textContent=text;return n}
  function select(items){
    const s=node('select');
    items.forEach(([v,t])=>s.add(new Option(t,v)));
    return s;
  }
  async function history(symbol){
    const last=cache.get(symbol);
    if(last && Date.now()-last.time<900000)return last.promise;
    const promise=(async()=>{
      const r=await fetch('/api/spectre-quotes?view=history&symbol='+encodeURIComponent(symbol),{signal:AbortSignal.timeout(18000)});
      if(!r.ok)throw Error();
      const d=await r.json();
      if(d.symbol!==symbol || !d.rows?.length)throw Error();
      return d;
    })();
    cache.set(symbol,{time:Date.now(),promise});
    try{return await promise}catch(e){if(cache.get(symbol)?.promise===promise)cache.delete(symbol);throw e}
  }
  let symbol, period='365', panel, toolbar, range, version=0;
  function mount(){
    const style=node('style');
    style.textContent=`
      #range-tools,.quant-box{background:#0b1921;color:#c7e3e1;padding:10px;font:13px/1.5 system-ui}
      #range-tools select,.quant-box select,.quant-box input,.quant-box textarea{background:#10262c;color:#defff6;border:1px solid #3b6867;padding:6px;border-radius:5px;max-width:100%}
      .quant-box{white-space:normal;border:1px solid #31514f;border-radius:9px;margin:8px 0}
      .quant-box h3{color:#86e3ce;margin:4px 0}.quant-box label{display:grid;gap:3px;margin:7px 0}
      .quant-box output{display:block;white-space:pre-line;margin:9px 0;color:#b6f1e2;font-variant-numeric:tabular-nums}
      .quant-box summary{cursor:pointer;color:#b2d9ff}.quant-box svg{width:100%;height:190px}
      `;
    document.head.append(style);
    toolbar=document.getElementById('range-tools');
    range=select([['live','Direct · minute'],['30','1 mois'],['180','6 mois'],['365','1 an'],['1826','5 ans'],['all','Tout l’historique']]);
    range.value=period;range.setAttribute('aria-label','Période du graphique');
    range.onchange=()=>{period=range.value;display()};
    panel=node('div');panel.className='quant-box';toolbar.append('Période  ',range,panel);
  }
  function market(next){symbol=next;if(toolbar)display()}
  async function display(){
    const id=++version, live=period==='live';
    const shell=document.getElementById('market-chart-shell');
    shell.style.display=live?'':'none';panel.hidden=live;
    const title=shell.parentElement.querySelector('.panelhead');
    // The existing market code sets the live caption whenever a market changes.
    if(title){title.style.display=live?'':'none'}
    if(live||!symbol)return;
    panel.textContent='Chargement des clôtures…';
    try{
      const data=await history(symbol);if(id!==version)return;
      const end=data.rows.at(-1).ts;
      const rows=data.rows.filter(r=>period==='all'||r.ts>=end-Number(period)*day);
      const ns='http://www.w3.org/2000/svg';
      const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 720 180');svg.setAttribute('preserveAspectRatio','none');
      const path=document.createElementNS(ns,'path');
      const prices=rows.map(r=>r.close),lo=Math.min(...prices),hi=Math.max(...prices);
      const first=rows[0].ts;
      path.setAttribute('d',rows.map((r,i)=>(i?'L':'M')+(4+712*(r.ts-first)/(end-first||1)).toFixed(2)+' '+(170-160*(r.close-lo)/(hi-lo||1)).toFixed(2)).join(' '));
      path.setAttribute('fill','none');path.setAttribute('stroke','#65e4bf');path.setAttribute('stroke-width','2');path.setAttribute('vector-effect','non-scaling-stroke');
      svg.append(path);
      const read=node('output');
      const cursor=node('input');cursor.type='range';cursor.min=0;cursor.max=rows.length-1;cursor.value=rows.length-1;cursor.style.width='100%';cursor.setAttribute('aria-label','Explorer les clôtures');
      function inspect(i){const r=rows[i];read.textContent=date(r.ts)+' · '+fmt(r.close)+' '+(data.currency||'');cursor.value=i}
      cursor.oninput=()=>inspect(+cursor.value);
      svg.onpointermove=e=>{const rect=svg.getBoundingClientRect();const t=first+(end-first)*(e.clientX-rect.left)/rect.width;let i=rows.findIndex(r=>r.ts>=t);inspect(i<0?rows.length-1:i)};
      inspect(rows.length-1);
      panel.replaceChildren(node('h3',symbol+' · clôtures quotidiennes'),node('small',date(first)+' — '+date(end)+' · Yahoo Finance · cours hors dividendes'),svg,cursor,read);
    }catch{if(id===version)panel.textContent='Historique indisponible pour cet instrument. Sélectionne une autre période pour réessayer.'}
  }
  function indicators(r){
    const last=r.at(-1), closes=r.map(x=>x.close),n=r.length;
    const ma=k=>n>=k?avg(closes.slice(-k)):NaN;
    let gain=0,loss=0,atr=0;
    for(let i=1;i<n;i++){
      const delta=r[i].close-r[i-1].close;
      const tr=Math.max(r[i].high-r[i].low,Math.abs(r[i].high-r[i-1].close),Math.abs(r[i].low-r[i-1].close));
      const values=[Math.max(delta,0),Math.max(-delta,0),tr];
      [gain,loss,atr]=values.map((x,j)=>i<=14?[gain,loss,atr][j]+x/14:([gain,loss,atr][j]*13+x)/14);
    }
    const w=r.slice(-60),hi=Math.max(...w.map(x=>x.high)),lo=Math.min(...w.map(x=>x.low));
    const pivot=(last.high+last.low+last.close)/3;
    return 'Moyennes mobiles 20 / 50 séances  '+fmt(ma(20))+' / '+fmt(ma(50))+
      '\nÉcart type des 20 clôtures  '+fmt(n>=20?sd(closes.slice(-20)):NaN)+
      '\nRSI de Wilder 14  '+fmt(n>14?(gain+loss?100*gain/(gain+loss):50):NaN)+
      '\nMomentum 10 séances  '+fmt(n>10?(last.close/r[n-11].close-1)*100:NaN)+' %'+
      '\nATR de Wilder 14  '+fmt(n>14?atr:NaN)+
      '\nProchaine séance · pivot / support 1 / résistance 1  '+[pivot,2*pivot-last.high,2*pivot-last.low].map(fmt).join(' / ')+
      '\nFibonacci depuis le sommet des '+w.length+' dernières séances (38,2 / 50 / 61,8 %)  '+[.382,.5,.618].map(x=>fmt(hi-x*(hi-lo))).join(' / ');
  }
  // Independent forward windows, same trend relative to the trailing 50-session mean.
  function forecast(rows,h){
    const closes=rows.map(r=>r.close);
    if(closes.length<50+h)return 'Historique insuffisant pour cet horizon.';
    const regime=i=>closes[i]>=avg(closes.slice(i-49,i+1));
    const today=regime(closes.length-1),samples=[];
    for(let i=closes.length-1-h;i>=49;i-=h){
      if(regime(i)===today)samples.push(closes[i+h]/closes[i]-1);
    }
    if(samples.length<12)return 'Seulement '+samples.length+' périodes comparables. Échantillon insuffisant pour estimer une direction.';
    samples.sort((a,b)=>a-b);
    const quant=p=>{const k=(samples.length-1)*p,i=Math.floor(k);return samples[i]+(k-i)*(samples[Math.ceil(k)]-samples[i])};
    const median=quant(.5);
    return (median>0?'↗ Hausse médiane':median<0?'↘ Baisse médiane':'→ Médiane stable')+' sur '+h+' séances · '+fmt(100*median)+' %'+
      '\nMoitié centrale des rendements historiques  '+fmt(100*quant(.25))+' % à '+fmt(100*quant(.75))+' %'+
      '\n'+samples.filter(x=>x>0).length+' périodes en hausse sur '+samples.length+' périodes distinctes avec le cours du même côté de sa moyenne mobile 50. Les fréquences décrivent cet échantillon.';
  }
  function calculators(parent,price,isStock,q,sessions){
    function form(title,fields,calc,open){
      const d=node('details');d.className='quant-box';d.open=open;
      d.append(node('summary',title));parent.append(d);
      const output=node('output'),inputs=[];
      for(const [label,hint,multi] of fields){
        const wrap=node('label',label),input=node(multi?'textarea':'input');
        input.placeholder=hint;wrap.append(input);d.append(wrap);inputs.push(input);
      }
      function update(){
        const vals=inputs.map((n,i)=>{
          const read=t=>{t=t.trim().replace(',','.');return t&&Number.isFinite(Number(t))?Number(t):NaN};
          return fields[i][2]?n.value.trim().split(/[;\n]+/).map(read):read(n.value);
        });
        output.textContent=calc(...vals);
      }
      d.oninput=update;d.append(output);update();
    }
    form('Journal · résultats de trading',[
      ['Capital initial','ex. 10000'],['Gains et pertes nets par trade, en ordre chronologique','100 ; -60 ; 0 ; 80',true]
    ],(capital,pnl)=>{
      if(!(capital>0)||!pnl.every(Number.isFinite))return 'Renseigne le capital et les transactions clôturées dans la même devise.';
      const wins=pnl.filter(x=>x>0), losses=pnl.filter(x=>x<0),sum=a=>a.reduce((x,y)=>x+y,0);
      let eq=capital,peak=capital,dd=0;
      for(const x of pnl){eq+=x;peak=Math.max(peak,eq);dd=Math.max(dd,(peak-eq)/peak)}
      return 'Taux de réussite  '+fmt(100*wins.length/pnl.length)+' % · '+pnl.length+' trades\nFacteur de profit  '+(losses.length?fmt(sum(wins)/-sum(losses)):'non défini · aucune perte')+
        '\nEspérance nette par trade  '+fmt(avg(pnl))+'\nGain moyen  '+fmt(avg(wins))+' · Perte moyenne  '+fmt(-avg(losses))+
        '\nDrawdown maximum entre clôtures de trades  '+fmt(dd*100)+' %';
    },/trade|drawdown|profit|esperance|reussite|gain moyen|perte moyenne/.test(q));
    form('Sharpe annualisé · portefeuille',[
      ['Rendements quotidiens en %, hors apports et retraits','1 ; -0,5 ; 0,3',true],['Taux annuel sans risque (%)','ex. 2']
    ],(returns,rate)=>{
      if(returns.length<2||!returns.every(Number.isFinite)||!(rate>-100))return 'Saisis au moins deux rendements quotidiens et le taux de référence.';
      const rf=Math.pow(1+rate/100,1/sessions)-1,excess=returns.map(x=>x/100-rf);
      return 'Sharpe annualisé ('+sessions+' séances)  '+fmt(avg(excess)/sd(excess)*Math.sqrt(sessions));
    },/sharpe/.test(q));
    form('Position · levier, marge et financement',[
      ['Quantité × multiplicateur du contrat (unités sous-jacentes)','ex. 100'],['Fonds propres du compte','ex. 10000'],
      ['Levier contractuel','ex. 5'],['Marge déjà utilisée hors de cette position','ex. 0'],
      ['Variation de prix valant un point','ex. 0,01'],['Taux annuel de financement facturé (%)','ex. 4'],['Jours financés','ex. 3']
    ],(units,equity,leverage,used,step,rate,days)=>{
      if(!(units>0&&equity>0&&leverage>=1&&used>=0&&step>0&&Number.isFinite(rate)&&days>=0&&price>0))return 'Utilise la devise de cotation pour le compte. Renseigne les conditions de ton contrat.';
      const exposure=price*units,margin=exposure/leverage,total=used+margin;
      return 'Exposition  '+fmt(exposure)+' · Levier de la position sur fonds propres  ×'+fmt(exposure/equity)+
        '\nMarge requise  '+fmt(margin)+' · Marge libre après ouverture  '+fmt(equity-total)+
        '\nNiveau de marge après ouverture  '+fmt(100*equity/total)+' % · Valeur du point  '+fmt(units*step)+
        '\nFinancement estimé sur le nominal (base 365 jours)  '+fmt(exposure*rate/100*days/365);
    },/levier|marge|point|financement/.test(q));
    if(isStock)form('Action · valorisation fondamentale',[
      ['Bénéfice annuel attribuable aux actions ordinaires','montant en devise de cotation'],['Nombre moyen pondéré d’actions sur l’exercice','nombre'],
      ['Actions actuellement en circulation','nombre'],['Dividende annuel par action','montant'],['Flux disponible pour les actionnaires attendu par action dans un an','montant'],
      ['Rendement exigé (%)','ex. 9'],['Croissance perpétuelle estimée (%)','ex. 2']
    ],(earn,weighted,count,div,flow,discount,growth)=>{
      const eps=weighted>0?earn/weighted:NaN;
      return 'Bénéfice par action  '+fmt(eps)+' · Cours / bénéfice  '+fmt(eps>0?price/eps:NaN)+
        '\nCapitalisation  '+fmt(count>0?count*price:NaN)+' · Rendement du dividende  '+fmt(div>=0?100*div/price:NaN)+' %'+
        '\nValeur intrinsèque par action (flux perpétuels, croissance constante)  '+fmt(flow>0&&discount>growth&&growth>-100?flow/((discount-growth)/100):NaN);
    },/benefice|intrinseque|dividende|capitalisation/.test(q));
  }
  function analyst(out,markets,instruments,index,q){
    const box=node('div');box.className='quant-box';out.replaceChildren(box);
    const options=markets.flatMap(([group,name,key])=>instruments[key]?[[instruments[key][0],group+' · '+name]]:[]);
    for(const c of ['BTC','ETH','SOL'])options.push([c+'-USD','Crypto · '+c]);
    const pick=select(options),h=select([['5','5 séances'],['20','20 séances'],['60','60 séances']]);
    pick.value=options.some(([v])=>v===symbol)?symbol:options[0][0];h.value='20';
    const result=node('div');box.append(node('h3','Observatoire des marchés'),node('p','Choisis une entreprise, un fonds ou un indice comme repère pour le secteur à étudier.'),pick,h,result);
    let revision=0;
    async function run(){
      const id=++revision,s=pick.value;result.textContent='Lecture de l’historique…';
      let rows=[],currency='';
      try{
        const data=await history(s);currency=data.currency||'';
        const midnight=new Date();midnight.setUTCHours(0,0,0,0);
        rows=data.rows.filter(r=>r.ts<midnight.getTime()&&r.close>0);
      }catch{}
      if(id!==revision||!box.isConnected)return;
      result.replaceChildren();
      if(rows.length){
        const last=rows.at(-1);
        result.append(node('h4','Scénario à '+h.value+' séances'),node('output',forecast(rows,+h.value)),
          node('small','Clôture du '+date(last.ts)+' · '+fmt(last.close)+' '+currency+' · prix hors dividendes'),
          node('h4','Indicateurs calculés'),node('output',indicators(rows)));
      }else result.append(node('p','Historique indisponible. Le journal et le calcul de Sharpe restent utilisables.'));
      calculators(result,rows.at(-1)?.close,/\.PA$/.test(s)||s==='AAPL',q,s.endsWith('-USD')?365:252);
    }
    pick.onchange=h.onchange=run;run();
  }
  return {mount,market,analyst};
})();

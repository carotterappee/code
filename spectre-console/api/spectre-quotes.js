
const allowed=new Set(['^FCHI','TTE.PA','SPY','AAPL','BZ=F','GC=F','XLE','LIT']);

module.exports=async function handler(req,res){
  if(req.method!=='GET')return res.status(405).end();
  const symbol=String(req.query.symbol||'');
  if(!allowed.has(symbol))return res.status(400).json({error:'Instrument inconnu'});
  const endpoint='https://query1.finance.yahoo.com/v8/finance/chart/'+
    encodeURIComponent(symbol)+'?interval=1m&range=5d&includePrePost=false';
  try{
    const response=await fetch(endpoint,{
      headers:{Accept:'application/json'},
      signal:AbortSignal.timeout(8000)
    });
    if(!response.ok)throw Error('Source HTTP '+response.status);
    const json=await response.json();
    const result=json.chart?.result?.[0];
    const meta=result?.meta,quote=result?.indicators?.quote?.[0];
    if(!meta||!quote||!Array.isArray(result.timestamp))throw Error('Données manquantes');
    const rows=[];
    for(let i=0;i<result.timestamp.length;i++){
      const o=quote.open?.[i],h=quote.high?.[i],l=quote.low?.[i],c=quote.close?.[i];
      if(![o,h,l,c].every(Number.isFinite))continue;
      rows.push({ts:result.timestamp[i]*1000,open:o,high:h,low:l,close:c,
        volume:Number.isFinite(quote.volume?.[i])?quote.volume[i]:null});
    }
    if(!rows.length)throw Error('Aucune bougie disponible');

    // Avec une plage de cinq jours, chartPreviousClose peut se rapporter
    // au début de la plage. On cherche donc la clôture de la séance précédente.
    const zone=meta.exchangeTimezoneName||'UTC';
    const day=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'});
    const latest=rows[rows.length-1],session=day.format(latest.ts);
    let first=rows.length-1;
    while(first>0&&day.format(rows[first-1].ts)===session)first--;
    const today=rows.slice(first);
    const prev=Number.isFinite(meta.previousClose)?meta.previousClose:
      (first>0?rows[first-1].close:null);
    const when=Number(meta.regularMarketTime)*1000;
    const useQuote=Number.isFinite(meta.regularMarketPrice)&&
      Number.isFinite(when)&&when>=latest.ts&&day.format(when)===session;
    const price=useQuote?meta.regularMarketPrice:latest.close;
    const reportedVolume=today.filter(r=>r.volume!==null);
    res.setHeader('Cache-Control','public, s-maxage=20');
    return res.status(200).json({
      symbol,currency:meta.currency||null,price,time:useQuote?when:latest.ts,
      previous:prev,open:today[0].open,
      high:Math.max(...today.map(r=>r.high),price),
      low:Math.min(...today.map(r=>r.low),price),
      volume:reportedVolume.length?reportedVolume.reduce((a,r)=>a+r.volume,0):null,
      rows:today.slice(-120)
    });
  }catch(err){
    res.setHeader('Cache-Control','no-store');
    return res.status(502).json({error:'Cotations temporairement indisponibles'});
  }
};

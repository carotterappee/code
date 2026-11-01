
module.exports=async function(req,res){
  if(req.method!=='GET')return res.status(405).end();
  try{
    const result=await fetch('https://www.ecb.europa.eu/rss/press.html',{
      headers:{Accept:'application/rss+xml, application/xml, text/xml'},
      signal:AbortSignal.timeout(9000)
    });
    if(!result.ok)throw Error('Flux indisponible');
    const xml=await result.text();
    if(!/<(?:rss|rdf:RDF)\b/i.test(xml))throw Error('Format inconnu');
    res.setHeader('Content-Type','application/rss+xml; charset=utf-8');
    res.setHeader('Cache-Control','public, s-maxage=900, stale-while-revalidate=1800');
    return res.status(200).send(xml);
  }catch{
    return res.status(502).json({error:'Flux BCE indisponible pour le moment.'});
  }
};


(() => {
  const sourceURL='https://raw.githubusercontent.com/fcroiseaux/presitracker2027-data/main/presitracker-data.json';
  const normal=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const name=c=>c.firstName+' '+c.lastName;
  let cached=null, checked=0;

  async function read(url,timeout){
    const r=await fetch(url,{signal:AbortSignal.timeout(timeout)});
    if(!r.ok)throw Error('HTTP '+r.status);
    const d=await r.json();
    if(d.schemaVersion!==1||!Array.isArray(d.candidates)||!d.sources||!d.updatedAt)
      throw Error('Format inattendu');
    return d;
  }
  async function load(){
    if(cached && Date.now()-checked<15*60*1000)return cached;
    try{
      const db=await read(sourceURL,7000);
      cached={db,mode:'Source consultée en ligne'};
    }catch{
      if(cached)cached={db:cached.db,mode:'Source indisponible · dernière lecture conservée'};
      else cached={db:await read('./analyste/presidentielle-2027.json',5000),
                   mode:'Source indisponible · copie installée'};
    }
    checked=Date.now();return cached;
  }

  // Ces règles décrivent des mécanismes conditionnels.
  // Le nom et le parti du candidat n’entrent pas dans le calcul.
  const channels=[
    {
      id:'energie',words:/energie|energetique|electricite|nucleaire|renouvelable|petrole|gaz naturel|carburant/,
      title:'Énergie et industrie',
      fr:'Une modification des tarifs, taxes ou subventions peut déplacer les marges entre producteurs, fournisseurs et industries consommatrices. Un prix plafonné avec compensation publique a un effet différent d’un plafond financé par le producteur.',
      world:'En Europe, examiner les échanges d’électricité, les importations de gaz et les fournisseurs d’équipements. Pour le pétrole mondial, comparer le changement de demande française à la taille du marché international.',
      watch:'Tarif proposé, financement de la compensation, volumes concernés, contrats déjà signés et prix de gros.'
    },
    {
      id:'defense',words:/defense|armement|militaire|munitions|combat aerien/,
      title:'Défense et aéronautique',
      fr:'Une hausse de crédits pourrait soutenir les carnets de commandes si des contrats sont attribués. Une baisse, un report ou une réorientation des achats exposerait d’autres lignes de produits. Vérifier précisément le sens de la mesure.',
      world:'Des commandes ouvertes aux fournisseurs européens ou américains peuvent leur profiter. Une préférence nationale pourrait répartir les commandes différemment.',
      watch:'Crédits votés, appels d’offres, origine des fournisseurs, calendrier de livraison et marges des contrats.'
    },
    {
      id:'logement',words:/immobilier|logement|loyer|foncier|construction|renovation thermique/,
      title:'Immobilier, construction et banques',
      fr:'Une aide à la construction peut agir sur les réservations des promoteurs. Un changement des loyers touche plutôt les revenus locatifs. Les taux de crédit et le coût des travaux peuvent renforcer ou annuler l’effet.',
      world:'Les fournisseurs de matériaux et les propriétaires étrangers d’actifs français peuvent être exposés. L’effet dépend de leur chiffre d’affaires ou de leur patrimoine en France.',
      watch:'Permis, mises en chantier, réservations, loyers réellement encaissés et taux des prêts immobiliers.'
    },
    {
      id:'budget',words:/deficit|dette publique|budget|depense publique|finances publiques|emprunt public/,
      title:'Dette française et financement',
      fr:'Une dépense supplémentaire non financée peut accroître les besoins d’émission. Une économie annoncée ne réduit ces besoins que si elle se réalise. Sur les obligations existantes à taux fixe, une hausse du rendement exigé fait généralement baisser le prix.',
      world:'Comparer la France à l’Allemagne sur la même échéance. Si les deux rendements montent ensemble, une évolution commune des taux européens peut expliquer une partie du mouvement.',
      watch:'Coût net annuel, recettes compensatrices, calendrier des émissions et écart France–Allemagne à dix ans.'
    },
    {
      id:'commerce',words:/douane|importation|exportation|libre echange|protectionnisme|commerce international/,
      title:'Commerce extérieur',
      fr:'Un droit de douane peut protéger certains producteurs tout en renchérissant les intrants de leurs clients. Il faut identifier le produit, le partenaire et l’autorité compétente pour appliquer la mesure.',
      world:'Examiner les exportateurs du pays visé, les fournisseurs de substitution et les éventuelles mesures de rétorsion. Pour la politique commerciale commune, examiner aussi la décision européenne requise.',
      watch:'Texte européen ou national applicable, flux commerciaux concernés, exemptions et possibilités de substitution.'
    },
    {
      id:'fiscalite',words:/impot|fiscalite|taxation|cotisations|taxe|dividende/,
      title:'Fiscalité, marges et consommation',
      fr:'Identifier qui paie en premier : entreprise, ménage ou investisseur. Une taxe sur le bénéfice, une baisse de cotisations et une hausse de TVA n’agissent pas sur la même ligne de comptes.',
      world:'Une multinationale étrangère peut être touchée par ses activités françaises. Sa nationalité boursière seule ne mesure pas cette exposition.',
      watch:'Assiette, taux, seuils, exemptions et capacité de répercuter le coût dans les prix.'
    }
  ];

  function safeLink(parent,label,url){
    if(!/^https?:\/\//i.test(url||''))return;
    const a=document.createElement('a');a.href=url;a.target='_blank';
    a.rel='noopener noreferrer';a.textContent=label;parent.append(a);
  }
  function para(parent,label,text){
    const p=document.createElement('p'),b=document.createElement('b');
    b.textContent=label+' ';p.append(b,document.createTextNode(text));parent.append(p);
  }
  function selector(label){
    const box=document.createElement('label');box.textContent=label+' ';
    const s=document.createElement('select');s.style.cssText='display:block;width:100%;margin:4px 0 10px';
    box.append(s);return [box,s];
  }
  async function show(out,question,stillCurrent){
    out.textContent='Lecture des candidatures et des mesures sourcées…';
    let result;
    try{result=await load()}catch{
      if(stillCurrent())out.textContent='Les données électorales sont indisponibles. Vérifie le dossier analyste.';
      return;
    }
    if(!stillCurrent())return;
    const {db,mode}=result,q=normal(question);
    const candidates=db.candidates.filter(c=>['declare','officiel'].includes(c.status))
      .sort((a,b)=>a.lastName.localeCompare(b.lastName,'fr'));
    const themes=new Map(db.themes.map(t=>[t.key,t.name]));
    const requested=channels.filter(ch=>ch.words.test(q));
    out.replaceChildren();
    para(out,'Présidentielle française 2027',
      mode+' · base PresiTracker2027 du '+db.updatedAt.slice(0,10)+'.');
    const [cBox,cSelect]=selector('Candidature');
    cSelect.add(new Option('Choisir une personne…',''));
    for(const c of candidates)cSelect.add(new Option(name(c)+' · '+c.partyShort,c.id));
    const [mBox,mSelect]=selector('Mesure à examiner');
    mBox.hidden=true;
    const summary=document.createElement('div'),detail=document.createElement('div');
    out.append(cBox,summary,mBox,detail);
    const footer=document.createElement('p');
    safeLink(footer,'Données : PresiTracker2027 · Licence Ouverte 2.0',
      'https://github.com/fcroiseaux/presitracker2027-data');
    out.append(footer);

    function renderCandidate(){
      summary.replaceChildren();detail.replaceChildren();mSelect.replaceChildren();mBox.hidden=true;
      const c=candidates.find(row=>row.id===cSelect.value);
      if(!c)return;
      para(summary,name(c),c.party+' · statut dans la base : '+
        (c.status==='officiel'?'officiel':'candidature déclarée')+' depuis le '+c.statusDate+'.');
      safeLink(summary,'Programme publié par la campagne ↗',c.programmeUrl);
      for(const id of (c.statusSourceIds||[]).slice(0,2)){
        const s=db.sources[id];if(s){summary.append(' ');safeLink(summary,'Source de candidature · '+s.publisher,s.url)}
      }
      const measures=(c.measures||[]).filter(m=>m.status==='active'&&
        ['programme','declaration'].includes(m.kind));
      const text=m=>normal(m.title+' '+m.detail);
      const thematic=m=>requested.some(r=>r.words.test(text(m)));
      if(requested.length)measures.sort((a,b)=>Number(thematic(b))-Number(thematic(a)));
      if(!measures.length){
        para(detail,'Programme','Aucune proposition active documentée dans cette base pour cette personne.');
        return;
      }
      mBox.hidden=false;
      mSelect.add(new Option('Choisir une proposition parmi '+measures.length+'…',''));
      measures.forEach((m,i)=>mSelect.add(new Option(
        (m.kind==='programme'?'Programme':'Déclaration')+' · '+m.title,i)));
      function renderMeasure(){
        detail.replaceChildren();
        if(mSelect.value==='')return;
        const m=measures[Number(mSelect.value)];
        para(detail,'Mesure documentée ·',m.title);
        para(detail,'Contenu ·',m.detail);
        para(detail,'Nature ·',(m.kind==='programme'?'Programme écrit':'Déclaration publique')+
          ' · rubrique '+(themes.get(m.themeKey)||m.themeKey)+' · mise à jour '+m.lastChanged+'.');
        for(const id of m.sourceIds||[]){
          const s=db.sources[id];if(!s)continue;
          const p=document.createElement('p');
          safeLink(p,s.publisher+' · '+s.title+(s.date?' · '+s.date:'')+' ↗',s.url);
          detail.append(p);
        }
        const matched=channels.filter(ch=>ch.words.test(text(m)));
        para(detail,'Scénario de marché ·',
          'Hypothèse : victoire électorale, puis adoption et application de cette mesure. Une annonce, un vote budgétaire et un contrat exécuté sont trois étapes différentes.');
        if(!matched.length){
          para(detail,'Résultat ·','La base locale ne relie pas cette mesure à un mécanisme financier suffisamment précis. Direction et ampleur du mouvement indéterminées.');
        }
        for(const ch of matched){
          para(detail,ch.title+' · France :',ch.fr);
          para(detail,'Transmission internationale :',ch.world);
          para(detail,'À vérifier :',ch.watch);
        }
        para(detail,'Ce qui peut inverser la réaction ·',
          'Le marché réagit à la surprise par rapport aux attentes. Une mesure anticipée, amendée, reportée ou compensée peut produire une réaction faible ou de sens différent. Aucun pourcentage de chute n’est déduit du seul programme.');
      }
      mSelect.onchange=renderMeasure;
      if(requested.length&&thematic(measures[0])){mSelect.value='0';renderMeasure()}
    }
    cSelect.onchange=renderCandidate;
    const found=candidates.filter(c=>(' '+q+' ').includes(' '+normal(c.lastName)+' '));
    if(found.length===1){cSelect.value=found[0].id;renderCandidate()}
  }
  globalThis.SpectreElection={show};
})();

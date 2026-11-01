
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

  // Règles communes à toutes les candidatures.
  const branches = [
    ['Énergie', /petrol|gaz naturel|carburant|hydrocarb|raffiner|energies? fossiles/,
      'Examiner les taxes, les coûts de production et la part de l’activité réalisée en France. Le cours mondial du pétrole peut dominer une mesure nationale.'],
    ['Électricité et services collectifs', /electric|nucleaire|renouvelable|tarif.*energie|reseau energetique|gestion de l eau/,
      'Identifier qui supporte le coût : fournisseur, producteur, client ou budget public. Un tarif plafonné avec compensation et un plafond sans compensation ont des effets différents.'],
    ['Industrie, défense et infrastructures', /industrie|industriel|defense|militaire|armement|aeronautique|ferroviaire|infrastructure|commande publique/,
      'Un crédit budgétaire peut ouvrir des débouchés. Pour estimer le bénéfice, il faut ensuite connaître les contrats signés, les fournisseurs retenus et leurs marges.'],
    ['Banques et assurances', /banqu|assurance|credit immobilier|credit bancaire|solvabilite|transactions financieres/,
      'Examiner séparément la marge sur les crédits, le coût des dépôts, les défauts de paiement et la valeur du portefeuille obligataire. Ces effets peuvent se compenser.'],
    ['Immobilier coté', /logement|loyer|foncier|immobili|renovation thermique/,
      'Les promoteurs dépendent des réservations et des chantiers. Les foncières dépendent surtout des loyers, du taux d’occupation et du refinancement.'],
    ['Consommation, luxe et tourisme', /pouvoir d achat|touris|hotel|automobil|vehicule|luxe|consommation des menages/,
      'Distinguer la demande des ménages français de celle des clients étrangers. Un groupe coté à Paris peut réaliser une grande partie de ses ventes hors de France.'],
    ['Alimentation et consommation courante', /aliment|agric|grande distribution|premiere necessite/,
      'Suivre la répartition des coûts entre agriculteurs, industriels, distributeurs et consommateurs. Une hausse des prix de vente ne garantit pas une hausse des bénéfices.'],
    ['Santé et pharmacie', /sante|pharma|medicament|hospital|hopit|assurance maladie/,
      'Regarder les tarifs de remboursement, les volumes et les marchés hospitaliers. Les ventes internationales peuvent limiter l’exposition à une décision française.'],
    ['Technologies', /numerique|logiciel|semi conducteur|intelligence artificielle|cyber|centre de donnees/,
      'Faire la différence entre commandes nouvelles, subventions et coûts réglementaires. Le lieu de cotation ne détermine pas la nationalité du fournisseur retenu.'],
    ['Télécommunications', /telecom|telephonie|fibre optique|haut debit|frequences mobiles/,
      'Les obligations de couverture peuvent favoriser les équipementiers et augmenter les investissements demandés aux opérateurs. Vérifier les conditions de financement.'],
    ['Matières premières et matériaux', /materiaux|minier|minerai|acier|siderurg|chimie|ciment|metaux/,
      'Comparer prix de l’énergie, coût des intrants et débouchés industriels. Une taxe sur les importations peut protéger un producteur et pénaliser son client.']
  ];
  const transverse = /deficit public|dette publique|budget de l etat|impot sur les societes|cotisations patronales|droits? de douane/;
  const fmt = n => n.toLocaleString('fr-FR',{maximumFractionDigits:2});

  function el(tag,text,cls){
    const e=document.createElement(tag);
    if(text!==undefined)e.textContent=text;
    if(cls)e.className=cls;
    return e;
  }
  function fold(parent,title){
    const d=el('details');
    d.append(el('summary',title)); parent.append(d); return d;
  }
  function addMeasure(parent,m,db){
    const title=(m.kind==='programme'?'Programme écrit':'Déclaration')+' · '+m.title;
    const d=fold(parent,title);
    d.append(el('p',m.detail),el('small','Dernière modification recensée : '+m.lastChanged));
    for(const id of m.sourceIds||[]){
      const s=db.sources[id];
      if(!s)continue;
      const p=el('p');
      safeLink(p,s.publisher+' · '+s.title+(s.date?' · '+s.date:''),s.url);
      d.append(p);
    }
  }

  function renderProgrammeEntier(parent,c,db){
    parent.replaceChildren();
    const measures=(c.measures||[]).filter(m=>
      m.status==='active' && ['programme','declaration'].includes(m.kind));
    const texts=measures.map(m=>normal(m.title+' '+m.detail));
    const classified=new Set();
    const report=branches.map(([name,pattern,mechanism])=>{
      const matched=[];
      texts.forEach((text,i)=>{
        if(pattern.test(text)){matched.push(measures[i]);classified.add(i)}
      });
      return {name,mechanism,matched};
    });
    const common=[];
    texts.forEach((text,i)=>{
      if(transverse.test(text)){common.push(measures[i]);classified.add(i)}
    });
    const written=measures.filter(m=>m.kind==='programme').length;
    const exposed=report.filter(row=>row.matched.length);
    const sorted=report.slice().sort((x,y)=>y.matched.length-x.matched.length);

    parent.append(el('small','RAPPORT / FRANCE 2027','polit-kicker'),el('h3',name(c)));
    para(parent,'Candidature :',c.party+' · '+(c.status==='officiel'?'officielle':'déclarée')+
      ' · statut recensé le '+c.statusDate+'.');
    if(c.programmeUrl)safeLink(parent,'Consulter le programme de campagne ↗',c.programmeUrl);
    for(const id of (c.statusSourceIds||[]).slice(0,1)){
      const source=db.sources[id];
      if(source){parent.append('  ');safeLink(parent,'Source de la candidature ↗',source.url)}
    }

    parent.append(el('h4','01 / Synthèse automatique'));
    para(parent,'Programme examiné :',`${written} mesure(s) de programme et ${measures.length-written} déclaration(s) active(s) dans la base.`);
    para(parent,'Couverture :',`${exposed.length} secteurs sur ${branches.length} présentent au moins un lien détecté. ${classified.size} proposition(s) distincte(s) ont été rapprochées d’un secteur ou d’un mécanisme transversal.`);
    if(exposed.length){
      para(parent,'À examiner en premier :',sorted.filter(s=>s.matched.length).slice(0,3)
        .map(s=>s.name+' ('+s.matched.length+' mesures associées)').join(' · ')+'.');
      const first=sorted[0];
      para(parent,'Exemple concret :','« '+first.matched[0].title+' » — '+first.mechanism);
    }
    para(parent,'Lecture du résultat :','Le classement mesure la présence des thèmes dans le corpus. Le coût d’une mesure, son adoption et son effet sur les bénéfices demandent une analyse distincte. Une même proposition peut toucher plusieurs secteurs.');

    if(common.length){
      const d=fold(parent,'Mesures transversales · fiscalité, budget et commerce ('+common.length+')');
      d.append(el('p','Ces mesures peuvent toucher de nombreux titres à la fois. Vérifier l’assiette, les exemptions, le financement et les décisions européennes nécessaires.'));
      common.forEach(m=>addMeasure(d,m,db));
    }

    parent.append(el('h4','02 / Scénarios par secteur'));
    for(const row of sorted){
      const d=fold(parent,row.name+' · '+row.matched.length+' mesure(s)');
      if(!row.matched.length){
        d.append(el('p','Aucun lien direct repéré par le moteur local. Une exposition indirecte reste possible via le crédit, la demande ou les impôts.'));
        continue;
      }
      d.append(el('p',row.mechanism));
      row.matched.forEach(m=>addMeasure(d,m,db));
    }
    const other=measures.filter((m,i)=>!classified.has(i));
    if(other.length){
      const d=fold(parent,'Autres propositions examinées ('+other.length+')');
      d.append(el('p','Le moteur ne dispose pas de règle suffisamment précise pour en déduire un effet financier.'));
      other.forEach(m=>addMeasure(d,m,db));
    }

    parent.append(el('h4','03 / Test de sensibilité'));
    para(parent,'Hypothèse :','Choisis un secteur, son poids supposé dans un portefeuille et sa variation. Le reste du portefeuille est supposé stable.');
    const controls=el('div',undefined,'polit-sim');
    const sector=el('select');
    for(const row of sorted)sector.add(new Option(row.name,row.name));
    function field(label,control){
      const l=el('label',label);l.append(control);controls.append(l);
    }
    field('Secteur',sector);
    function numberField(label,min,max,initial){
      const input=el('input');input.type='number';input.step='any';
      input.min=min;if(max!==null)input.max=max;
      input.value=initial;field(label,input);return input;
    }
    const weight=numberField('Poids supposé (%)',0,100,'8');
    const shock=numberField('Variation supposée (%)',-100,null,'-5');
    const result=el('div',undefined,'polit-result');result.setAttribute('aria-live','polite');
    function calculate(){
      const w=weight.valueAsNumber,s=shock.valueAsNumber;
      if(!Number.isFinite(w)||!Number.isFinite(s)||!weight.validity.valid||!shock.validity.valid){
        result.textContent='Poids attendu : de 0 à 100 %. Variation minimale : −100 %.';return;
      }
      const contribution=w*s/100;
      result.textContent=sector.value+' · '+fmt(w)+' % × '+fmt(s)+' % = '+
        (contribution>0?'+':'')+fmt(contribution)+' point(s) de variation du portefeuille.';
    }
    controls.oninput=calculate;sector.onchange=calculate;
    parent.append(controls,result);calculate();
    para(parent,'Portée :','Les valeurs préremplies illustrent le calcul. Ce sont des hypothèses modifiables. La pondération complète actuelle du CAC All-Share et la réaction future des cours ne sont pas connues de ce module.');
    safeLink(parent,'Consulter le périmètre du CAC All-Share chez Euronext ↗',
      'https://live.euronext.com/en/product/indices/qs0010989141-xpar');
  }

  async function show(out,question,stillCurrent){
    out.textContent='Chargement des programmes…';
    let result;
    try{result=await load()}catch{
      if(stillCurrent())out.textContent='La base électorale est indisponible.';
      return;
    }
    if(!stillCurrent())return;
    const {db,mode}=result;
    const candidates=db.candidates.filter(c=>['declare','officiel'].includes(c.status))
      .sort((a,b)=>a.lastName.localeCompare(b.lastName,'fr'));
    out.replaceChildren();
    const root=el('div',undefined,'polit-root');out.append(root);
    root.append(el('small','SPECTRE / PRÉSIDENTIELLE 2027','polit-kicker'),
      el('h3','Choisir une candidature'));
    const search=el('input');search.type='search';search.placeholder='Rechercher un nom ou un parti…';
    search.setAttribute('aria-label','Rechercher une candidature');search.className='polit-search';
    const cards=el('div',undefined,'polit-cards'),report=el('div');
    root.append(search,cards,report);
    const credit=el('p',mode+' · données du '+db.updatedAt.slice(0,10)+' · ');
    safeLink(credit,'PresiTracker2027 / Licence Ouverte 2.0','https://github.com/fcroiseaux/presitracker2027-data');
    root.append(credit);
    function choose(c){
      search.value=name(c);populate(c.id);
      renderProgrammeEntier(report,c,db);
    }
    function populate(selected){
      cards.replaceChildren();
      const q=normal(search.value);
      for(const c of candidates.filter(c=>normal(name(c)+' '+c.party+' '+c.partyShort).includes(q))){
        const button=el('button');button.type='button';button.className='polit-card';
        button.setAttribute('aria-pressed',String(c.id===selected));
        button.append(el('i',(c.firstName[0]||'')+(c.lastName[0]||'')),
          el('strong',name(c)),el('small',c.partyShort));
        button.onclick=()=>choose(c);cards.append(button);
      }
      if(!cards.childElementCount)cards.append(el('small','Aucune candidature correspondante.'));
    }
    search.oninput=()=>{report.replaceChildren();populate(null)};
    search.onkeydown=e=>{
      if(e.key==='Enter'&&cards.querySelectorAll('button').length===1)cards.querySelector('button').click();
    };
    const q=' '+normal(question)+' ';
    const found=candidates.filter(c=>q.includes(' '+normal(c.lastName)+' '));
    if(found.length===1)choose(found[0]);else populate(null);
  }
  globalThis.SpectreElection={show};
})();

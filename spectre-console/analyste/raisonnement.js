
(() => {
  const fmt=(n,d=2)=>Number.isFinite(n)
    ? n.toLocaleString('fr-FR',{maximumFractionDigits:d}) : 'indisponible';

  // Versements en fin de mois ; taux annuel effectif constant.
  function capital(initial,annual,years,monthly=0,inflation=0){
    const months=12*years;
    const r=Math.expm1(Math.log1p(annual/100)/12);
    const growth=Math.exp(months*Math.log1p(r));
    const deposits=r===0?months:Math.expm1(months*Math.log1p(r))/r;
    const nominal=initial*growth+monthly*deposits;
    return {nominal,paid:initial+monthly*months,
      real:nominal/Math.pow(1+inflation/100,years)};
  }

  // Valeurs en % du PIB. Un excédent primaire est positif.
  function debtPath(start,interest,growth,primary,years){
    const path=[start];
    for(let y=0;y<years;y++)
      path.push(path.at(-1)*(1+interest/100)/(1+growth/100)-primary);
    return path;
  }

  function describeCurve(rows){
    const valid=rows.filter(r=>Number.isFinite(r.close)&&r.close>0)
      .slice().sort((a,b)=>a.ts-b.ts);
    if(valid.length<2)return null;
    let peak=valid[0],worst=0,from=peak,to=peak;
    for(const r of valid){
      if(r.close>peak.close)peak=r;
      const fall=(peak.close-r.close)/peak.close;
      if(fall>worst){worst=fall;from=peak;to=r}
    }
    return {first:valid[0],last:valid.at(-1),count:valid.length,
      change:(valid.at(-1).close/valid[0].close-1)*100,
      drawdown:100*worst,from,to};
  }

  const rules={
    action:"Une action représente une part d’entreprise. Son rendement dépend du prix de revente et, le cas échéant, des dividendes. Pour une décision de plusieurs années, il faut aussi étudier les bénéfices, les flux de trésorerie, l’endettement et le prix payé.",
    fonds:"Une part de fonds donne accès à un panier. Il faut examiner sa composition, sa concentration, ses frais et les expositions que tu détiens déjà. Deux fonds portant des noms différents peuvent contenir les mêmes grandes entreprises.",
    indice:"Un indice mesure l’évolution d’un panier selon des règles. Pour y exposer de l’argent, il faut choisir un instrument qui le suit, puis regarder ses frais, sa composition et sa fidélité à l’indice.",
    terme:"Un contrat à terme a une échéance. Il faut regarder le contrat suivi, la taille d’une position, la marge demandée et le coût de passage à l’échéance suivante. La variation du baril ou de l’once ne donne pas à elle seule le rendement d’un produit détenu plusieurs mois.",
    crypto:"Le cours provient de transactions sur une plateforme précise. Pour juger une entrée, distingue l’amplitude des mouvements, la liquidité, les frais et la taille de position que tu peux supporter.",
    dette:"Pour étudier une obligation française, sépare le coupon, le rendement obtenu au prix d’achat, la maturité et le risque de devoir revendre avant le remboursement. Si les rendements exigés montent, le prix d’une obligation existante à taux fixe baisse, toutes choses égales par ailleurs."
  };

  // Accepte 1 000,50, 1000.50, les signes et les espaces insécables.
  const number='([+-]?(?:\\d{1,3}(?:[ \\u00a0\\u202f]\\d{3})+|\\d+)(?:[.,]\\d+)?)';
  const parse=s=>Number(s.replace(/\s/g,'').replace(',','.'));
  function value(q,pattern){
    const m=q.match(new RegExp(pattern,'i'));
    return m?parse(m[1]):null;
  }
  const euro='\\s*(?:€|euros?\\b)';
  const yearsOf=q=>value(q,number+'\\s*(?:ans?\\b|annees?\\b)');
  function taggedRate(q,label){
    return value(q,'(?:'+label+')\\s*(?:annuel(?:le)?|moyen(?:ne)?)?\\s*(?:de|a|=|:)?\\s*'+number+'\\s*%');
  }
  function investmentProjection(q){
    const monthlyPattern=number+euro+'\\s*(?:/\\s*mois|par mois|chaque mois|mensuels?)';
    const monthly=value(q,monthlyPattern)??0;
    const rest=q.replace(new RegExp(monthlyPattern,'i'),' ');
    const principal=value(rest,number+euro);
    const years=yearsOf(q);
    const inflation=taggedRate(q,'inflation');
    const withoutInflation=q.replace(new RegExp('inflation\\s*(?:annuelle)?\\s*(?:de|a|=|:)?\\s*'+number+'\\s*%','i'),' ');
    const rate=taggedRate(q,'rendement|taux')??value(withoutInflation,number+'\\s*%');
    if(principal===null||rate===null||!Number.isInteger(years)||years<1||years>100||
       principal<0||monthly<0||rate<=-100||(inflation??0)<=-100)
      return 'Pour calculer, donne-moi le capital de départ, le rendement annuel supposé et la durée en années entières. Exemple : « Projette 1 000 € à 4 % sur 5 ans, avec 50 € par mois et inflation 2 %. »';
    const result=capital(principal,rate,years,monthly,inflation??0);
    if(!Number.isFinite(result.real)||!Number.isFinite(result.nominal))return 'Les hypothèses dépassent la plage de calcul.';
    return `Projection conditionnelle sur ${years} an(s)\n\nCapital initial : ${fmt(principal)} €\nVersement en fin de mois : ${fmt(monthly)} €\nRendement annuel supposé : ${fmt(rate)} %\n\nTotal versé : ${fmt(result.paid)} €\nCapital final estimé : ${fmt(result.nominal)} €\nGain ou perte sur les sommes versées : ${fmt(result.nominal-result.paid)} €`+
      (inflation===null?'':`\nPouvoir d’achat en euros de départ, avec ${fmt(inflation)} % d’inflation annuelle : ${fmt(result.real)} €.`)+
      '\n\nHypothèses : rendement constant, gains réinvestis, hors frais et fiscalité. Le rendement saisi est un scénario.';
  }

  function sovereignProjection(q,c){
    const years=yearsOf(q),i=taggedRate(q,'cout moyen|cout'),g=taggedRate(q,'croissance nominale|croissance');
    let primary=taggedRate(q,'solde primaire|excedent primaire');
    const deficit=taggedRate(q,'deficit primaire');
    if(primary===null&&deficit!==null)primary=-deficit;
    if(!Number.isFinite(c.debtRatio))return 'Le ratio dette/PIB de départ manque. Ouvre « France · Dette publique & taux à 10 ans » et attends sa publication à l’écran.';
    if(!Number.isInteger(years)||years<1||years>50||i===null||g===null||g<=-100||i<=-100||primary===null)
      return 'Pour projeter la dette, indique la durée, le coût moyen de l’encours, la croissance nominale du PIB et le solde primaire en % du PIB. Exemple : « Projette la dette sur 5 ans, coût moyen 3 %, croissance nominale 2 %, déficit primaire 1 %. »';
    const path=debtPath(c.debtRatio,i,g,primary,years);
    const step=years>10?5:1;
    const lines=path.map((n,y)=>y>0&&(y%step===0||y===years)?`Année ${y} : ${fmt(n)} % du PIB`:null).filter(Boolean);
    return `Dette publique française · scénario\nDépart : ${c.debtLabel}\nCoût moyen : ${fmt(i)} % · Croissance nominale : ${fmt(g)} % · Solde primaire : ${fmt(primary)} % du PIB.\n\n${lines.join('\n')}\n\nCalcul annuel : ratio précédent × (1 + taux d’intérêt) ÷ (1 + croissance nominale) − excédent primaire. Les taux dans la formule sont exprimés en décimales. Hypothèses constantes, sans ajustements stock-flux. Le coût moyen demandé porte sur tout l’encours ; le taux de marché à dix ans concerne les conditions de financement actuelles.`;
  }

  function curveText(c){
    const a=describeCurve(c.rows);
    if(!a)return 'Il faut au moins deux clôtures valides pour lire la courbe. '+c.status;
    return `${c.name} · ${a.count} bougies disponibles\nDu ${c.stamp(a.first.ts)} au ${c.stamp(a.last.ts)} (Paris).\nPremière clôture : ${fmt(a.first.close)} ${c.unit} ; dernière : ${fmt(a.last.close)} ${c.unit}.\nVariation : ${fmt(a.change)} %.\nPlus grand recul entre un sommet de clôture et une clôture ultérieure : ${fmt(a.drawdown)} %.`+
      (a.drawdown>0?` Du ${c.stamp(a.from.ts)} au ${c.stamp(a.to.ts)}.`:'')+
      `\nSource / état : ${c.status}.\n\nCette mesure porte sur la fenêtre disponible et sur les clôtures des bougies. Une baisse plus forte a pu se produire à l’intérieur d’une minute.`;
  }

  function answer(q,c){
    if(/actu|annonce|presse|madoff|1929|1987|subprime|lehman|fonds de pension/.test(q))return null;
    const proj=/proje|scenario|simul|interets? composes?|combien.*(?:ans|annees)|dans \d+ ans/.test(q)||
      (/[€%]/.test(q)&&yearsOf(q)!==null);
    if(proj&&/dette|primaire|croissance nominale/.test(q))return sovereignProjection(q,c);
    if(proj&&(/capital|plac|invest|euro|€|rendement|compose/.test(q)))return investmentProjection(q);
    if(/histori|precedent|compare/.test(q)&&/dette|spread|allemagne|ecart de taux/.test(q)){
      const a=c.spreads;
      if(!a.length)return 'Ouvre la vue Dette publique et attends les séries France–Allemagne pour comparer des mois datés.';
      const low=a.reduce((x,y)=>x[1]<=y[1]?x:y),high=a.reduce((x,y)=>x[1]>=y[1]?x:y);
      const last=a.at(-1);
      return `France–Allemagne · rendements publics à environ dix ans\n${a.length} mois communs, de ${a[0][0]} à ${last[0]}.\nDernier écart : ${fmt(last[1])} points de base en ${last[0]}.\nMinimum observé : ${fmt(low[1])} pb en ${low[0]}.\nMaximum observé : ${fmt(high[1])} pb en ${high[0]}.\n\nUn écart plus grand indique que la France offrait davantage de rendement relatif. Ces séries mensuelles ne suffisent pas pour attribuer le mouvement à une décision politique ou à un événement précis. Source : séries Eurostat chargées dans le baromètre.`;
    }
    if(/pourquoi.*invest|a quoi sert.*(?:bourse|invest|marche)|comment.*(?:fonctionne|marche).*(?:bourse|marche|invest)/.test(q))
      return `Une entreprise peut financer un projet en émettant des actions ou des obligations. Un État peut emprunter en émettant des obligations. À l’émission, le capital va à l’émetteur. Ensuite, en Bourse, l’argent d’un achat ordinaire va au vendeur du titre.\n\nPourquoi un investisseur accepte-t-il ? Il renonce à disposer immédiatement de son argent en espérant recevoir des revenus, une hausse de valeur ou les deux. Le résultat dépend du prix payé et du risque pris.\n\nSur ton écran : ${rules[c.kind]}`;
    if(/quand.*(?:invest|achet|plac)|moment.*(?:invest|achet|entrer)|(?:faut.il|dois.je|devrais.je).*achet|comment investir|criteres|logique.*invest/.test(q)){
      return `Raisonnement pour ${c.name}\n\n1. Objectif : à quelle date auras-tu besoin de cet argent ? Une dépense proche rend une forte baisse temporaire difficile à supporter.\n\n2. Instrument : ${rules[c.kind]}\n\n3. Observation : ${c.kind==='dette'?c.debtNote:curveText(c)}\n\n4. Décision : quelle perte pourrais-tu absorber, quelle part du portefeuille serait exposée et quels frais paierais-tu ? Sans ces éléments et sans données de valorisation adaptées, je ne peux pas déterminer un bon point d’entrée personnel.`;
    }
    if(/courbe|tendance|drawdown|recul maximal|plus (?:grand|gros) recul/.test(q))
      return c.kind==='dette'?c.debtNote:curveText(c);
    return null;
  }
  globalThis.SpectreEco={answer,capital,debtPath,describeCurve};
})();

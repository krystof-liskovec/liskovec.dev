---
locale: cs
title: Úplně obyčejné nasazení
description: Ukázkový příspěvek o nasazení změny, ze kterého nebylo potřeba dělat událost.
published: 2026-08-21
featured: true
draft: true
tags:
    - devops
    - nasazování
image: /og-default.png?v=2
imageAlt: ASCII model sluneční soustavy ve stylu Gruvbox vedle jména Kryštof Lískovec
---

Tohle je zatím jen ukázkový příspěvek. Díky němu můžu ověřit, že z Markdownu opravdu vznikne stránka blogu. A později ho vyměním za něco skutečného.

## Plán

Plán byl schválně nudný: sestavit image jen jednou, stejnou verzi protáhnout všemi prostředími, přepnout provoz teprve po úspěšném health checku a nechat si po ruce předchozí verzi pro případný návrat.

Žádná důmyslná orchestrace. Žádné hrdinství v terminálu. Jen nasazení, u kterého je jasné, co se právě děje.

```yaml
deploy:
    stage: deploy
    script:
        - ./deploy --environment production --strategy blue-green
    rules:
        - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

## Co se pokazilo

První health check mířil na špatný port. Nasazení se zastavilo, provoz zůstal na původní verzi a z logů bylo hned jasné proč. Přesně takhle má vypadat chyba, když už k ní dojde.

Po opravě portu druhý pokus prošel. Nikoho to nevzbudilo – a přesně to od infrastruktury chci.

## Co bych zachoval

- Jeden sestavený image, který projde celou pipeline.
- Health check, který při chybě zabrání přepnutí provozu.
- Cestu zpátky bez dalšího buildu.
- Logy, ve kterých se vyzná i člověk, který to bude ladit za půl roku.

To je k ukázkovému příspěvku vše. Blog zjevně žije.

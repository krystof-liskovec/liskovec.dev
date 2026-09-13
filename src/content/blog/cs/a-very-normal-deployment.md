---
locale: cs
title: Úplně obyčejné nasazení
description: Ukázkový příspěvek o nasazení změny, aniž by se z toho stala velká událost.
published: 2026-08-21
featured: true
draft: true
tags:
    - devops
    - nasazování
image: /og-default.png?v=2
imageAlt: ASCII model sluneční soustavy ve stylu Gruvbox vedle jména Kryštof Lískovec
---

Toto je ukázkový příspěvek. Slouží k ověření, že blog funguje od souboru Markdown až po hotovou stránku – a dává mi něco, co později nahradím skutečným článkem.

## Plán

Plán byl záměrně obyčejný: jednou sestavit image, poslat stejný artefakt všemi prostředími, přepnout provoz až po úspěšné kontrole stavu a mít předchozí verzi po ruce pro rychlý návrat.

Žádná chytrá orchestrace. Žádné hrdinské sezení v terminálu. Jen nasazení, u kterého je jasné, co právě dělá.

```yaml
deploy:
    stage: deploy
    script:
        - ./deploy --environment production --strategy blue-green
    rules:
        - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

## Co se pokazilo

První kontrola stavu mířila na špatný port. Bezpečně selhala, provoz zůstal u původní verze a logy problém jasně ukázaly. To považuji za dobré selhání.

Po opravě portu druhý pokus vyšel. Nikoho nic nevzbudilo – zhruba takový standard od infrastruktury očekávám.

## Co bych zachoval

- Jeden artefakt procházející celou pipeline.
- Kontrolu stavu, která při chybě zabrání přepnutí.
- Možnost návratu bez nového sestavení.
- Logy napsané pro člověka, který to bude za půl roku ladit.

To je pro ukázkový příspěvek vše. Publikační systém zřejmě žije.

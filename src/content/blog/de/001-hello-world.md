---
locale: de
title: hallo, welt.
description: Von null zu dieser Website – mein erster Beitrag darüber, wie sie entstanden ist.
published: 2026-08-21
featured: true
draft: true
tags:
    - devops
    - deployments
image: /og-default.png?v=2
imageAlt: Ein ASCII-Modell des Sonnensystems im Gruvbox-Stil neben dem Namen Kryštof Lískovec
---

Das hier ist erst mal ein Testbeitrag. Damit prüfe ich, ob aus einer Markdown-Datei tatsächlich eine Blogseite wird. Später kommt an seine Stelle ein richtiger Beitrag.

## Der Plan

Der Plan war absichtlich langweilig: das Image einmal bauen, es durch alle Umgebungen schicken, den Traffic erst nach einem erfolgreichen Healthcheck umschalten und die vorherige Version für einen Rollback griffbereit halten.

Keine ausgefeilte Orchestrierung. Keine Heldentaten im Terminal. Einfach ein Deployment, bei dem klar ist, was gerade passiert.

```yaml
deploy:
    stage: deploy
    script:
        - ./deploy --environment production --strategy blue-green
    rules:
        - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

## Was schiefging

Der erste Healthcheck prüfte den falschen Port. Das Deployment stoppte, der Traffic blieb bei der alten Version und aus den Logs war sofort klar, warum. Wenn schon ein Fehler, dann bitte so.

Nach der Portkorrektur lief der zweite Versuch durch. Niemand wurde davon geweckt – genau das erwarte ich von Infrastruktur.

## Was ich beibehalten würde

- Ein einziges Image für die ganze Pipeline.
- Einen Healthcheck, der bei Fehlern den Wechsel verhindert.
- Einen Rollback ohne neuen Build.
- Logs, mit denen auch die Person etwas anfangen kann, die das in sechs Monaten debuggt.

So viel zum Testbeitrag. Der Blog lebt offenbar.

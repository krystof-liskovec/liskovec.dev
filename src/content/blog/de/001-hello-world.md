---
locale: de
title: hallo, welt.
description: Von nichts zu etwas – mein erster Blogbeitrag über die Entstehung der Website, die du gerade besuchst.
published: 2026-08-21
featured: true
draft: true
tags:
    - devops
    - deployments
image: /og-default.png?v=2
imageAlt: Ein ASCII-Modell des Sonnensystems im Gruvbox-Stil neben dem Namen Kryštof Lískovec
---

Dies ist ein Beispielbeitrag. Er soll sicherstellen, dass der Blog vom Markdown-Dokument bis zur fertigen Seite funktioniert – und mir etwas geben, das ich später durch einen echten Beitrag ersetzen kann.

## Der Plan

Der Plan war bewusst unspektakulär: das Image einmal bauen, dasselbe Artefakt durch alle Umgebungen schicken, den Traffic erst nach einer erfolgreichen Zustandsprüfung umschalten und die vorherige Version für einen schnellen Rollback bereithalten.

Keine ausgeklügelte Orchestrierung. Keine heldenhafte Terminal-Sitzung. Einfach ein Deployment, bei dem nachvollziehbar ist, was passiert.

```yaml
deploy:
    stage: deploy
    script:
        - ./deploy --environment production --strategy blue-green
    rules:
        - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

## Was schiefging

Der erste Healthcheck prüfte den falschen Port. Er schlug sicher fehl, der Traffic blieb bei der bisherigen Version, und die Logs machten das Problem deutlich. Für mich ist das ein guter Fehler.

Nach der Korrektur des Ports funktionierte der zweite Versuch. Niemand wurde geweckt – ungefähr das, was ich von Infrastruktur erwarte.

## Was ich beibehalten würde

- Ein einziges Artefakt durch die gesamte Pipeline.
- Einen Healthcheck, der das Umschalten bei Fehlern verhindert.
- Einen Rollback ohne erneuten Build.
- Logs für die Person, die das in sechs Monaten debuggen muss.

Das war es mit dem Beispielbeitrag. Das Veröffentlichungssystem scheint zu leben.

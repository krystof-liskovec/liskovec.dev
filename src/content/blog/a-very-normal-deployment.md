---
title: A very normal deployment
description: A mock post about shipping a change without turning it into an event.
published: 2026-08-21
featured: true
draft: true
tags:
    - devops
    - deployments
image: /og-default-v2.png
imageAlt: A Gruvbox-inspired ASCII solar system orrery beside the name Kryštof Lískovec
---

This is a mock post. It is here to make sure the blog works from Markdown file to finished page—and to give me something real to replace later.

## The plan

The plan was deliberately boring: build the image once, run the same artifact through every environment, switch traffic only after the new version was healthy, and keep the previous version close enough to roll back.

No clever orchestration. No heroic terminal session. Just a deployment that could explain what it was doing.

```yaml
deploy:
    stage: deploy
    script:
        - ./deploy --environment production --strategy blue-green
    rules:
        - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

## What went wrong

The first health check was pointed at the wrong port. It failed safely, traffic stayed where it was, and the logs made the problem obvious. That counts as a good failure.

After fixing the port, the second attempt worked. Nothing woke anyone up, which is roughly the standard I want infrastructure to meet.

## What I would keep

- One artifact moving through the pipeline.
- A health check that blocks the switch.
- A rollback path that does not require rebuilding anything.
- Logs written for the person debugging this six months later.

That is all for the mock post. The publishing system appears to be alive.

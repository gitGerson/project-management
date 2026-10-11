# Next.js pragmatic agent kit

Copy `AGENTS.md` to the **root** of your Next.js repository and copy `docs/ARCHITECTURE.md` to `docs/ARCHITECTURE.md`.

`AGENTS.md` is the broadly supported repository instruction filename (plural); `agent.md` is not necessarily discovered automatically. If your particular agent uses another filename, point it explicitly at `AGENTS.md` or copy its contents to the agent-specific instructions file.

This kit assumes **Next.js App Router + TypeScript + MySQL + Prisma**, but explicitly requires the agent to inspect installed versions and existing project conventions. It is deliberately not a full framework scaffold and does not modify your existing project.

Recommended first request to your agent:

> Read AGENTS.md and docs/ARCHITECTURE.md. Audit the current Next.js codebase against these conventions, identify the top five architectural/security risks, and propose an incremental migration. Do not refactor or change the database until I approve a concrete plan.

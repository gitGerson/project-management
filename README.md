# Next.js pragmatic agent kit

Copy `AGENTS.md` to the **root** of your Next.js repository and maintain `docs/ARCHITECTURE.md` and `docs/UIUX.md` in the `docs/` directory.

`AGENTS.md` is the broadly supported repository instruction filename (plural); `agent.md` is not necessarily discovered automatically. If your particular agent uses another filename, point it explicitly at `AGENTS.md` or copy its contents to the agent-specific instructions file.

This kit assumes **Next.js App Router + TypeScript + MySQL + Prisma**, but explicitly requires the agent to inspect installed versions and existing project conventions. It is deliberately not a full framework scaffold and does not modify your existing project.

Recommended first request to your agent:

> Read AGENTS.md, docs/ARCHITECTURE.md, and docs/UIUX.md. Audit the current Next.js codebase against these conventions, identify the top architectural, security, and UI/UX risks, and propose an incremental plan. Do not refactor or change the database until I approve a concrete plan.

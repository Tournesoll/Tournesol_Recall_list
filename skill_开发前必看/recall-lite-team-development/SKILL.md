---
name: recall-lite-team-development
description: Implement or document the Recall Lite team upgrade while following its fixed scope, file ownership, GitHub workflow, testing rules, and handoff requirements. Use for every development, integration, review, release, or report task in this upgrade.
---

# Recall Lite Team Development

Before changing this project, read [references/00-总要求.md](references/00-总要求.md). Then read exactly the role document for the person doing the work:

- 袁翊博（项目负责人）：[references/01-袁翊博-项目负责人.md](references/01-袁翊博-项目负责人.md)
- 候舒扬：[references/02-候舒扬-AI开发.md](references/02-候舒扬-AI开发.md)
- 贾源：[references/03-贾源-界面与非AI开发.md](references/03-贾源-界面与非AI开发.md)
- 杨桀浩：[references/04-杨桀浩-文档.md](references/04-杨桀浩-文档.md)

For cross-module props, merge order, database changes, or route wiring, also read [references/05-集成契约.md](references/05-集成契约.md).

Do not start from the old `LegacyApp` implementation. The live application is the exported `App` and its V2 route branch near the end of `src/App.tsx`.

Do not edit a file outside the active role's allowlist. If a required change falls outside that list, document the requested integration change instead of making it. The project owner performs shared-file wiring during integration.

Never commit an API key, a real AI response containing private material, local backup data, APK build output, or temporary test artifacts.

After implementation, complete the matching file under `开发后产出文档/`. A task is not ready for merge until that handoff document and the required verification results are present.

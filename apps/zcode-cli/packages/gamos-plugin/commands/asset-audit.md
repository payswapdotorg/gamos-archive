---
description: Audit the world's assets and packages: rights, provenance, compatibility, dependencies.
argument-hint: "[world id or name]"
skills: gamos-asset-intake
---

Use the gamos-asset-intake skill for this request:

$ARGUMENTS

Steps:

1. Resolve the world and read its package graph (`package_graph`).
2. Re-run validation for all packages (`package_validate`).
3. Audit each invalid/pending package against the intake contract:
   - rights-metadata: license and author present (sourceUrl for imports).
   - provenance: origin and createdBy present.
   - engine-compat: package engine matches the world engine (or `*`).
   - file-exists: the path exists in the workspace.
   - deps-resolve: dependencies resolve inside the graph.
4. Check for reference images being used as production assets (unlicensed imports) and flag them.
5. Fix what you can (register missing rights from known sources, correct paths), re-validate, and report:
   - Table: package, type, license, validation, what is missing.
   - Verdict: can this world's packages pass the `packages-validated` release gate?

Never fabricate rights metadata. Unknown rights stay invalid until resolved with the user.

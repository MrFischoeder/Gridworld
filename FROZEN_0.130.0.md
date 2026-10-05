# Frozen GridWorld 0.130.0

The annotated tag `v0.130.0` preserves the game immediately before the settlement progression overhaul.

- Frozen commit: `96dbf66f1cc0ab03b299be1bf8b0c648acdc3bee`.
- Continuing development: branch `feat/settlement-progression`, version 0.131.0.
- Frozen source download: https://github.com/MrFischoeder/Gridworld/archive/refs/tags/v0.130.0.zip

To run the frozen version without changing the development checkout:

```sh
git worktree add ../Gridworld-0.130.0 v0.130.0
cd ../Gridworld-0.130.0
npm ci
npm run dev
```

## Characters and worlds

Existing characters retain their established villages. New characters and newly generated worlds use the small-settlement rules. Multiplayer guests adopt the host world's settlement rules; an empty new server room starts with the new rules.

When 0.131.0 first loads an older character, it keeps the exact original JSON in the same browser's local storage under `gridWorld.frozen.0.130.0`. This backup is written only once. The game continues to use `gridWorld.character.v3` for its active character. A failed backup caused by full browser storage does not discard the active character.

The **New world** action also attempts to keep the previous character/world snapshot under `gridWorld.world.backup.<world seed>`. Browser backups stay on that browser and origin: copy them out if changing browsers or the game address. Git tags preserve source code, not browser or server save data.

To export the frozen character, run this in the game page's browser console and save the resulting text as JSON:

```js
copy(localStorage.getItem('gridWorld.frozen.0.130.0'))
```

To restore it on the frozen game page, first export the current active character, then set `gridWorld.character.v3` to the saved JSON and reload. The new development character is a separate save; preserve it before restoring an earlier snapshot.

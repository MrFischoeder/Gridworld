# Multiplayer consistency (0.111.1, protocol 3)

## Architecture and changes

The existing shared save document, player snapshots, dropped-item arbitration and enemy relays remain separate because they cover different state. No server physics simulation or save-format migration is introduced.

| State | Source of truth / lifecycle |
| --- | --- |
| World seed | Room; first host initializes a hosted room, dedicated rooms load their saved seed |
| Clock | Dedicated server, or hosted room's current host |
| WorldDoc | Room's ordered writes; saved by the existing dedicated server persistence |
| Shared chest/locker contents | WorldDoc, with one server-granted editor while the transfer window is open |
| Dropped items | Existing server drop/take arbitration |
| Player position, held item, vehicle pose/parts/trunk | Existing owning client; snapshots distribute poses, personal saves retain full vehicles |
| Vehicle seats | Server accepts the first valid claim; owner simulates/drives, guests ride or operate the cannon |
| Creatures, robots, bandits | Existing foe owner simulates; relays distribute poses, damage and shots |
| Personal inventory, gold, quests, discoveries, house chests | Existing personal save |

Previously concurrent writers did not receive their own writes back, so A could end with B's value while B ended with A's. Each client now observes the same server order. Writes carry their baseline and a sequence acknowledgement; each client has at most one ordinary world batch in flight and rebases edits made while it waits. Independent object properties merge; conflicting scalar properties and positional arrays follow server arrival order. Dungeon `opened`, `unlocked`, and `killed` arrays are sets of indices and merge their changes.

Containers need more than last-write convergence because transfers credit personal inventory immediately. Shared transfer windows reserve the container before permitting transfers, adopt existing contents, publish each transfer and release on close or disconnect. Stale ordinary container writes are rejected and reconciled. House chests and vehicle trunks retain their existing personal ownership. Locks are runtime only, so server restart cannot preserve a stale lock.

Vehicle seat claims are checked against the owner's published car, location, cannon and accepted occupants. Seat 0 remains the owner's. Driver, passenger and gunner can coexist; duplicate seats and invalid requests are rejected. Removal, replacement in an array slot, location changes and owner disconnect revoke affected rides. Stable save IDs are sent alongside poses to detect replacement. Rendering retains the existing interpolation.

Joining applies WorldDoc after changing the world seed, avoiding the previous reset of shared dungeon progress. Whether a player may seed an empty room is decided before that switch. Hosted rooms retain WorldDoc, drops, seed and clock while empty for reconnects; they remain memory-only and reset on server process restart. Dedicated rooms retain their existing disk persistence.

Protocol 3 requires updating both server and clients. Existing v3 character saves and dedicated WorldDoc files remain readable. Enemy message formats and ownership are unchanged.

## Boundaries and remaining work

- This improves reconciliation and shared container transfers; it does not make every gameplay action transactional. Simultaneous contributions/purchases affecting the same scalar or array can still lose one contribution or consume local resources. Those interactions need explicit server commands with inventory reconciliation.
- Vehicle ownership, maintenance, trunks and abandoned-vehicle claims remain personal/client-owned. Two clients can still independently claim the same generated abandoned vehicle. Vehicles are visible only while their owner publishes them, and guests cannot drive. Promoting full vehicles to persistent room objects needs a separate migration and ownership design.
- Vehicle snapshots retain the existing limit of eight cars per owner. Array indices are still used in ride requests; IDs revoke rather than migrate seats when indices change.
- Boats, the shuttle and other WorldDoc objects converge at the save layer; their runtime physics/animations are not server simulated.
- Existing enemy limits remain: owner departure removes their foes; raider vehicles, dungeon drones and bosses are not covered by foe relays. Loot/reward authority remains client-owned.
- Locks prevent ordinary simultaneous chest transfers, not malicious clients or inventory exploits across crashes. Personal inventories and server contents are not committed atomically to the same database. An interrupted connection can hold a lock until the socket closes; no heartbeat/lease is added.
- Shared visual state uses the existing redraw paths, with explicit in-place updates for opened dungeon chests and unlocked doors. Other dungeon runtime objects and open UI panels are not comprehensively rebuilt.
- Existing dedicated disk writes run periodically. Crash durability and retry of failed world-document writes are unchanged.

## Validation and manual checks

Automated tests exercise real WebSocket rooms, identical ordered world updates, concurrent properties and dungeon progress, container exclusivity/stale-write rejection, late joins, restarts and reconnects, vehicle movement and seat conflicts, driver/passenger/gunner coexistence and invalidation, existing enemy relays and drops. Mocked client/UI tests exercise unsent/in-flight edits, current-state adoption, personal save isolation, lock-before-transfer, lock denial and disconnect safety.

Before release, use two or three desktop browsers on one server:

1. Open the same chest together; only one transfer window should open. Move items/gold rapidly, close it, and verify the next visitor sees exactly what remains. Disconnect with it open and reconnect.
2. Drive with a passenger and gunner. Compete for a seat, switch seats, aim/fire the cannon, cross a world seam, sell/remove a parked vehicle, change locations and disconnect its owner. Inspect figures, smoothing, collision and cockpit views.
3. Change different town properties together; verify both persist. Open different dungeon chests together, leave and rejoin, including joining from a different world seed.
4. Verify tree/rock, bridges, boats, town and dungeon visuals reflect updated save state; fight shared creatures/robots/bandits and check damage and rewards.
5. Restart a dedicated server and verify WorldDoc/drops reload. Stop/restart a hosted server and verify its documented memory-only behavior.
6. Load an existing single-player save, use vehicles and personal chests, and restore the solo backup after multiplayer.

Validated in the cloud workspace:

- `npm test -- --pool=threads --maxWorkers=1 --testTimeout=180000`: 62 files, 268 tests passed. The default fork pool stalled; the initial two-worker thread run had four generation timeouts (cities, installations, quests, world), with no assertion failures. The final single-worker run passed those tests, retaining their explicit timeout limits.
- `npm test -- tests/mp.test.ts tests/share.test.ts tests/transfer-mp.test.ts --pool=threads --maxWorkers=1`: all 27 focused tests passed.
- `npm run build`: TypeScript and production bundle passed; Vite reports the existing large application chunk warning.
- `git diff --check`: passed. Browser/manual checks above have not been performed.

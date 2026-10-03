# City garrisons and factions (0.117.0)

## City population

Each ruined city has 16 seeded street posts, separated by at least 150 metres. The selection includes machines, gnawer nests and bandit gangs. Posts near the centre have slightly larger rosters: 2–3 robots, 4–5 gnawers or 3–4 bandits. At most three posts are awake near a player. Distant posts are streamed, rather than simulating an entire city at once.

The old 45 **game** minutes were 45 real seconds (`MIN_PER_SEC = 1`). A defeated post now waits 600 game minutes: **ten real minutes of active world time**. After the deadline, reinforcements also wait until the player is at least 45 metres away. Random wilderness encounters are refused while the player is inside a city.

`char.cityGarrisons[city:street]` holds only changes: per-slot remaining HP (zero means killed) and the reinforcement deadline. The slot roster is deterministic. Streaming out, entering a dungeon or reloading retains the casualties and wounded survivors; unloading is not mistaken for a kill. The post controller owns distance culling of its foes, so independent creature/bandit culls cannot refill a post. The state is part of the shared world document and dedicated-server persistence. Foe snapshots carry the post id so another owner does not duplicate a visible post.

Older saves get an empty post-state map automatically. Their world, character and progress are retained; the city population changes to the new selection. Nothing resets the whole game.

## Combat

| Attacker | Player | Bandit | Robot | Wildlife |
| --- | --- | --- | --- | --- |
| Bandit | attacks | ignores | attacks | attacks |
| Robot | attacks | attacks | ignores | ignores |
| Wildlife | attacks | attacks | ignores | ignores |

Robots and wildlife never target or damage each other. Their existing natural behaviours remain: territorial creatures can stay calm, fish are not automatically made aggressive, and Leechwings can still hunt gnawers. The table describes the new combat target selection, not changes to that pre-existing food-chain behaviour.

An owner-controlled foe selects a nearby visible opposing faction when it is closer than the players. Existing movement, attacks and safe-zone rules remain; another player is still selected through the existing multiplayer target wrapper. Damage to a non-player target restores the player's HP, position and velocity, applies the victim's armour and uses its normal death effects. Such kills give no direct player gold or `onKill` credit. The usual world consequences of clearing a bandit camp still apply.

Bolts retain their source, check hostile bodies over the whole frame's swept segment, and ignore friendly factions. Delayed Sentinel shots retarget through the same faction selector. Artillery damages bandits and players, leaving other machines and wildlife unharmed. A hit on a remote enemy goes to its owner marked as NPC damage, avoiding a player reward acknowledgement.

## Validation

Regression tests cover the 16-post cap, spacing, saved partial losses and wounds, ten-minute deadlines, streaming versus death, multiplayer duplicate prevention and snapshot post identity, server persistence, faction relations, melee proxy restoration and swept shots. Old-save migration is checked explicitly.

A headless Chromium run exercised the actual robot, creature and bandit update loops: both sides lost HP in melee; stationary bandits and robots exchanged ranged damage; artillery hurt the bandit while the nearby animal stayed unharmed; robot/animal pairs caused no damage to one another. Player HP stayed unchanged during those NPC fights, and an NPC kill granted no player gold. No JavaScript errors were reported. The ranged check used stationary targets because moving bandits dodge slow projectiles.

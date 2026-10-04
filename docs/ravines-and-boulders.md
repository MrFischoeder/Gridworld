# Ravines, bridges and boulder fields (0.116.0)

Dry mainland ravines are 50–100 m wide and 320–600 m long. Their flat floor is at least 22–36 m below the lowest surrounding ground; individual wall heights also include the natural hills. The starting area, ruined cities, settlement footprints, mountains, ice and sampled river/coast approaches are excluded. Placement is seeded and repeats across the planet seam.

Each ravine has two paths along opposite walls. A continuous smooth height profile joins the outside lip to the bottom; each bench has an 8 m wide core. Trees and both ordinary rocks and new boulders are cleared from the ravine and its approaches. The 2 m terrain lattice renders and collides with the same surface. Existing roads do not fill the ravine; a direct route may need a detour or a bridge.

Use a Bridge Kit near the lip, look into the ravine, then click to stake out a crossing. The existing construction sign accepts logs, stone, nails and rope; materials and rewards scale with deck length. The finished 5.4 m wide bridge has approach ramps, vehicle support and colliding rails. Ravine sites use the existing serialisable `bridgeSites` and `bridges` state and multiplayer sharing. River bridges retain their narrower width limit and water checks.

Boulder fields are local patches roughly 140–260 m across, with rocks of radius 2.5–5.5 m and height 3–8 m. Their colliding bodies block off-road vehicles. Roads, settlement clearings, water, city footprints, installations and ravine escape paths remain clear of these new rocks. Boulder fields use a separate random stream appended to the scattered rocks.

This update adds geometry to existing seeds. Terrain and harvest indices around new ravines may change; there is no migration of built structures. A new world is recommended.

Validation includes deterministic placement and world wrapping, actual lattice path gradients and clearance, bridge planning/construction/serialization, and large boulders. A headless Chromium render of seed 12345 showed no JavaScript errors: 75 draw calls, 15,404 triangles and 14,149 lines. Chromium used software rendering, so its timing is not a laptop FPS benchmark.

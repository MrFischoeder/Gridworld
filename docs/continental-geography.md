# Continental geography (0.115.0)

Every seeded world has two or three large mainland masses. Gridholm lies at the centre of the home continent. Mainland geometry is elliptical with bounded lobed coastlines and local coast noise; the east-west wrap repeats the same continents, rather than joining them across a hidden seam. Mainland gaps contain ocean bands at least six kilometres wide across the non-polar latitudes tested. Around half the area between the ice caps is sea. Polar ice buffers and small offshore islands remain.

Twelve ruined cities replace the previous ten. Their IDs are divided evenly among the mainlands: six per continent in a two-continent world, four in a three-continent world. Each city's four vault IDs remain in the same independent namespace. Near-home cities stay away from Gridholm; every placement still checks sea, mountains, slope and separation.

Industrial installations sample dry continental interiors within their revised 10–65 km distance ranges (minimum distances differ by installation). Their placement keeps the existing sea/river/road/settlement/slope checks. This prevents the old single-mainland search bands from falling into the new seas. Roads retain their existing rejection of sea crossings; boats and piers retain their existing gameplay.

These generator changes alter terrain and generated settlement positions in existing saves. There is no terrain migration or reset of player progress; use a new world for a fresh playthrough. Existing player-built structures at old coordinates may now have different surrounding terrain.

Automated coverage checks both continent counts, dry starting land, kilometre-wide ocean gaps, disconnected mainland components with wrap-aware flood fill, twelve cities distributed across all mainlands, dry city/village/installation placement, roads, rivers, piers and world periodicity. Preview plots are based on generated sea masks and city coordinates; they omit small offshore islands and are not screenshots of gameplay. Browser playthrough and F3 performance checks were not performed.

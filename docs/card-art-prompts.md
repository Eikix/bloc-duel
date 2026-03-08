# Card Art Prompts

These prompts are designed for `BLOC:DUEL` card illustrations.
The goal is to get art that feels like a premium strategy card game, not generic AI slop.

## Global art direction

Use this base prompt before each card-specific prompt:

```text
Near-future techno-geopolitical strategy card illustration, premium board game art, cinematic concept art, sharp silhouette, strong focal subject, layered depth, volumetric light, grounded materials, rich detail, elegant composition, clean negative space for card framing, no text, no UI, no labels, no borders, no watermark, no logo, not cartoon, not chibi, not anime, not low-poly, not 3D render, not photo, not collage.
```

## Color logic by card type

- `AI`: electric blue, cold white, chrome, neural glow
- `ECONOMY`: amber, brass, industrial gold, heat haze
- `MILITARY`: crimson, graphite, smoke, hard contrast
- `SYSTEM`: emerald, teal, diplomatic gold, signal light

## Age logic

- `Age 1`: prototype, emerging, lean infrastructure, hopeful but fragile
- `Age 2`: scaled-up, industrialized, more power, more tension
- `Age 3`: massive, sovereign, global, intimidating, near-singularity

## Negative prompt

Use this when the image model supports it:

```text
text, letters, numbers, UI, card frame, split screen, extra limbs, duplicate objects, blurry, muddy details, washed colors, oversaturated neon mess, flat lighting, bad anatomy, floating props, childish style, comic style, meme style, stock photo look, poster typography, watermark, logo
```

## Prompts by card

### Age 1

`Neural Relay`

```text
Near-future neural research relay station inside a compact sovereign lab, glowing fiber bundles linking glass cores, cold blue compute light, prototype AGI infrastructure, precise technical atmosphere, premium strategy card illustration.
```

`Solar Array`

```text
Vast field of advanced solar mirrors on a windswept frontier, low sun reflecting across engineered panels, compact energy grid hub in the distance, optimistic early-age energy infrastructure, amber-white light, premium strategy card illustration.
```

`Mining Outpost`

```text
Autonomous mining outpost carved into a harsh mineral landscape, heavy drills, conveyor arms, dust in golden backlight, rugged industrial survival mood, early expansion economy, premium strategy card illustration.
```

`Recon Drone`

```text
Stealth recon drone gliding above a disputed border at dawn, tactical scan beams crossing fog, small but menacing military prototype, red threat accents against cold terrain, premium strategy card illustration.
```

`Signal Intercept`

```text
Cyber intelligence interception room, signal waves captured across holographic surveillance lattice, analysts reduced to silhouettes, green-teal encrypted glow, covert systems warfare mood, premium strategy card illustration.
```

`Embassy`

```text
Monumental near-future embassy plaza under rain-polished light, flags replaced by luminous diplomatic sigils, guarded calm, ceremonial architecture blending modernism and soft power, elegant diplomacy atmosphere, premium strategy card illustration.
```

`Data Center`

```text
Compact sovereign data center corridor, dense server racks, blue indicator lights, cooling vapor, clean industrial symmetry, foundational compute economy asset, premium strategy card illustration.
```

`Propaganda Hub`

```text
Mass media command hub projecting synchronized narratives across giant urban screens, red emergency glow, dense information warfare control room, subtle menace, premium strategy card illustration.
```

`Supply Depot`

```text
Strategic supply depot stacked with modular containers, autonomous loaders moving through warm floodlights, organized abundance, early logistics backbone, amber industrial palette, premium strategy card illustration.
```

`Research Cluster`

```text
Cluster of connected experimental labs around a luminous compute core, researchers dwarfed by machines, sterile blue-white light, rapid innovation atmosphere, early AI acceleration, premium strategy card illustration.
```

### Age 2

`Quantum Lab`

```text
High-security quantum laboratory with suspended cryogenic processors and entangled light chambers, polished metal, blue spectral glow, advanced AI breakthrough facility, premium strategy card illustration.
```

`Fusion Plant`

```text
Operational fusion plant with immense reactor ring and controlled plasma core, industrial catwalks, heat shimmer, triumphant energy scale-up, amber and white power glow, premium strategy card illustration.
```

`Forge Complex`

```text
Gigantic automated forge complex pouring sparks and liquid metal through robotic foundry lines, brutal industrial scale, hot orange light and smoke, mid-age economic power, premium strategy card illustration.
```

`Drone Swarm`

```text
Coordinated military drone swarm filling stormy airspace, dozens of tactical silhouettes moving as one intelligence, red target flashes, escalating conflict, premium strategy card illustration.
```

`Cyber Division`

```text
Elite cyber warfare division command floor, encrypted battle maps, operators behind dark glass, green signal storms pouring across screens, organized digital offense, premium strategy card illustration.
```

`Summit Accord`

```text
Historic geopolitical summit in a luminous circular chamber, rival delegations facing each other beneath suspended world map light sculpture, tense peace, elegant diplomatic spectacle, premium strategy card illustration.
```

`Deep Learning`

```text
Immense deep learning engine visualized as layered neural architecture towers, data streams flowing like rivers of light, disciplined blue-white palette, sense of intelligence compounding, premium strategy card illustration.
```

`Biocompute Node`

```text
Biocompute node merging wet lab bioreactors with precision compute hardware, organic textures meeting chrome machinery, eerie blue-green glow, hybrid intelligence frontier, premium strategy card illustration.
```

`Arms Dealer`

```text
Shadowy international arms broker hall, luxury surfaces mixed with weapon silhouettes and sealed contracts, amber wealth meeting crimson threat, transactional power atmosphere, premium strategy card illustration.
```

`Orbital Station`

```text
Near-orbit command station overlooking Earth curvature, compute arrays and communication dishes lit by dawn, serene but strategic, teal and silver systems palette, premium strategy card illustration.
```

### Age 3

`AGI Singularity`

```text
Monumental AGI singularity chamber, vast luminous intelligence core eclipsing the room, impossible scale, blue-white transcendence with strict geometric order, awe and danger balanced, premium strategy card illustration.
```

`Dyson Collector`

```text
Megastructure energy collector harvesting stellar light in space, colossal mirrored arcs, blazing solar corona, civilization-scale ambition, golden-white radiance, premium strategy card illustration.
```

`Synthetic Foundry`

```text
Planetary synthetic foundry manufacturing advanced materials with autonomous titan machinery, molten rivers, smoke columns, relentless industrial supremacy, premium strategy card illustration.
```

`Orbital Strike`

```text
Strategic orbital strike descending from the upper atmosphere onto a hardened target, clean military geometry, terrifying precision, crimson warning light cutting through darkness, premium strategy card illustration.
```

`Total Surveillance`

```text
Planet-scale surveillance nexus mapping every signal and movement, endless sensor constellations, emerald and teal data web surrounding a dark command core, absolute cyber control, premium strategy card illustration.
```

`World Treaty`

```text
Grand world treaty signing inside a monumental international chamber, delegates framed by a radiant globe installation, hopeful but strategic unity, emerald-gold diplomatic grandeur, premium strategy card illustration.
```

`Neural Sovereign`

```text
Sovereign superintelligence embodied as a colossal neural throne of light and architecture, blue-white command presence, regal and inhuman, final-age AI supremacy, premium strategy card illustration.
```

`Nuclear Deterrent`

```text
Cold nuclear deterrence complex with missile silos, command bunkers, and distant launch towers under blood-red dawn, restrained terror, military final escalation, premium strategy card illustration.
```

`Global Exchange`

```text
Hyper-connected global exchange floor spanning finance, logistics, and digital markets at planetary scale, amber-gold data streams, immense wealth machinery, systemic power atmosphere, premium strategy card illustration.
```

`Space Command`

```text
Supreme space command bridge coordinating fleets, satellites, and orbital infrastructure around Earth, teal control lights, strategic calm before decisive action, final-age systems dominance, premium strategy card illustration.
```

## Fast formula for batch generation

If you want to mass-produce variants, use:

```text
[BASE PROMPT]. [CARD PROMPT]. Vertical composition, centered focal subject, readable silhouette, premium collectible card art, subtle atmosphere, high detail.
```

## Variation knobs

- Add `close-up subject` if the result is too environment-heavy.
- Add `wide monumental shot` if the result is too generic.
- Add `brutalist architecture` for bloc propaganda energy.
- Add `retro-futurist realism` for a more board-game identity.
- Add `painterly concept art` if the model goes too photorealistic.

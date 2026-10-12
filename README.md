# Bonfire

A small fire in the Swiss Alps. Open the link, pick a name and a jacket, and walk through a
real larch-and-stone-pine meadow below Riffelalp (2,110 m, above Zermatt) to a crackling
campfire at golden hour, with the real Matterhorn on the horizon and whoever else is there.

The landscape is real: swisstopo elevation (swissALTI3D, 2 m) and aerial imagery
(SWISSIMAGE) out to 26 km, the forest placed where the real trees stand, and the evening sun
at its true mid-September position. Add `?time=sunrise` for the morning version.

Built with Vite, React, TypeScript, React Three Fiber, drei, postprocessing, Zustand,
Tailwind CSS, Supabase Realtime (Presence + Broadcast) and the Web Audio API.

## Run locally

Requirements: Node 20+ and a Supabase project (the free plan is fine; no tables needed).

```bash
npm install
cp .env.example .env.local   # then fill in your project URL and publishable/anon key
npm run dev                  # http://localhost:5173
```

`.env.local` needs only the **public** key (Project Settings → API Keys → publishable key,
or the legacy `anon` key). Never put the secret/`service_role` key in a frontend.

Without `.env.local` the site still runs; you'll just be alone at the fire.

## Test multiplayer with two windows

1. `npm run dev`
2. Open the URL in **two separate browser windows** side by side (separate windows rather
   than tabs: browsers throttle background tabs).
3. Join in both with different names. Each window shows the other player, the counter
   reads "🔥 2 people around the fire", and walking, sitting, chat bubbles and emotes
   appear in the other window.
4. Close one window: the other drops back to 1 within a few seconds.

## Controls

| | |
| --- | --- |
| WASD / arrows | walk (relative to the camera) |
| Shift + W | sprint |
| two-finger swipe (trackpad) | look around; pinch to zoom. Mouse: drag to look, wheel to zoom. Q/E also turn |
| stop by a log bench | sit down on it, facing the fire |
| R (on a log, or by the radio) | the radio: internet radio stations, or paste a Spotify / YouTube link. Plays only for you |
| F (hold, on a log) | roast a marshmallow over the fire: it browns, then burns if you hold it too long. Everyone sees it |
| Enter | chat (80 characters, a bubble for ~5 s) |
| 1–5 | wave · warm hands · sleepy · heart · dance |
| M | mute (remembered) |

On touch screens: a thumbstick, chat and emote buttons, and a "hold to roast" button while you're on a log.

## Share

The camera button (or `P`) takes a postcard: the current view with your name, the place and
the date in the corner, shared via the system share sheet on phones or downloaded as a PNG.
`public/og.jpg` is the preview a shared link shows; replace it with a nicer shot any time.

## Performance

Quality adapts automatically: it starts from a guess based on your GPU (medium for most),
steps up when there's headroom and down when the frame rate drops, and remembers the level.
Force a level with `?quality=low|medium|high`. Low runs comfortably on integrated graphics;
high wants a recent discrete GPU or Apple silicon.

## Deploy to Vercel

1. Push this repo to GitHub (`.env.local` is git-ignored).
2. In Vercel: **Add New → Project**, import the repo. The framework preset is detected as
   **Vite** (build `npm run build`, output `dist`).
3. Under **Settings → Environment Variables** add `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` (Production and Preview), then deploy. Vite inlines these at
   build time, so redeploy after changing them.

Or from the CLI: `npx vercel`, then `npx vercel env add VITE_SUPABASE_URL` (and the key),
then `npx vercel --prod`.

## Tuning

Every feel-related number (fog, light flicker, walking speed, sit distance, camera, bloom,
network rates, room cap) lives in [`src/config.ts`](src/config.ts).

In development you can switch features off to profile, e.g.
`http://localhost:5173/?off=flames,smoke,ao,trees,grass,terrain,farforest,rocks,wildlife,post,audio`.

## Music

The radio by the fire plays on your machine only; nothing is broadcast to other players.

- **Stations** come from the free, community-run [Radio Browser](https://www.radio-browser.info)
  directory (no key needed). On an `https` site, browsers block `http`-only streams, so a few
  stations won't play; pick another.
- **Spotify / YouTube**: paste a link and it plays in their official embedded player.
  Spotify plays full tracks when the listener is logged in to Spotify in that browser,
  otherwise 30-second previews.

## Rebuilding the landscape

`node scripts/build-terrain.mjs <cacheDir> public/assets/riffelalp` re-downloads the
elevation and aerial imagery (~25 MB, cached) and re-bakes everything in about a minute
(`SUN=sunrise` for the morning shadows). Edit `CAMP` at the top of the script to move the fire.

## Realtime quotas

Supabase's Free plan allows 100 Realtime messages/second and 2 million/month per project,
and each broadcast is delivered (and likely counted) once per listener. So:

- movement is only broadcast while walking, at a rate that adapts to how many people are
  online and moving (`NET.messageBudget`, default 60/s for the whole room);
- where you stop or sit is stored in Presence, so idle players cost nothing and late
  joiners still see everyone;
- nothing is sent while you're alone.

On the Pro plan (500/s) raise `NET.messageBudget` to ~400 for snappier movement with
bigger crowds.

## Project structure

```
src/
  config.ts            all tunables
  scene/               sky + sun, real terrain, meadow, grass, larches & stone pines, impostor forest, fire, post FX
  world/               loaders for the baked real-world data
  scene/fire/          volumetric flames, smoke, sparks, charred logs, light scattering
  player/              local + remote players, hooded character, camera, controls, collision
  net/                 Supabase client, presence/broadcast, protocol validation, interpolation
  audio/               procedural fire, breeze, crickets, cowbells, footsteps (Web Audio, no files)
  ui/                  join screen, HUD, chat input, counter, mute, touch controls
  store/               zustand stores (game state, chat bubbles / emotes)
  lib/                 names, palette, profanity filter, terrain/forest generation, noise
public/assets/         textures, models, sky and the baked landscape — see CREDITS.md
scripts/               build-terrain.mjs: bakes the real landscape from swisstopo data
```

## Credits

Characters and animations are CC0 by [Quaternius](https://quaternius.com) (Universal Base
Characters, Universal Animation Library). Terrain and aerial imagery © swisstopo
(swissALTI3D, SWISSIMAGE), plus
[AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/); textures, models and the
sky are CC0 from [Poly Haven](https://polyhaven.com). Details in
[`public/assets/CREDITS.md`](public/assets/CREDITS.md).

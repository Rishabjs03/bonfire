# Bonfire

A small fire in the Swiss Alps. Open the link, pick a name and a jacket, and walk through a
moonlit spruce forest above Zermatt to a crackling campfire, with the real Matterhorn on the
horizon and whoever else is there tonight.

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
| WASD / arrows | walk (relative to the camera) · hold Shift to walk slowly |
| drag / Q, E | look around |
| stand still near the fire | sit down and warm up |
| Enter | chat (80 characters, a bubble for ~5 s) |
| 1–4 | wave · warm hands · sleepy · heart |
| M | mute (remembered) |

On touch screens: a thumbstick, plus chat and emote buttons. Note: the visuals target desktop
GPUs; phones may run slowly.

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
`http://localhost:5173/?off=flames,smoke,ao,trees,terrain,snow,post`.

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
  scene/               sky + moon, real Alps terrain, ground, procedural spruces, fire, snow, post FX
  scene/fire/          volumetric flames, smoke, sparks, charred logs, light scattering
  player/              local + remote players, hooded character, camera, controls, collision
  net/                 Supabase client, presence/broadcast, protocol validation, interpolation
  audio/               procedural fire, wind and footsteps (Web Audio, no files)
  ui/                  join screen, HUD, chat input, counter, mute, touch controls
  store/               zustand stores (game state, chat bubbles / emotes)
  lib/                 names, palette, profanity filter, terrain/forest generation, noise
public/assets/         textures, models, sky and elevation data — see CREDITS.md
```

## Credits

Textures, models and the night sky are CC0 from [Poly Haven](https://polyhaven.com); the moon
is NASA's LROC colour map (public domain); elevation is from
[AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/). Details in
[`public/assets/CREDITS.md`](public/assets/CREDITS.md).

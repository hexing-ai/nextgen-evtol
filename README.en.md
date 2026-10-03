# Nextgen eVTOL

**Your first eVTOL ride over Hong Kong, in a browser.**

Board the conceptual NG-01 at Central, take in Victoria Harbour through the window, or switch to assisted piloting. A 5½-minute sightseeing route connects Central Harbourfront to West Kowloon.

[![Build and deploy](https://github.com/hexing-ai/nextgen-evtol/actions/workflows/pages.yml/badge.svg)](https://github.com/hexing-ai/nextgen-evtol/actions/workflows/pages.yml)

**[Play the live demo ↗](https://hexing-ai.github.io/nextgen-evtol/)** · [Quick start](#run-locally) · [Architecture (中文)](docs/ARCHITECTURE.md) · [中文](README.md)

[![In-browser screenshot: Central boarding screen and NG-01](docs/images/boarding.png)](https://hexing-ai.github.io/nextgen-evtol/)

*Actual browser capture of the current playable prototype, using simplified buildings and conceptual facilities. The interface is currently in Chinese.*

## Try it in three minutes

No account, client installation, or API key required.

1. Choose **乘客观景** (passenger) and **开始登机** (board). Drag to look around; switch between **舷窗** (window), **前舱** (forward), and **外部** (chase) cameras.
2. Click **轻驾驶** (pilot). Use W/S to accelerate/decelerate, A/D to turn, Q/E to climb/descend, and Space to slow into a hover. Click **交还自动驾驶** to attempt a return to the route.
3. Click **拍照** to save a photo, then open the gallery on the right to download it. Open visible landmark labels to discover them. Esc pauses/resumes the flight.

The full automatic route takes about 5 minutes 30 seconds; manual exploration and pauses extend the trip. Start with a desktop browser. Initial loading depends on network and GPU performance.

| Passenger sightseeing | Assisted piloting |
| --- | --- |
| ![Window view toward Central](docs/images/passenger.png) | ![Chase view with flight controls](docs/images/pilot.png) |

## Run locally

Install **Git, Node.js 22.12+ and npm**. Node 22 LTS is recommended; nvm users can run `nvm install && nvm use` inside the project.

```sh
git clone https://github.com/hexing-ai/nextgen-evtol.git
cd nextgen-evtol
npm ci
npm run dev
```

Open the URL printed by Vite, usually **http://127.0.0.1:5173**. Once the boarding button is enabled, the scene is ready. If the port is busy, Vite picks the next available one.

No `.env`, database, Cesium ion token, or backend process is required. Terrain, building snapshots, and the aircraft are included. **`npm start` runs the optional REST API, not the website.**

```sh
npm run check      # Data validation, automated tests, build, static export
npm run preview    # Serve the completed build, normally on port 4173
```

A modern browser with **WebGL 2 and hardware acceleration** is required. Esri satellite imagery and Google Fonts load over the network. Local terrain and buildings remain available if imagery fails. For a slower GPU, open settings and select **流畅** (performance). Narrow screens have touch controls; phone GPU coverage is still limited.

## What is included

- A conceptual Central → West Kowloon route with takeoff, cruise, approach and landing.
- Passenger and assisted-pilot modes, three cameras, free look and landmark discovery.
- Game-level region, terrain and obstacle protection, plus route handover.
- Local flight checkpoints and a downloadable photo gallery holding up to 12 images.
- Regional DEM terrain and 7,748 OSM building/building-part footprints around the harbour, with simplified facades and estimated heights where data is missing.

The application runs **React + Resium + CesiumJS**. The browser and optional Node API share flight, geometry and validation modules. GitHub Pages serves static files; the browser computes flight state locally. Checkpoints use localStorage and photos use IndexedDB, with no cloud synchronization.

For implementation details, see [architecture](docs/ARCHITECTURE.md), [development and deployment](docs/DEVELOPMENT.md), [API contract](docs/API.md), and [verification record](docs/release.md) (currently in Chinese).

## Scope and next steps

This is a playable 3D prototype of one sightseeing route, not an official digital twin or flight-training system. Driving is limited to the harbour area, despite broader terrain coverage. Aircraft, routes and terminals are concepts; game protection is not real-world airspace or engineering approval. Official textured Hong Kong 3D Tiles are not integrated.

Next areas to explore: better licensed city/cabin assets, additional validated routes, real-device mobile performance, localization and accessibility. These are directions, not shipped features or promised dates. Drone logistics and transport business management are outside the current scope.

## Feedback and licensing

Found a problem or have a Hong Kong route in mind? [Open an issue](https://github.com/hexing-ai/nextgen-evtol/issues) and see the [participation guide](CONTRIBUTING.md). **Star the repository** if you would like to follow the next flight.

The project uses open-source libraries including CesiumJS, Resium and React. Flight3DView informed playback/camera organization; none of its source files were copied. **Original project code does not currently have an open-source license.** Public visibility does not itself grant redistribution or commercial-use rights. The OSM-derived database is provided under ODbL 1.0; dependencies, terrain and imagery retain their separate terms. See [third-party notices](THIRD_PARTY_NOTICES.md).

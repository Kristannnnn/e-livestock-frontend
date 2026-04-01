# E-Livestock Frontend

Frontend client for the E-Livestock system built with Expo Router, React Native, and Expo web export. This project serves livestock owners and inspectors through a shared mobile-first application that can also run on the web.

## Overview

The frontend connects to the E-Livestock backend API and provides the day-to-day user flows for:

- account access and recovery
- livestock inspection scheduling
- permit and form viewing
- renewal request submission
- QR-based antemortem verification
- in-app and device notifications

This app is focused on the operational client experience. The admin panel is maintained separately in the sibling `e-livestock-admin` project.

## Core Features

### Owner Features

- register and sign in to an account
- book inspection appointments
- track schedules and submitted forms
- send renewal requests
- review notifications and profile-related settings

### Inspector Features

- access livestock inspector dashboards
- create and review livestock forms
- inspect and update schedule activity
- manage antemortem inspection queues
- verify QR-linked records during field activity

### Shared Platform Features

- Expo Router file-based navigation
- static web export support
- search-engine metadata and SEO asset generation
- push notification bootstrap and notification response handling
- reusable UI shell and agriculture-themed design system

## Tech Stack

- Expo SDK 54
- Expo Router
- React 19
- React Native 0.81
- React Native Paper
- Expo Notifications
- Expo Camera
- Static web export via `expo export --platform web`

## Project Structure

```text
app/                     File-based routes and entry screens
app/(mobile)/            Main owner and inspector mobile routes
components/              Shared UI components and app shells
constants/               Theme values and shared design tokens
hooks/                   Shared React hooks
lib/api/                 API base URL logic and route definitions
lib/notifications/       Notification setup and device helpers
lib/seo/                 SEO metadata helpers for web
public/                  Static web assets, manifest, robots, sitemap
scripts/                 Utility scripts such as SEO asset generation
assets/                  App icons and image assets
```

## Main Routes

Common screens in `app/(mobile)/` include:

- `ownerDashboard.jsx`
- `appointment.jsx`
- `checkSchedule.jsx`
- `renewalRequests.jsx`
- `viewForms.jsx`
- `livestockInspectorDashboard.jsx`
- `createLivestockForm.jsx`
- `antemortemDashboard.jsx`
- `antemortemSchedules.jsx`
- `antemortemScanQRcode.jsx`
- `register.jsx`
- `sendOtp.jsx`
- `verifyOtp.jsx`
- `resetPassword.jsx`
- `notifications.jsx`
- `settings.jsx`

Root-level routes include:

- `index.jsx` for login
- `_layout.jsx` for app bootstrap, notification listeners, and shared overlays
- `+html.tsx` and `+not-found.jsx` for web shell and fallback handling

## How The App Works

### Routing

The project uses Expo Router. Screens are created from files inside [`app/`](./app), so route organization follows the file structure directly.

### API Communication

API requests are built from:

- [`lib/api/client.js`](./lib/api/client.js) for the base URL and route mode
- [`lib/api/routes.js`](./lib/api/routes.js) for endpoint definitions

Each API route can expose:

- a `legacy` path for direct PHP endpoints
- a `clean` path for rewritten URL patterns

The selected mode is controlled by `EXPO_PUBLIC_API_ROUTE_MODE`.

### Notifications

App startup is handled in [`app/_layout.jsx`](./app/_layout.jsx). During bootstrap the app:

- configures device notifications
- installs a notification response listener
- redirects notification taps to the notifications screen
- shows a startup loading overlay while native initialization completes

### Web Support

The app supports Expo web export. SEO metadata and web assets are generated through the included scripts and files in [`public/`](./public) and [`lib/seo/`](./lib/seo).

## Prerequisites

- Node.js 18 or newer
- npm
- Android Studio or a connected Android device for native Android testing
- Expo Go or a development build for device testing

## Installation

1. Open the frontend project directory:

   ```bash
   cd e-livestock-frontend
   ```

2. Install dependencies:

   ```bash
   npm install or npm ci -> for clean install
   ```

3. Create a local environment file:

   ```bash
   Copy-Item .env.example .env
   ```

4. Update the environment values for your local or deployment target.

## Environment Variables

The frontend reads public Expo variables from `.env`.

| Variable | Required | Description |
| --- | --- | --- |
| `EXPO_PUBLIC_API_BASE_URL` | Yes | Base URL of the backend API, for example `http://localhost/e-livestock-backend/API` |
| `EXPO_PUBLIC_API_ROUTE_MODE` | Yes | Set to `legacy` for PHP-style endpoints or `clean` for rewritten routes |
| `EXPO_PUBLIC_SITE_URL` | Recommended | Public website URL used for SEO metadata and web asset generation |

Example `.env.example` values:

```env
EXPO_PUBLIC_API_BASE_URL=https://your-domain.com/API
EXPO_PUBLIC_API_ROUTE_MODE=legacy
EXPO_PUBLIC_SITE_URL=https://e-livestock.tulongkabataanbicol.com
```

If `.env` is not present, the app falls back to the default production API configured in [`lib/api/client.js`](./lib/api/client.js).

## Available Scripts

| Command | Purpose |
| --- | --- |
| `npm run start` | Starts the Expo development server |
| `npm run android` | Builds and launches the Android app locally |
| `npm run ios` | Runs the iOS target in supported macOS environments |
| `npm run web` | Starts the app in web mode |
| `npm run lint` | Runs Expo linting |
| `npm run seo:generate` | Regenerates SEO-related static assets |
| `npm run build:web` | Generates SEO assets and exports the static web build |
| `npm run reset-project` | Runs the Expo starter reset utility |

## Development Procedure

1. Start the development server:

   ```bash
   npm run start
   ```

2. Choose a target:

- Android emulator or device: `npm run android`
- Web browser: `npm run web`

3. Make changes in the route and component files.
4. Verify API requests against the configured backend base URL.
5. Run linting before committing:

   ```bash
   npm run lint
   ```

## Build And Deployment

### Web Build

1. Confirm the `.env` values match the target environment.
2. Run:

   ```bash
   npm run build:web
   ```

3. Deploy the generated static output from `dist/`.

### Mobile Build Notes

This project includes [`eas.json`](./eas.json) for EAS build profiles:

- `development`
- `preview`
- `production`

The app currently targets Android with package name `com.kristanJ.elivestockapplication`.

## Backend Integration Notes

This frontend expects a compatible E-Livestock backend API. In this workspace, the related backend is available in the sibling `e-livestock-backend` directory.

Important integration points:

- authentication endpoints are used from the login, registration, OTP, and password reset flows
- owner and inspector dashboards depend on schedule, form, analytics, and renewal endpoints
- antemortem screens depend on schedule status, queue, and QR verification endpoints
- notifications rely on push token registration and notification list endpoints

## Generated Files And Git Notes

`expo-env.d.ts` is auto-generated by Expo because `typedRoutes` is enabled in [`app.json`](./app.json). It is a generated support file and should not be edited manually.

Important Git behavior:

- `.gitignore` only affects files that are not currently tracked
- if `expo-env.d.ts` was committed before, Git will continue tracking it
- to stop tracking it while keeping the local file, run:

  ```bash
  git rm --cached expo-env.d.ts
  ```

After that, the ignore rule in [`.gitignore`](./.gitignore) will apply normally.

## Troubleshooting

### API Requests Fail

- confirm `EXPO_PUBLIC_API_BASE_URL` points to the correct backend
- confirm the backend is reachable from the device or emulator
- confirm `EXPO_PUBLIC_API_ROUTE_MODE` matches the backend routing style

### Web Build Looks Outdated

- run `npm run seo:generate`
- rebuild with `npm run build:web`
- verify the deployed host is serving the latest `dist/` output

### Notifications Do Not Respond

- check notification permissions on the device
- confirm the notification registration endpoints are available
- review bootstrap logic in [`app/_layout.jsx`](./app/_layout.jsx)

## Documentation Maintenance

Update this README whenever:

- project scripts change
- environment variables change
- routing conventions change
- new major screens or user flows are added
- build or deployment procedures change

Keep the following files aligned with the documentation:

- [`.env.example`](./.env.example)
- [`lib/api/routes.js`](./lib/api/routes.js)
- [`app.json`](./app.json)
- [`eas.json`](./eas.json)

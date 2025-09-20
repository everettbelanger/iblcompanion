# IBL Baseball Companion# Baseball Companion



This project is a lightweight, single-page baseball companion built with vanilla HTML/CSS/JS.A modern baseball companion web app for play-by-play tracking, stat recording, and interactive field display.



- Entry pages: `index.html`, `lineup.html`, `game.html`## Features

- Runtime script: `main.js` (used by `game.html`)- Interactive baseball field with player photos at defensive positions

- Assets: Player photos as JPG in `Player-photos/`, player cards as PNG in `Player-cards/`- Dynamic base runner and batter display

- Player cards and team logos

## Animations Toggle- Play-by-play input with modals for all play types

- In-depth stat tracking and display

- In `game.html`, there is an "Animations" checkbox next to the play buttons.- Substitution system by clicking on players

- Setting persists in `localStorage` under key `ibl.animations` (`'1'` enabled, `'0'` disabled). Defaults to enabled.- Advanced UI/animations

- Main menu and game setup

## Note on app.js

## Asset Folders

The file `app.js` is not used by the runtime. You can delete it to avoid confusion.- `Player-photos`: Place player images here

- `Logos`: Place team logos and field background here
- `Player-cards`: Place player card images here

## Teams
- New York Yankees
- Detroit Tigers

## Usage
Open `index.html` in your browser to start.

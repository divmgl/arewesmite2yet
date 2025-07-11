# Scripts Package

This package contains TypeScript scripts used to generate the initial `gods.json` file for the Smite gods tracking system.

## Scripts

1. **01-scrape-gods.ts** - Scrapes Smite 1 wiki to extract all gods data
2. **02-scrape-smite2-gods.ts** - Scrapes Smite 2 wiki to determine ported status and add exclusives
3. **03-normalize-dates.ts** - Normalizes all dates to YYYY-MM-DD format using date-fns
4. **04-download-images.ts** - Downloads god portrait images from wikis to web package
5. **05-download-thumbnails.ts** - Downloads small 35px god icon thumbnails for table display
6. **06-download-pantheon-icons.ts** - Downloads official Hi-Rez pantheon icons for table display

## Usage

```bash
# Run scripts in order
bun run 01-scrape-gods.ts
bun run 02-scrape-smite2-gods.ts
bun run 03-normalize-dates.ts
bun run 04-download-images.ts
bun run 05-download-thumbnails.ts
bun run 06-download-pantheon-icons.ts
```

## Runtime

This project uses **Bun** as the JavaScript runtime. All scripts should be executed using `bun run <script-name>`.

## Important Note

These scripts are **only used for initial data generation**. Once the `gods.json` file is created, future updates should be done via **Pull Requests on GitHub** rather than re-running these scripts.

The scripts were designed to bootstrap the data from the wiki sources, but ongoing maintenance should be handled manually to ensure data accuracy and prevent automated overwrites of curated information.
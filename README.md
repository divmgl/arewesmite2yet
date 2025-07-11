# Are We SMITE 2 Yet?

A website that tracks the porting status of gods from SMITE 1 to SMITE 2.

[arewesmite2yet.com](https://arewesmite2yet.com)

## Purpose

This project helps the SMITE community understand which gods have been ported to SMITE 2, which are exclusive to SMITE 2, and which are still waiting to be ported.

## Contributing

If you notice any incorrect information, missing gods, or outdated statuses, please:

1. **Open an issue** to report the problem
2. **Submit a pull request** with the correct information
3. **Suggest improvements** to the website or data structure

All data is manually curated to ensure accuracy, so feedback and corrections are appreciated.

## How It Works

This repo is a monorepo containing:

- **Frontend**: Astro + React with Tailwind CSS
- **Data**: JSON files with TypeScript types
- **Deployment**: Cloudflare Pages with automated CI/CD
- **Package Manager**: Bun
- **Build System**: Turborepo

### Project Structure

```
packages/
├── configs/          # Shared TypeScript and tooling configurations
├── data/             # Gods data and TypeScript types
├── scripts/          # Data scraping and processing scripts
└── web/              # Main website (Astro + React)
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (latest version)
- Node.js 18+ (for compatibility)

### Installation

```bash
# Clone the repository
git clone https://github.com/divmgl/arewesmite2yet.git
cd arewesmite2yet

# Install dependencies
bun install

# Start the development server
bun run dev
```

### Development Commands

```bash
# Run the development server
bun run dev

# Run quality checks (lint, typecheck, build)
bun turbo predeploy

# Run individual tasks
bun turbo lint
bun turbo typecheck
bun turbo build

# Deploy to production
bun turbo deploy
```

### Making Changes

1. **Data Updates**: Edit `packages/data/gods.json` to update god information
2. **UI Changes**: Modify components in `packages/web/src/components/`
3. **Styling**: Update Tailwind classes or add new styles
4. **Types**: Update TypeScript types in `packages/data/types.ts`

Always run `bun turbo predeploy` before submitting pull requests to ensure all quality checks pass.

## Data Sources

The god data is compiled from:
- [SMITE Wiki](https://smite.fandom.com/wiki/List_of_gods)
- [SMITE 2 Wiki](https://wiki.smite2.com/w/Gods)
- Community reports and updates

## License

MIT


## Acknowledgments

- **Hi-Rez Studios** for creating SMITE and SMITE 2

## Copyright and Disclaimers

This project is not affiliated with Hi-Rez Studios. SMITE and SMITE 2 are trademarks of Hi-Rez Studios, Inc. All god names, images, and related intellectual property are the property of Hi-Rez Studios, Inc.

The data and images used in this project are for informational and educational purposes only. No copyright infringement is intended.


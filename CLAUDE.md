## Project Guidelines

- We're using Bun as the package manager. Never run npm or pnpm scripts.
- Always use `bun` commands instead of `npm` or `pnpm`
- For global installs, use `bun install -g` instead of `npm install -g`

## Development Workflow

### Quality Checks
- Always run `bun turbo predeploy` before deployment to ensure all quality checks pass
- The predeploy pipeline runs: lint → typecheck → build for all packages
- The deploy pipeline depends on predeploy and then runs actual deployment

### TypeScript Configuration
- Shared TypeScript configuration is managed in `@arewesmite2yet/configs` package
- All packages extend from `@arewesmite2yet/configs/tsconfig.json` using package references
- Never use relative paths for tsconfig extends - always use the package name
- Each package adds the configs package as a devDependency: `"@arewesmite2yet/configs": "workspace:*"`

### Turborepo Setup
- `turbo.json` defines task dependencies and orchestration
- `predeploy` task runs all quality checks (lint, typecheck, build)
- `deploy` task depends on predeploy and runs actual deployment
- Use `bun turbo <task>` to run tasks across all packages

### Known Issues
- Turborepo shows warnings about `@emnapi/core` lockfile entries - this is a known compatibility issue with Bun's lockfile format
- The warnings don't affect functionality and can be ignored
- All packages build and deploy successfully despite the warnings
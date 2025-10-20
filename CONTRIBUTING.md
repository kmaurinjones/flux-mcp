# Contributing to FLUX MCP

Thanks for your interest in improving FLUX MCP! This document provides guidelines for contributing.

## Development Setup

1. Fork and clone the repository:
```bash
git clone https://github.com/kmaurinjones/flux-mcp.git
cd flux-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Configure your Replicate API token:
```bash
export REPLICATE_API_TOKEN="r8_..."
```

4. Run the server locally:
```bash
node index.js
```

## Code Style

- Use ES modules (`import`/`export`)
- Follow existing code formatting
- Add comments for complex logic
- Keep functions focused and single-purpose

## Making Changes

1. Create a feature branch:
```bash
git checkout -b feature/your-feature-name
```

2. Make your changes and test thoroughly

3. Commit with descriptive messages:
```bash
git commit -m "Add: description of your changes"
```

4. Push and create a pull request:
```bash
git push origin feature/your-feature-name
```

## Pull Request Guidelines

- Describe what your PR does and why
- Reference any related issues
- Ensure the server starts without errors
- Test image generation with at least one model
- Keep changes focused and atomic

## Adding New Models

When Replicate adds new FLUX models:

1. Add model metadata to `FLUX_MODELS` object in `index.js`
2. Update the model enum in `flux_generate` tool schema
3. Update README.md model table
4. Test the model works correctly

## Reporting Issues

- Use GitHub Issues
- Provide clear reproduction steps
- Include Node.js version, OS, and error messages
- Mention which FLUX model was used (if applicable)

## Code of Conduct

- Be respectful and constructive
- Focus on technical merit
- Help others learn and grow

## Questions?

Open an issue for discussion or clarification.

# FLUX MCP Server

MCP server exposing [Replicate's FLUX](https://replicate.com/collections/flux) image generation models to Claude Desktop, Claude Code, and other MCP clients.

## Features

- **6 FLUX models** via Replicate API:
  - **FLUX1.1 Pro Ultra** — highest quality text-to-image (up to ~4MP, raw realism mode)
  - **FLUX1.1 Pro** — fast, reliable commercial-grade default
  - **FLUX.1 Redux [dev]** — image variations/restyling
  - **FLUX.1 Fill [pro]** — professional inpainting/outpainting
  - **FLUX.1 Depth [dev]** — structure-preserving depth-guided editing
  - **FLUX.1 Canny [pro]** — edge-guided generation from sketches

- **Two MCP tools**:
  1. `flux_models` — list models with usage notes
  2. `flux_generate` — generate images, save locally, return file paths + URLs

## Prerequisites

- [Replicate API token](https://replicate.com/account/api-tokens) (required)
- Node.js 18+ (for local development)

## Quick Start

### Claude Code

**From local directory:**
```bash
cd /path/to/flux-mcp-node
claude mcp add flux-mcp --env REPLICATE_API_TOKEN=r8_your_token_here -- node /absolute/path/to/flux-mcp-node/index.js
```

**From npm (after publishing):**
```bash
claude mcp add flux-mcp --env REPLICATE_API_TOKEN=r8_your_token_here -- npx flux-mcp@latest
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "flux-mcp": {
      "command": "npx",
      "args": ["flux-mcp@latest"],
      "env": {
        "REPLICATE_API_TOKEN": "r8_your_token_here"
      }
    }
  }
}
```

**For local development:**
```json
{
  "mcpServers": {
    "flux-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/flux-mcp-node/index.js"],
      "env": {
        "REPLICATE_API_TOKEN": "r8_your_token_here"
      }
    }
  }
}
```

Restart Claude Desktop. Get your Replicate API token from [replicate.com/account/api-tokens](https://replicate.com/account/api-tokens).

## Local Development

```bash
git clone https://github.com/kmaurinjones/flux-mcp.git
cd flux-mcp
npm install
export REPLICATE_API_TOKEN="r8_..."
node index.js
```

## Installation

### From npm (after publishing)

```bash
npm install -g flux-mcp
```

### From source

```bash
git clone https://github.com/kmaurinjones/flux-mcp.git
cd flux-mcp
npm install
npm link
```

## Usage

### List available models

Call `flux_models()` to see all supported models with usage notes.

Returns:
```json
[
  {
    "model": "black-forest-labs/flux-1.1-pro-ultra",
    "display": "FLUX1.1 Pro Ultra",
    "kind": "text-to-image",
    "accepts_image": false,
    "notes": [
      "Highest quality, up to ~4MP; 'raw' mode for realism.",
      "Use when you need best composition/large output."
    ],
    "key_inputs": ["prompt", "raw", "aspect_ratio", "seed", "output_quality", "go_fast"]
  }
]
```

### Generate images

#### Text-to-image (Pro)

```
Generate a mountain landscape (PNG by default):
- prompt: "peaceful mountain landscape with snow-capped peaks and evergreen trees, golden hour"
- download_path: "~/Pictures/flux-gen"
- model: "black-forest-labs/flux-pro"
- aspect_ratio: "16:9"
```

Or specify a different format:
```
Generate as JPEG:
- prompt: "peaceful mountain landscape with snow-capped peaks and evergreen trees, golden hour"
- download_path: "~/Pictures/flux-gen"
- model: "black-forest-labs/flux-pro"
- aspect_ratio: "16:9"
- output_format: "jpeg"
```

#### Text-to-image (Ultra - highest quality)

```
Generate with maximum quality:
- prompt: "sunlit minimalist living room, soft cream walls, terracotta accents"
- download_path: "~/Pictures/flux-gen"
- model: "black-forest-labs/flux-1.1-pro-ultra"
- aspect_ratio: "16:9"
- raw: true
```

#### Image variation (Redux)

```
Create variations of reference.png:
- prompt: "keep composition, shift to sage/cream palette, add subtle grain"
- download_path: "~/Pictures/flux-gen"
- model: "black-forest-labs/flux-redux-dev"
- image_path: "~/Pictures/reference.png"
- num_outputs: 2
```

#### Inpainting (Fill)

```
Remove objects from image:
- prompt: "remove overhead wires, seamless sky"
- download_path: "~/Pictures/flux-gen"
- model: "black-forest-labs/flux-fill-pro"
- image_path: "~/Pictures/street.jpg"
- mask_path: "~/Pictures/street_mask.png"
- guidance: 30
```

## Tool Reference

### `flux_models()`

Returns list of available models with metadata, usage notes, and key input parameters.

**Returns:**
```json
[
  {
    "model": "string",
    "display": "string",
    "kind": "string",
    "accepts_image": boolean,
    "notes": ["string"],
    "key_inputs": ["string"]
  }
]
```

### `flux_generate(...)`

Generate images and save to local disk.

**Required parameters:**
- `prompt` (string) — text prompt describing the image
- `download_path` (string) — directory to save generated images

**Optional parameters:**
- `model` (string) — FLUX model to use (default: `flux-1.1-pro-ultra`)
- `output_format` (string) — output image format: "png" (default), "jpeg", or "webp"
- `image_path` (string) — local path or URL to input image (for models that accept images)
- `mask_path` (string) — path/URL to mask image for inpainting (Fill model)
- `aspect_ratio` (string) — e.g., "1:1", "16:9", "3:4"
- `seed` (integer) — random seed for reproducibility
- `raw` (boolean) — enable raw realism mode (Ultra model)
- `num_outputs` (integer) — number of images to generate
- `output_quality` (number) — quality setting (model-dependent)
- `go_fast` (boolean) — speed vs quality tradeoff (model-dependent)
- `strength` (number) — variation strength (Redux model)
- `num_inference_steps` (integer) — inference steps (Fill model)
- `guidance` (number) — guidance scale (Fill model)

**Returns:**
```json
{
  "model": "black-forest-labs/flux-pro",
  "saved": ["/absolute/path/to/file_1.webp"],
  "urls": ["https://replicate.delivery/..."]
}
```

## Model Selection Guide

| Model | Use Case | Accepts Image | Speed | Quality |
|-------|----------|---------------|-------|---------|
| **FLUX1.1 Pro Ultra** | Best overall quality, large outputs, realism | No | Slower | Highest |
| **FLUX1.1 Pro** | Fast reliable default, commercial use | No | Fast | High |
| **FLUX.1 Redux [dev]** | Image variations, restyling | Yes | Fast | High |
| **FLUX.1 Fill [pro]** | Inpainting, outpainting | Yes + Mask | Medium | High |
| **FLUX.1 Depth [dev]** | Structure-preserving style transfer | Yes | Medium | High |
| **FLUX.1 Canny [pro]** | Sketch-to-image, edge control | Yes | Medium | High |

## Troubleshooting

**"REPLICATE_API_TOKEN is not set"**
- Ensure the environment variable is exported or configured in your MCP client

**"Model requires image_path"**
- Redux, Fill, Depth, and Canny models require an input image
- Provide `image_path` parameter with local file or URL

**Images not downloading**
- Check that `download_path` directory is writable
- Verify you have sufficient disk space

**"NSFW content detected"**
- Replicate's safety filters blocked the content
- Try rephrasing your prompt

## Development

### Running locally

```bash
npm install
export REPLICATE_API_TOKEN="r8_..."
node index.js
```

### Testing with MCP Inspector

```bash
npm install -g @modelcontextprotocol/inspector
mcp-inspector node index.js
```

## Publishing to npm

```bash
npm version patch  # or minor, or major
npm publish
```

## License

MIT

## Credits

- [Replicate](https://replicate.com/) for FLUX model hosting
- [Black Forest Labs](https://blackforestlabs.ai/) for FLUX models
- [Model Context Protocol](https://modelcontextprotocol.io/) for the MCP SDK

#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import Replicate from "replicate";
import { promises as fs } from "fs";
import fsSync from "fs";
import path from "path";
import https from "https";
import http from "http";

// FLUX models configuration
const FLUX_MODELS = {
  "black-forest-labs/flux-1.1-pro-ultra": {
    display: "FLUX1.1 Pro Ultra",
    kind: "text-to-image",
    notes: [
      "Highest quality, up to ~4MP; 'raw' mode for realism.",
      "Use when you need best composition/large output.",
    ],
    inputs: {
      prompt: { required: true, type: "string" },
      raw: { required: false, type: "boolean" },
      aspect_ratio: { required: false, type: "string" },
      seed: { required: false, type: "integer" },
      output_quality: { required: false, type: "number" },
      go_fast: { required: false, type: "boolean" },
    },
    accepts_image: false,
  },
  "black-forest-labs/flux-pro": {
    display: "FLUX1.1 Pro",
    kind: "text-to-image",
    notes: [
      "Fast, reliable, commercial-grade default when Ultra not required.",
    ],
    inputs: {
      prompt: { required: true, type: "string" },
      aspect_ratio: { required: false, type: "string" },
      seed: { required: false, type: "integer" },
    },
    accepts_image: false,
  },
  "black-forest-labs/flux-redux-dev": {
    display: "FLUX.1 Redux [dev]",
    kind: "image-variation",
    notes: [
      "Variations/restyling while preserving key elements; mix image + text.",
    ],
    inputs: {
      image: { required: true, type: "file_or_url" },
      prompt: { required: true, type: "string" },
      strength: { required: false, type: "number" },
      seed: { required: false, type: "integer" },
      num_outputs: { required: false, type: "integer" },
    },
    accepts_image: true,
  },
  "black-forest-labs/flux-fill-pro": {
    display: "FLUX.1 Fill [pro]",
    kind: "inpainting/outpainting",
    notes: ["Professional in/outpainting; provide mask for areas to change."],
    inputs: {
      image: { required: true, type: "file_or_url" },
      mask: { required: false, type: "file_or_url" },
      prompt: { required: true, type: "string" },
      num_inference_steps: { required: false, type: "integer" },
      guidance: { required: false, type: "number" },
      seed: { required: false, type: "integer" },
    },
    accepts_image: true,
  },
  "black-forest-labs/flux-depth-dev": {
    display: "FLUX.1 Depth [dev]",
    kind: "depth-guided editing",
    notes: [
      "Structure-preserving edits/style transfer using depth; supply an image.",
    ],
    inputs: {
      image: { required: true, type: "file_or_url" },
      prompt: { required: true, type: "string" },
      seed: { required: false, type: "integer" },
    },
    accepts_image: true,
  },
  "black-forest-labs/flux-canny-pro": {
    display: "FLUX.1 Canny [pro]",
    kind: "edge-guided generation",
    notes: [
      "Control structure/composition with edges; ideal for sketches/wireframes → detailed images.",
    ],
    inputs: {
      image: { required: true, type: "file_or_url" },
      prompt: { required: true, type: "string" },
      seed: { required: false, type: "integer" },
    },
    accepts_image: true,
  },
};

// Helper function to validate and sanitize download path
function validateDownloadPath(userPath) {
  // Expand ~ to home directory
  const expandedPath = userPath.replace(/^~/, process.env.HOME || "");

  // Resolve to absolute path and normalize
  const absolutePath = path.resolve(expandedPath);

  // Security check: Ensure path doesn't escape to parent directories
  const homePath = process.env.HOME || "";
  const allowedPaths = [
    homePath,
    "/tmp",
    path.join(process.cwd(), "downloads"),
  ];

  // Check if the resolved path is within allowed directories
  const isAllowed = allowedPaths.some(allowedPath => {
    return absolutePath.startsWith(path.resolve(allowedPath));
  });

  if (!isAllowed) {
    throw new Error(`Download path must be within home directory, /tmp, or project downloads folder. Got: ${absolutePath}`);
  }

  return absolutePath;
}

// Helper function to validate URL is from Replicate
function validateReplicateUrl(url) {
  try {
    const parsed = new URL(url);

    // Only allow HTTPS
    if (parsed.protocol !== "https:") {
      throw new Error("Only HTTPS URLs are allowed");
    }

    // Only allow replicate.delivery domain (Replicate's CDN)
    if (!parsed.hostname.endsWith("replicate.delivery")) {
      throw new Error("Only Replicate CDN URLs are allowed");
    }

    return url;
  } catch (error) {
    throw new Error(`Invalid or unsafe URL: ${error.message}`);
  }
}

// Helper function to download file from URL
async function downloadFile(url, filepath) {
  // Validate URL before downloading
  validateReplicateUrl(url);

  return new Promise((resolve, reject) => {
    const file = fsSync.createWriteStream(filepath);

    https
      .get(url, (response) => {
        // Check for redirects to non-Replicate domains
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          try {
            validateReplicateUrl(redirectUrl);
          } catch (error) {
            file.close();
            fsSync.unlink(filepath, () => {});
            reject(new Error("Redirect to unsafe domain detected"));
            return;
          }
        }

        response.pipe(file);
        file.on("finish", () => {
          file.close(resolve);
        });
      })
      .on("error", (err) => {
        fsSync.unlink(filepath, () => {});
        reject(err);
      });
  });
}

// Create MCP server
const server = new Server(
  {
    name: "flux-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "flux_models",
        description: "List supported FLUX models with usage notes and key inputs",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "flux_generate",
        description:
          "Generate an image with a FLUX model via Replicate and save files to download_path",
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "Text prompt describing the image",
            },
            download_path: {
              type: "string",
              description: "Directory to save generated images",
            },
            model: {
              type: "string",
              description: "FLUX model to use",
              enum: Object.keys(FLUX_MODELS),
              default: "black-forest-labs/flux-1.1-pro-ultra",
            },
            image_path: {
              type: "string",
              description: "Local path or URL to input image (for image-accepting models)",
            },
            mask_path: {
              type: "string",
              description: "Local path or URL to mask for inpainting (Fill model)",
            },
            aspect_ratio: {
              type: "string",
              description: "Aspect ratio (e.g., '1:1', '16:9', '3:4')",
            },
            seed: {
              type: "number",
              description: "Random seed for reproducibility",
            },
            raw: {
              type: "boolean",
              description: "Enable raw realism mode (Ultra model)",
            },
            num_outputs: {
              type: "number",
              description: "Number of images to generate",
            },
            output_quality: {
              type: "number",
              description: "Quality setting (model-dependent)",
            },
            go_fast: {
              type: "boolean",
              description: "Speed vs quality tradeoff",
            },
            strength: {
              type: "number",
              description: "Variation strength (Redux model)",
            },
            num_inference_steps: {
              type: "number",
              description: "Inference steps (Fill model)",
            },
            guidance: {
              type: "number",
              description: "Guidance scale (Fill model)",
            },
            output_format: {
              type: "string",
              description: "Output image format (png, jpeg, or webp)",
              enum: ["png", "jpeg", "webp"],
              default: "png",
            },
          },
          required: ["prompt", "download_path"],
        },
      },
    ],
  };
});

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "flux_models") {
    const models = Object.entries(FLUX_MODELS).map(([model, meta]) => ({
      model,
      display: meta.display,
      kind: meta.kind,
      accepts_image: meta.accepts_image,
      notes: meta.notes,
      key_inputs: Object.keys(meta.inputs),
    }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(models, null, 2),
        },
      ],
    };
  }

  if (name === "flux_generate") {
    try {
      const apiToken = process.env.REPLICATE_API_TOKEN;
      if (!apiToken) {
        throw new Error("REPLICATE_API_TOKEN environment variable is not set");
      }

      const replicate = new Replicate({ auth: apiToken });

      const modelId = args.model || "black-forest-labs/flux-1.1-pro-ultra";
      const meta = FLUX_MODELS[modelId];

      if (!meta) {
        throw new Error(`Unknown model: ${modelId}`);
      }

      // Build input
      const input = { prompt: args.prompt };

      // Set output format (default to png for better compatibility)
      const outputFormat = args.output_format || "png";
      input.output_format = outputFormat;

      // Add optional parameters if they exist for this model
      const optionalParams = [
        "aspect_ratio",
        "seed",
        "raw",
        "num_outputs",
        "output_quality",
        "go_fast",
        "strength",
        "num_inference_steps",
        "guidance",
      ];

      for (const param of optionalParams) {
        if (args[param] !== undefined && meta.inputs[param]) {
          input[param] = args[param];
        }
      }

      // Handle image input for models that accept it
      if (meta.accepts_image) {
        if (!args.image_path) {
          throw new Error(`Model ${modelId} requires image_path`);
        }
        // Validate image_path to prevent SSRF
        // Only allow HTTPS URLs or local file paths (Replicate will handle validation)
        if (args.image_path.startsWith("http://")) {
          throw new Error("HTTP URLs not allowed for security reasons. Use HTTPS.");
        }
        input.image = args.image_path;
      }

      // Handle mask for Fill model
      if (modelId.endsWith("/flux-fill-pro") && args.mask_path) {
        // Same validation for mask paths
        if (args.mask_path.startsWith("http://")) {
          throw new Error("HTTP URLs not allowed for security reasons. Use HTTPS.");
        }
        input.mask = args.mask_path;
      }

      // Run the model
      const output = await replicate.run(modelId, { input });

      // Download results - VALIDATE PATH FIRST
      const downloadPath = validateDownloadPath(args.download_path);
      await fs.mkdir(downloadPath, { recursive: true });

      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, 19);
      const baseName = `${meta.display.replace(/[^a-z0-9]/gi, "").toLowerCase()}_${timestamp}`;

      const savedFiles = [];
      const urls = Array.isArray(output) ? output : [output];

      for (let i = 0; i < urls.length; i++) {
        const urlObj = urls[i];
        // Convert to string if it's a URL object
        const url = typeof urlObj === 'string' ? urlObj : String(urlObj);

        // Use the requested output format for file extension
        const ext = outputFormat === "jpeg" ? ".jpg" : `.${outputFormat}`;
        const filepath = path.join(downloadPath, `${baseName}_${i + 1}${ext}`);

        await downloadFile(url, filepath);
        savedFiles.push(filepath);
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                model: modelId,
                saved: savedFiles,
                urls: urls,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      // Sanitize error message to avoid leaking sensitive information
      let safeMessage = "An error occurred while generating the image.";

      // Only expose safe, user-actionable error messages
      if (error.message.includes("REPLICATE_API_TOKEN")) {
        safeMessage = "API token is not configured. Please set REPLICATE_API_TOKEN.";
      } else if (error.message.includes("Unknown model")) {
        safeMessage = error.message; // Safe to expose model validation errors
      } else if (error.message.includes("requires image_path")) {
        safeMessage = error.message; // Safe to expose parameter validation errors
      } else if (error.message.includes("Download path must be")) {
        safeMessage = "Invalid download path. Path must be within home directory or /tmp.";
      } else if (error.message.includes("HTTP URLs not allowed")) {
        safeMessage = "Only HTTPS URLs are allowed for security reasons.";
      } else if (error.message.includes("NSFW")) {
        safeMessage = "Content was flagged by safety filters. Please try a different prompt.";
      } else if (error.message.includes("Only Replicate CDN")) {
        safeMessage = "Invalid image source. Only Replicate CDN URLs are allowed.";
      }

      // Log full error server-side for debugging (not sent to client)
      console.error("FLUX MCP Error:", error);

      return {
        content: [
          {
            type: "text",
            text: `Error: ${safeMessage}`,
          },
        ],
        isError: true,
      };
    }
  }

  throw new Error(`Unknown tool: ${name}`);
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("FLUX MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

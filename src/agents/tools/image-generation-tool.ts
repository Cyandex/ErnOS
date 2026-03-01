/**
 * Image Generation Tool — ported from V3 tools/system/creative.py generate_image
 *
 * Generates images via OpenAI's DALL-E API. Falls back to
 * other providers if configured.
 */

import * as fs from "fs";
import * as path from "path";
import { artifactRegistry } from "../../memory/artifact-registry.js";

export interface ImageGenerationResult {
  success: boolean;
  path?: string;
  url?: string;
  error?: string;
  provider: string;
}

/**
 * Generates an image using OpenAI's DALL-E API.
 *
 * Requires OPENAI_API_KEY in the environment.
 * Saves the resulting image to the documents directory.
 */
export async function generateImage(params: {
  prompt: string;
  size?: "1024x1024" | "1024x1792" | "1792x1024";
  quality?: "standard" | "hd";
  model?: string;
  outputDir?: string;
}): Promise<ImageGenerationResult> {
  const { prompt, size = "1024x1024", quality = "standard", model = "dall-e-3" } = params;
  const outputDir = params.outputDir || path.join(process.cwd(), "memory", "images");

  const localApiUrl = process.env.LOCAL_IMAGE_API_URL;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey && !localApiUrl) {
    return {
      success: false,
      error: "No OPENAI_API_KEY or LOCAL_IMAGE_API_URL configured. Image generation requires either OpenAI API key or a local API URL.",
      provider: "none",
    };
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = Date.now();
  const sanitizedPrompt = prompt.slice(0, 40).replace(/[^a-zA-Z0-9]/g, "_");
  const filename = `generated_${sanitizedPrompt}_${timestamp}.png`;
  const outputPath = path.join(outputDir, filename);

  if (localApiUrl) {
    console.log(`[ImageGen] Generating via Local API: "${prompt.slice(0, 80)}..."`);
    try {
      const width = size.startsWith("1792") ? 1792 : 1024;
      const height = size.endsWith("1792") ? 1792 : 1024;
      
      const response = await fetch(localApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          width,
          height,
        }),
      });

      if (!response.ok) {
        return { success: false, error: `Local API error (${response.status}): ${await response.text()}`, provider: "local" };
      }

      const data = (await response.json()) as { images?: string[] };
      if (!data.images?.[0]) {
        return { success: false, error: "No image data returned from Local API.", provider: "local" };
      }

      const buffer = Buffer.from(data.images[0], "base64");
      fs.writeFileSync(outputPath, buffer);
      artifactRegistry.registerArtifact(buffer, { type: "image", prompt, path: outputPath });
      console.log(`[ImageGen] ✅ Image saved: ${outputPath}`);

      return { success: true, path: outputPath, provider: "local" };
    } catch (error) {
      return { success: false, error: `Local image generation failed: ${error}`, provider: "local" };
    }
  }

  console.log(`[ImageGen] Generating via OpenAI: "${prompt.slice(0, 80)}..." (${model}, ${size}, ${quality})`);

  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt,
        n: 1,
        size,
        quality,
        response_format: "b64_json",
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return {
        success: false,
        error: `OpenAI API error (${response.status}): ${errorBody}`,
        provider: "openai",
      };
    }

    // Save to disk (directory already exists)
    const data = (await response.json()) as {
      data: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>;
    };

    if (!data.data?.[0]) {
      return { success: false, error: "No image data returned from API.", provider: "openai" };
    }

    const imageData = data.data[0];

    if (imageData.b64_json) {
      const buffer = Buffer.from(imageData.b64_json, "base64");
      fs.writeFileSync(outputPath, buffer);
      artifactRegistry.registerArtifact(buffer, { type: "image", prompt, path: outputPath });
    } else if (imageData.url) {
      // Download from URL
      const imgResponse = await fetch(imageData.url);
      const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
      fs.writeFileSync(outputPath, imgBuffer);
      artifactRegistry.registerArtifact(imgBuffer, { type: "image", prompt, path: outputPath });
    }

    console.log(`[ImageGen] ✅ Image saved: ${outputPath}`);

    return {
      success: true,
      path: outputPath,
      url: imageData.url,
      provider: "openai",
    };
  } catch (error) {
    return {
      success: false,
      error: `Image generation failed: ${error}`,
      provider: "openai",
    };
  }
}

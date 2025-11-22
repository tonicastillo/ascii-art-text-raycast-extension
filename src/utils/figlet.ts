import figlet from "figlet/browser";
import fs from "fs";
import path from "path";
import { environment } from "@raycast/api";

export const getFonts = async (): Promise<string[]> => {
  if (!environment.assetsPath) {
    console.error("environment.assetsPath is undefined");
    return [];
  }
  const fontsDir = path.join(environment.assetsPath, "fonts");

  try {
    const files = await fs.promises.readdir(fontsDir);
    return files.filter((f) => f.endsWith(".flf")).map((f) => f.replace(".flf", ""));
  } catch (e) {
    console.error("Error reading fonts directory:", e);
    return [];
  }
};

export const renderText = async (text: string, font: string): Promise<string> => {
  if (!environment.assetsPath) {
    throw new Error("environment.assetsPath is undefined");
  }
  const fontsDir = path.join(environment.assetsPath, "fonts");
  const fontPath = path.join(fontsDir, `${font}.flf`);

  try {
    // We read and parse the font manually to ensure it's loaded from our assets
    const fontContent = await fs.promises.readFile(fontPath, "utf8");
    figlet.parseFont(font, fontContent);

    return new Promise((resolve, reject) => {
      figlet.text(text, { font: font as any }, (err: Error | null, result?: string) => {
        if (err) {
          reject(err);
        } else {
          resolve(result || "");
        }
      });
    });
  } catch (e) {
    throw new Error(`Failed to load font ${font}: ${e}`);
  }
};

export const textToSvg = (text: string): { light: string; dark: string } => {
  // Escape special characters for XML
  const escapedText = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

  // Calculate dimensions (approximate)
  const lines = text.split("\n");
  const width = Math.max(...lines.map((line) => line.length)) * 10 + 20; // approx char width + padding
  const height = lines.length * 18 + 20; // approx line height + padding

  const createSvg = (color: string) =>
    `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>
    text {
      font-family: monospace;
      font-size: 14px;
      white-space: pre;
      fill: ${color};
    }
  </style>
  <text x="10" y="20">${escapedText}</text>
</svg>
  `.trim();

  const toBase64 = (str: string) => `data:image/svg+xml;base64,${Buffer.from(str).toString("base64")}`;

  return {
    light: toBase64(createSvg("#000000")),
    dark: toBase64(createSvg("#FFFFFF")),
  };
};

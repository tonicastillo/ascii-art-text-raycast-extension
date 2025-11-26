/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const figlet = require("figlet");

const fontsDir = path.join(__dirname, "assets", "fonts");
const outputHtmlPath = path.join(__dirname, "fonts_preview.html");

const generateHtml = async () => {
  try {
    const files = await fs.promises.readdir(fontsDir);
    const fontFiles = files.filter((f) => f.endsWith(".flf"));

    let htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Font Preview</title>
      <style>
        body { font-family: sans-serif; padding: 20px; background: #f0f0f0; }
        .font-card { background: white; padding: 20px; margin-bottom: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .font-name { font-weight: bold; margin-bottom: 10px; color: #333; }
        .font-preview { font-family: monospace; white-space: pre; overflow-x: auto; background: #222; color: #0f0; padding: 10px; border-radius: 4px; }
      </style>
    </head>
    <body>
      <h1>ASCII Art Font Previews</h1>
      <p>Total Fonts: ${fontFiles.length}</p>
    `;

    for (const file of fontFiles) {
      const fontName = file.replace(".flf", "");
      const fontPath = path.join(fontsDir, file);
      const fontContent = await fs.promises.readFile(fontPath, "utf8");

      // Parse the font so figlet knows about it
      figlet.parseFont(fontName, fontContent);

      // Render text
      const text = await new Promise((resolve) => {
        figlet.text("ASCII Art", { font: fontName }, (err, data) => {
          if (err) {
            console.error(`Error rendering font ${fontName}:`, err);
            resolve(`Error rendering font: ${err.message}`);
          } else {
            resolve(data);
          }
        });
      });

      htmlContent += `
      <div class="font-card">
        <div class="font-name">${fontName}</div>
        <div class="font-preview">${text}</div>
      </div>
      `;

      console.log(`Processed ${fontName}`);
    }

    htmlContent += `
    </body>
    </html>
    `;

    await fs.promises.writeFile(outputHtmlPath, htmlContent);
    console.log(`HTML generated at ${outputHtmlPath}`);
  } catch (err) {
    console.error("Error generating HTML:", err);
  }
};

generateHtml();

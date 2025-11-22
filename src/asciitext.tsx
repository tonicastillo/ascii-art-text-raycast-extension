import { Action, ActionPanel, Grid, showToast, Toast, getPreferenceValues, Cache } from "@raycast/api";
import { useState, useEffect, useMemo, useCallback } from "react";
import { getFonts, renderText, textToSvg } from "./utils/figlet";


const cache = new Cache();

type CommentStyle = "none" | "slash" | "hash" | "block" | "html";

const COMMENT_STYLES: { [key in CommentStyle]: { label: string; prefix: string; suffix: string } } = {
  none: { label: "No Comment", prefix: "", suffix: "" },
  slash: { label: "// (JS, C++, etc.)", prefix: "// ", suffix: "" },
  hash: { label: "# (Bash, Py, etc.)", prefix: "# ", suffix: "" },
  block: { label: "/* */ (CSS, JS)", prefix: "/*\n", suffix: "\n*/" },
  html: { label: "<!-- --> (HTML)", prefix: "<!--\n", suffix: "\n-->" },
};

export default function Command() {
  const [searchText, setSearchText] = useState("");
  const [fonts, setFonts] = useState<string[]>([]);
  const [previews, setPreviews] = useState<{ [key: string]: { light: string; dark: string; raw: string } }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [commentStyle, setCommentStyle] = useState<CommentStyle>("none");

  // Load fonts on mount
  useEffect(() => {
    async function loadFonts() {
      try {
        const loadedFonts = await getFonts();
        setFonts(loadedFonts);
        
        // Load last used comment style
        const cachedStyle = cache.get("commentStyle");
        if (cachedStyle && cachedStyle in COMMENT_STYLES) {
          setCommentStyle(cachedStyle as CommentStyle);
        }
      } catch (error) {
        showToast({
          style: Toast.Style.Failure,
          title: "Failed to load fonts",
          message: String(error),
        });
      } finally {
        setIsLoading(false);
      }
    }
    loadFonts();
  }, []);

  // Save comment style when changed
  const handleCommentStyleChange = (newValue: string) => {
    const style = newValue as CommentStyle;
    setCommentStyle(style);
    cache.set("commentStyle", style);
  };

  // Debounced preview generation
  useEffect(() => {
    let isCancelled = false;
    const textToRender = searchText.trim() || "Sample";

    const generatePreviews = async () => {
      setIsLoading(true);
      const newPreviews: { [key: string]: { light: string; dark: string; raw: string } } = {};
      
      // Process in chunks to avoid blocking UI
      const chunkSize = 20;
      for (let i = 0; i < fonts.length; i += chunkSize) {
        if (isCancelled) return;
        
        const chunk = fonts.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map(async (font) => {
            try {
              const text = await renderText(textToRender, font);
              newPreviews[font] = { ...textToSvg(text), raw: text };
            } catch (e) {
              console.error(`Failed to render font ${font}`, e);
            }
          })
        );
        
        // Update state incrementally
        setPreviews((prev) => ({ ...prev, ...newPreviews }));
        // Small delay to yield to main thread
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      setIsLoading(false);
    };

    const timeoutId = setTimeout(generatePreviews, 500);
    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [searchText, fonts]);

  const getFinalText = useCallback((font: string) => {
    const ascii = previews[font]?.raw || "";
    const style = COMMENT_STYLES[commentStyle];
    
    if (style.prefix || style.suffix) {
      // Apply comment to each line if it's a line comment, or wrap if block
      if (commentStyle === "slash" || commentStyle === "hash") {
        return ascii.split("\n").map(line => `${style.prefix}${line}`).join("\n");
      } else {
        return `${style.prefix}${ascii}${style.suffix}`;
      }
    }
    return ascii;
  }, [previews, commentStyle]);

  return (
    <Grid
      isLoading={isLoading}
      searchBarPlaceholder="Enter text to convert..."
      onSearchTextChange={setSearchText}
      throttle
      searchBarAccessory={
        <Grid.Dropdown
          tooltip="Comment Style"
          storeValue={false}
          value={commentStyle}
          onChange={handleCommentStyleChange}
        >
          {Object.entries(COMMENT_STYLES).map(([key, value]) => (
            <Grid.Dropdown.Item key={key} value={key} title={value.label} />
          ))}
        </Grid.Dropdown>
      }
    >
      {fonts.map((font) => (
        <Grid.Item
          key={font}
          content={{
            source: previews[font] || { light: "", dark: "" },
          }}
          title={font}
          actions={
            <ActionPanel>
              <Action.CopyToClipboard
                title="Copy to Clipboard"
                content={getFinalText(font)}
              />
              <Action.Paste
                title="Paste to Active App"
                content={getFinalText(font)}
              />
            </ActionPanel>
          }
        />
      ))}
    </Grid>
  );
}

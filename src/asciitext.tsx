import { Action, ActionPanel, Grid, showToast, Toast, Cache, LocalStorage, Icon } from "@raycast/api";
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
  const [pinnedFonts, setPinnedFonts] = useState<string[]>([]);
  const [previews, setPreviews] = useState<{ [key: string]: { light: string; dark: string; raw: string } }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [commentStyle, setCommentStyle] = useState<CommentStyle>("none");

  // Load fonts and pinned state on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [loadedFonts, storedPinned] = await Promise.all([
          getFonts(),
          LocalStorage.getItem<string>("pinnedFonts"),
        ]);

        setFonts(loadedFonts);
        if (storedPinned) {
          try {
            setPinnedFonts(JSON.parse(storedPinned));
          } catch (e) {
            console.error("Failed to parse pinned fonts", e);
          }
        }

        // Load last used comment style
        const cachedStyle = cache.get("commentStyle");
        if (cachedStyle && cachedStyle in COMMENT_STYLES) {
          setCommentStyle(cachedStyle as CommentStyle);
        }
      } catch (error) {
        showToast({
          style: Toast.Style.Failure,
          title: "Failed to load data",
          message: String(error),
        });
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // Save comment style when changed
  const handleCommentStyleChange = (newValue: string) => {
    const style = newValue as CommentStyle;
    setCommentStyle(style);
    cache.set("commentStyle", style);
  };

  const togglePin = async (font: string) => {
    const newPinned = pinnedFonts.includes(font) ? pinnedFonts.filter((f) => f !== font) : [...pinnedFonts, font];

    setPinnedFonts(newPinned);
    await LocalStorage.setItem("pinnedFonts", JSON.stringify(newPinned));
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

      // Prioritize pinned fonts for rendering
      const sortedForRendering = [
        ...pinnedFonts.filter((f) => fonts.includes(f)),
        ...fonts.filter((f) => !pinnedFonts.includes(f)),
      ];

      for (let i = 0; i < sortedForRendering.length; i += chunkSize) {
        if (isCancelled) return;

        const chunk = sortedForRendering.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map(async (font) => {
            // Skip if already rendered for this text (optimization)
            // Note: We can't easily check if it matches current text without storing text with preview
            // For now, we just re-render.
            try {
              const text = await renderText(textToRender, font);
              newPreviews[font] = { ...textToSvg(text), raw: text };
            } catch (e) {
              console.error(`Failed to render font ${font}`, e);
            }
          }),
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
  }, [searchText, fonts, pinnedFonts]);

  const getFinalText = useCallback(
    (font: string) => {
      const ascii = previews[font]?.raw || "";
      const style = COMMENT_STYLES[commentStyle];

      if (style.prefix || style.suffix) {
        // Apply comment to each line if it's a line comment, or wrap if block
        if (commentStyle === "slash" || commentStyle === "hash") {
          return ascii
            .split("\n")
            .map((line) => `${style.prefix}${line}`)
            .join("\n");
        } else {
          return `${style.prefix}${ascii}${style.suffix}`;
        }
      }
      return ascii;
    },
    [previews, commentStyle],
  );

  const sortedFonts = useMemo(() => {
    return [...pinnedFonts.filter((f) => fonts.includes(f)), ...fonts.filter((f) => !pinnedFonts.includes(f))];
  }, [fonts, pinnedFonts]);

  return (
    <Grid
      columns={2}
      aspectRatio="16/9"
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
      <Grid.Section title="Select a font">
        {sortedFonts.map((font) => {
          const isPinned = pinnedFonts.includes(font);
          return (
            <Grid.Item
              key={font}
              content={{
                source: previews[font] || { light: "", dark: "" },
              }}
              title={font}
              accessory={isPinned ? { icon: Icon.Pin } : undefined}
              actions={
                <ActionPanel>
                  <Action.CopyToClipboard title="Copy to Clipboard" content={getFinalText(font)} />
                  <Action.Paste title="Paste to Active App" content={getFinalText(font)} />
                  <Action
                    title={isPinned ? "Unpin Font" : "Pin Font"}
                    icon={isPinned ? Icon.PinDisabled : Icon.Pin}
                    shortcut={{ modifiers: ["cmd", "shift"], key: "p" }}
                    onAction={() => togglePin(font)}
                  />
                </ActionPanel>
              }
            />
          );
        })}
      </Grid.Section>
    </Grid>
  );
}

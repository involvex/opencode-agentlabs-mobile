import { useMemo, type ReactNode, Component, ErrorInfo, Children } from "react";
import {
  View,
  Text,
  useColorScheme,
  Platform,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import { useMarkdown, Renderer } from "react-native-marked";
import { CodeBlock } from "./CodeBlock";
import { log } from "../../lib/logbuffer";
import { useDensity, ds } from "../../lib/density";

// react-native-marked's base Renderer hardcodes `selectable` on every plain
// text node it produces (text/strong/em/del/heading/codespan). On Android,
// selectable <Text> nested inside a FlatList row has a long-standing,
// still-unresolved RN bug (facebook/react-native#46999, a reopened
// regression of #28952's fix) where the underlying view's selectable state
// — and, per our own diff-scroll flow (issue #104), its exposure to the
// accessibility tree Maestro/UiAutomator reads from — never gets applied
// correctly. Chat messages here are rendered as rows of the session screen's
// own FlatList (app/session/[id].tsx), so every markdown text node hits
// this. Code content is still copyable via CodeBlock's explicit Copy
// button, so dropping `selectable` on plain text costs little.
class CustomRenderer extends Renderer {
  private plainText(
    children: string | ReactNode[],
    styles?: StyleProp<TextStyle>,
  ): ReactNode {
    return (
      <Text key={this.getKey()} style={styles}>
        {children}
      </Text>
    );
  }

  code(
    text: string,
    language?: string,
    containerStyle?: ViewStyle,
    _textStyle?: TextStyle,
  ) {
    return (
      <View key={this.getKey()} style={containerStyle}>
        <CodeBlock code={text} language={language} />
      </View>
    );
  }

  text(text: string | ReactNode[], styles?: TextStyle): ReactNode {
    return this.plainText(text, styles);
  }

  strong(children: string | ReactNode[], styles?: TextStyle): ReactNode {
    return this.plainText(children, styles);
  }

  em(children: string | ReactNode[], styles?: TextStyle): ReactNode {
    return this.plainText(children, styles);
  }

  del(children: string | ReactNode[], styles?: TextStyle): ReactNode {
    return this.plainText(children, styles);
  }

  heading(text: string | ReactNode[], styles?: TextStyle): ReactNode {
    return this.plainText(text, styles);
  }

  codespan(text: string, styles?: TextStyle): ReactNode {
    return this.plainText(text, [
      styles,
      { fontStyle: "normal", fontWeight: "normal" },
    ]);
  }

  html(_text: string | ReactNode[], _styles?: TextStyle): ReactNode {
    return null;
  }

  // Base Renderer.table() returns <MDTable> WITHOUT a key (upstream bug),
  // and MDTable itself renders its header TableWrapper without a key — both
  // trigger "Each child in a list should have a unique key" warnings from the
  // View that hosts useMarkdown's top-level array. Render tables ourselves
  // with deterministic keys instead of delegating to MDTable.
  table(
    header: ReactNode[][],
    rows: ReactNode[][][],
    tableStyle?: ViewStyle,
    rowStyle?: ViewStyle,
    cellStyle?: ViewStyle,
  ): ReactNode {
    const key = this.getKey();
    return (
      <View key={key} style={tableStyle}>
        <View key={`${key}-header`} style={rowStyle}>
          {header.map((col) => {
            const ck = this.getKey();
            return (
              <View key={ck} style={cellStyle}>
                {col as ReactNode}
              </View>
            );
          })}
        </View>
        {rows.map((row) => {
          const rk = this.getKey();
          return (
            <View key={rk} style={rowStyle}>
              {row.map((cell) => {
                const ck = this.getKey();
                return (
                  <View key={ck} style={cellStyle}>
                    {cell as ReactNode}
                  </View>
                );
              })}
            </View>
          );
        })}
      </View>
    );
  }
}

const mono = Platform.OS === "ios" ? "Menlo" : "monospace";

const lightTheme = {
  text: { color: "#0a0a0a", fontSize: 15, lineHeight: 22 },
  paragraph: { marginTop: 0, marginBottom: 8 },
  h1: {
    fontSize: 22,
    fontWeight: "700" as const,
    color: "#0a0a0a",
    marginBottom: 8,
    marginTop: 12,
  },
  h2: {
    fontSize: 19,
    fontWeight: "600" as const,
    color: "#0a0a0a",
    marginBottom: 6,
    marginTop: 10,
  },
  h3: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#0a0a0a",
    marginBottom: 4,
    marginTop: 8,
  },
  link: { color: "#8b5cf6" },
  blockquote: {
    backgroundColor: "transparent",
    borderLeftWidth: 3,
    borderLeftColor: "#d1d5db",
    paddingLeft: 12,
    paddingVertical: 2,
    marginVertical: 4,
  },
  code: {
    backgroundColor: "#e8e5f0",
    color: "#6d28d9",
    fontFamily: mono,
    fontSize: 13,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  codespan: {
    backgroundColor: "#e8e5f0",
    color: "#6d28d9",
    fontFamily: mono,
    fontSize: 13,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  list: { marginBottom: 4 },
  li: { marginBottom: 2 },
  hr: { backgroundColor: "#e5e5e5", height: 1, marginVertical: 12 },
  strong: { fontWeight: "700" as const },
  em: { fontStyle: "italic" as const },
  strikethrough: { textDecorationLine: "line-through" as const },
  image: { borderRadius: 8 },
};

const darkTheme = {
  ...lightTheme,
  text: { ...lightTheme.text, color: "#e5e5e5" },
  h1: { ...lightTheme.h1, color: "#ffffff" },
  h2: { ...lightTheme.h2, color: "#ffffff" },
  h3: { ...lightTheme.h3, color: "#ffffff" },
  link: { color: "#a78bfa" },
  blockquote: {
    ...lightTheme.blockquote,
    borderLeftColor: "#4a4a5a",
  },
  code: {
    ...lightTheme.code,
    backgroundColor: "#2a2040",
    color: "#c4b5fd",
  },
  codespan: {
    ...lightTheme.codespan,
    backgroundColor: "#2a2040",
    color: "#c4b5fd",
  },
  hr: { ...lightTheme.hr, backgroundColor: "#2a2a2a" },
};

interface MarkdownContentProps {
  children: string;
  renderer: Renderer;
  theme: typeof lightTheme;
  isDark: boolean;
}

function MarkdownContent({
  children,
  renderer,
  theme,
  isDark,
}: MarkdownContentProps) {
  const density = useDensity();
  const safe = typeof children === "string" ? children : "";
  const dTheme = useMemo(
    () => ({
      ...theme,
      text: ds({ fontSize: 15, lineHeight: 22 }, density),
      h1: ds({ ...theme.h1, fontSize: 22 }, density),
      h2: ds({ ...theme.h2, fontSize: 19 }, density),
      h3: ds({ ...theme.h3, fontSize: 16 }, density),
      blockquote: ds({ ...theme.blockquote, paddingLeft: 12 }, density),
      code: ds(
        {
          ...theme.code,
          fontSize: 13,
          paddingHorizontal: 5,
          paddingVertical: 2,
        },
        density,
      ),
      codespan: ds(
        {
          ...theme.codespan,
          fontSize: 13,
          paddingHorizontal: 4,
          paddingVertical: 1,
        },
        density,
      ),
      hr: ds({ ...theme.hr, marginVertical: 12 }, density),
    }),
    [theme, density],
  );

  const elements = useMarkdown(safe, {
    renderer,
    styles: dTheme,
    colorScheme: isDark ? "dark" : "light",
  });

  // Children.toArray assigns fallback keys to any key-less top-level node
  // (e.g. upstream renderers that forget getKey()), silencing the "unique
  // key" warning from the hosting View while preserving existing keys.
  return (
    <View style={{ backgroundColor: "transparent" }}>
      {Children.toArray(elements)}
    </View>
  );
}

class MarkdownErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    log.error("markdown", "useMarkdown crashed", error.message);
  }

  render() {
    const { error } = this.state;
    const { children } = this.props;

    if (error) {
      return null;
    }

    return <>{children}</>;
  }
}

interface Props {
  children: string;
}

export function Markdown({ children }: Props) {
  const isDark = useColorScheme() === "dark";
  const theme = isDark ? darkTheme : lightTheme;

  // A module-scope singleton renderer would share one CustomRenderer (and
  // its underlying github-slugger) across every Markdown instance and every
  // streamed token forever. github-slugger never resets, so its heading-slug
  // keys only ever climb — which fed into useMarkdown's memoized parser and
  // made the emitted React keys change on every token, remounting the whole
  // subtree (resetting code-block scroll position, flashing content). Tying
  // the instance lifetime to `children` (referenced below so exhaustive-deps
  // sees the dependency as used) resets the slugger per parse, so keys are
  // deterministic (and stable) for a given value, while re-renders with an
  // unchanged value reuse the same renderer.
  const renderer = useMemo(() => {
    void children;
    return new CustomRenderer();
  }, [children]);

  // Defensive: React can pass non-string children at runtime despite TS types.
  // useMarkdown crashes on non-string input, so bail early.
  if (typeof children !== "string" || !children.trim()) return null;

  return (
    <MarkdownErrorBoundary>
      <MarkdownContent renderer={renderer} theme={theme} isDark={isDark}>
        {children}
      </MarkdownContent>
    </MarkdownErrorBoundary>
  );
}

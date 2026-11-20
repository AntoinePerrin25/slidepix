import { bibliographyBody, expandCitationMarkers, formatPageLabel, manimScriptFileLabel, renderMarkdown, roundedEdgeFadeMask, type Citation, type Deck, type MediaStorage, type Slide, type SlideElement } from "@slidepix/core";
import { useEffect, useState, type CSSProperties, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";

type Props = {
  deck: Deck;
  slide: Slide;
  scale?: number;
  interactive?: boolean;
  selectedElementIds?: string[];
  editingElementId?: string;
  resolveAsset?: (source: string, storage: MediaStorage) => string;
  citations?: readonly Citation[];
  onChromeGeometry?: (kind: ChromeKind, box: ChromeBox) => void;
  onChromeCommit?: () => void;
  onSelectElement?: (id?: string, additive?: boolean) => void;
  onEditText?: (id: string) => void;
  onEditImage?: (id: string) => void;
};

export function SlideView({
  deck,
  slide,
  scale = 1,
  interactive = false,
  selectedElementIds = [],
  editingElementId,
  resolveAsset = (value) => value,
  citations = [],
  onChromeGeometry,
  onChromeCommit,
  onSelectElement,
  onEditText,
  onEditImage
}: Props) {
  const background = slide.background ?? deck.layouts[slide.layout ?? ""]?.background ?? deck.theme.background;
  const backgroundImage = slide.backgroundImage ? `url("${resolveAsset(slide.backgroundImage.src, slide.backgroundImage.storage)}")` : undefined;
  const visibleSlides = deck.slides.filter((item) => !item.hidden);
  const pageIndex = visibleSlides.findIndex((item) => item.id === slide.id);
  const stop = (event: MouseEvent, id: string) => {
    if (!interactive) return;
    event.stopPropagation();
    onSelectElement?.(id, event.shiftKey);
  };
  return (
    <div
      className="slide"
      data-slide-id={slide.id}
      style={{ width: deck.size.width, height: deck.size.height, backgroundColor: background, backgroundImage, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat", transform: `scale(${scale})` }}
      onMouseDown={() => interactive && onSelectElement?.()}
    >
      {[...slide.elements].sort((a, b) => a.z - b.z).map((element) => (
        <ElementView
          key={element.id}
          element={element}
          citations={citations}
          citationFormat={deck.bibliography.citationFormat}
          indent={deck.bibliography.indent}
          interactive={interactive}
          selected={selectedElementIds.includes(element.id)}
          editing={editingElementId === element.id}
          resolveAsset={resolveAsset}
          onMouseDown={(event) => stop(event, element.id)}
          onDoubleClick={() => {
            if (element.type === "text") onEditText?.(element.id);
            if (element.type === "image") onEditImage?.(element.id);
          }}
        />
      ))}
      <SlideChrome deck={deck} slide={slide} pageIndex={pageIndex} total={visibleSlides.length} citations={citations} interactive={interactive} onChromeGeometry={onChromeGeometry} onChromeCommit={onChromeCommit} />
    </div>
  );
}

function ElementView({
  element,
  citations,
  citationFormat,
  indent,
  interactive,
  selected,
  editing,
  resolveAsset,
  onMouseDown,
  onDoubleClick
}: {
  element: SlideElement;
  citations: readonly Citation[];
  citationFormat: string;
  indent: number;
  interactive: boolean;
  selected: boolean;
  editing: boolean;
  resolveAsset: (source: string, storage: MediaStorage) => string;
  onMouseDown: (event: MouseEvent) => void;
  onDoubleClick: () => void;
}) {
  if (element.hidden) return null;
  const style: CSSProperties = {
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    transform: `rotate(${element.rotation}deg)`,
    opacity: element.opacity,
    zIndex: element.z,
    pointerEvents: element.locked ? "none" : undefined
  };
  return (
    <div
      id={interactive ? `element-${element.id}` : undefined}
      className={`slide-element ${selected ? "selected" : ""} ${editing ? "editing" : ""}`}
      title={interactive && element.type === "text" ? "Double-click to edit text" : undefined}
      data-element-id={element.id}
      style={style}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
    >
      {element.type === "text" && (
        <div
          className={`slidepix-text-content valign-${element.style.verticalAlign}`}
          style={{
            fontFamily: element.style.fontFamily,
            fontSize: element.style.fontSize,
            fontWeight: element.style.fontWeight,
            color: element.style.color,
            textAlign: element.style.textAlign,
            lineHeight: element.style.lineHeight,
            padding: element.style.padding
          }}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(expandCitationMarkers(element.markdown, citations, citationFormat, indent)) }}
        />
      )}
      {element.type === "image" && <ImageView element={element} src={resolveAsset(element.src, element.storage)} />}
      {element.type === "video" && (
        <video
          src={resolveAsset(element.src, element.storage)}
          poster={element.poster ? resolveAsset(element.poster, "embedded") : undefined}
          autoPlay={interactive && element.playback.mode === "autoplay"}
          muted={element.playback.muted}
          loop={element.playback.loop}
          controls={interactive && element.playback.controls}
          style={{ borderRadius: element.borderRadius }}
        />
      )}
      {element.type === "manim" && <ManimView element={element} interactive={interactive} resolveAsset={resolveAsset} />}
      {element.type === "shape" && (
        <div
          className="shape-content"
          style={{
            background: element.fill,
            border: `${element.strokeWidth}px solid ${element.stroke}`,
            borderRadius: element.shape === "ellipse" ? "50%" : element.borderRadius,
            clipPath: element.shape === "triangle" ? "polygon(50% 0, 100% 100%, 0 100%)" : undefined,
            filter: element.shadow.enabled ? `drop-shadow(${element.shadow.offsetX}px ${element.shadow.offsetY}px ${element.shadow.blur}px ${element.shadow.color})` : undefined
          }}
        />
      )}
      {element.type === "table" && (
        <table
          className="slidepix-table-content"
          style={{
            fontFamily: element.style.fontFamily,
            fontSize: element.style.fontSize,
            fontWeight: element.style.fontWeight,
            color: element.style.color
          }}
        >
          <tbody>
            {Array.from({ length: element.rows }, (_, row) => {
              const Cell = element.headerRow && row === 0 ? "th" : "td";
              return <tr key={row}>{Array.from({ length: element.columns }, (_, column) => (
                <Cell
                  key={column}
                  style={{
                    background: row === 0 && element.headerRow ? element.style.headerFill : element.style.cellFill,
                    border: `${element.style.borderWidth}px solid ${element.style.borderColor}`,
                    padding: element.style.padding,
                    textAlign: row === 0 && element.headerRow ? "center" : element.style.textAlign
                  }}
                >
                  <div
                    className="slidepix-table-cell"
                    style={{ justifyContent: element.style.verticalAlign === "middle" ? "center" : element.style.verticalAlign === "bottom" ? "flex-end" : "flex-start" }}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(expandCitationMarkers(element.cells[row]?.[column] ?? "", citations, citationFormat, indent)) }}
                  />
                </Cell>
              ))}</tr>;
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ManimView({
  element,
  interactive,
  resolveAsset
}: {
  element: Extract<SlideElement, { type: "manim" }>;
  interactive: boolean;
  resolveAsset: (source: string, storage: MediaStorage) => string;
}) {
  const [mediaFailed, setMediaFailed] = useState(false);
  const media = element.outputMedia;
  const mediaSrc = media?.src ? resolveAsset(media.src, media.storage) : "";

  useEffect(() => {
    setMediaFailed(false);
  }, [mediaSrc, media?.storage, media?.src, element.script, element.output]);

  if (!media?.src || mediaFailed) {
    return (
      <div className="manim-frame">
        <div className="manim-placeholder" aria-label="Manim script preview">
          <span className="manim-placeholder-label">{manimScriptFileLabel(element.script)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="manim-frame">
      {element.output === "image" ? (
        <img
          className="manim-output"
          src={mediaSrc}
          alt={element.alt ?? element.scene ?? "Manim"}
          onError={() => setMediaFailed(true)}
        />
      ) : (
        <video
          className="manim-output"
          src={mediaSrc}
          preload="metadata"
          autoPlay={interactive && element.playback.mode === "autoplay"}
          muted={element.playback.muted}
          loop={element.playback.loop}
          controls={interactive && element.playback.controls}
          onError={() => setMediaFailed(true)}
        />
      )}
    </div>
  );
}

function ImageView({ element, src }: { element: Extract<SlideElement, { type: "image" }>; src: string }) {
  const crop = element.crop;
  const fade = roundedEdgeFadeMask(element.width, element.height, element.borderRadius, element.edgeFade);
  return (
    <div
      className="image-clip"
      style={{
        borderRadius: element.borderRadius,
        border: `${element.border.width}px solid ${element.border.color}`,
        WebkitMaskImage: fade,
        maskImage: fade,
        WebkitMaskSize: "100% 100%",
        maskSize: "100% 100%",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat"
      } as CSSProperties}
    >
      <img
        src={src}
        alt={element.alt ?? ""}
        style={{
          width: `${100 / crop.width}%`,
          height: `${100 / crop.height}%`,
          left: `${-(crop.x / crop.width) * 100}%`,
          top: `${-(crop.y / crop.height) * 100}%`
        }}
      />
    </div>
  );
}

export type ChromeKind = "header" | "footer" | "bibliography" | "citations";
export type ChromeBox = { x: number; y: number; width: number; height: number };

function SlideChrome({ deck, slide, pageIndex, total, citations, interactive, onChromeGeometry, onChromeCommit }: { deck: Deck; slide: Slide; pageIndex: number; total: number; citations: readonly Citation[]; interactive: boolean; onChromeGeometry?: (kind: ChromeKind, box: ChromeBox) => void; onChromeCommit?: () => void }) {
  const showPage = pageIndex >= 0 && !slide.hidePageNumber && deck.pageNumbers.enabled;
  const ratio = Math.min(1, Math.max(0, (pageIndex + 1) / Math.max(1, total)));
  const bibliography = deck.bibliography;
  const body = slide.bibliography
    ? bibliographyBody(citations, bibliography.format, bibliography.indent, Boolean(bibliography.file.trim() || bibliography.source.trim()))
    : "";
  const change = (kind: ChromeKind) => (box: ChromeBox) => onChromeGeometry?.(kind, box);
  return <>
    {deck.header.enabled && (interactive || deck.header.text) && <EditableChrome label="header" className="slide-header" box={deck.header} textStyle={chromeStyle(deck.header)} interactive={interactive} slideWidth={deck.size.width} onChange={change("header")} onCommit={onChromeCommit}>{deck.header.text}</EditableChrome>}
    {deck.footer.enabled && (interactive || deck.footer.text) && <EditableChrome label="footer" className="slide-footer" box={deck.footer} textStyle={chromeStyle(deck.footer)} interactive={interactive} slideWidth={deck.size.width} onChange={change("footer")} onCommit={onChromeCommit}>{deck.footer.text}</EditableChrome>}
    {showPage && <div className="page-number" style={chromeStyle(deck.pageNumbers)}>{formatPageLabel(deck.pageNumbers.format, pageIndex, total)}</div>}
    {showPage && deck.pageNumbers.progress.enabled && <div className="slide-progress" style={{ left: deck.pageNumbers.progress.x, top: deck.pageNumbers.progress.y, width: deck.pageNumbers.progress.width, height: deck.pageNumbers.progress.thickness }}><div className="slide-progress-fill" style={{ width: `${ratio * 100}%`, background: deck.pageNumbers.progress.color }} /></div>}
    {slide.bibliography && <EditableChrome label="bibliography" className="slide-bibliography" box={bibliography.titleBox} textStyle={{ ...boxStyle(bibliography.titleBox), color: deck.theme.foreground, fontFamily: deck.theme.fontFamily, fontSize: 48, fontWeight: 700, textAlign: "left" }} interactive={interactive} slideWidth={deck.size.width} onChange={change("bibliography")} onCommit={onChromeCommit}>{bibliography.title || "Bibliography"}</EditableChrome>}
    {slide.bibliography && <EditableChrome label="citations" className="slide-citations" box={bibliography.listBox} textStyle={{ ...boxStyle(bibliography.listBox), color: deck.theme.foreground, fontFamily: deck.theme.fontFamily, fontSize: 28, textAlign: "left" }} interactive={interactive} slideWidth={deck.size.width} onChange={change("citations")} onCommit={onChromeCommit}>{body}</EditableChrome>}
  </>;
}

function EditableChrome({ label, className, box, textStyle, interactive, slideWidth, onChange, onCommit, children }: { label: string; className: string; box: ChromeBox; textStyle: CSSProperties; interactive: boolean; slideWidth: number; onChange(box: ChromeBox): void; onCommit?: () => void; children: string }) {
  const drag = (event: ReactPointerEvent, edges: { move?: boolean; left?: boolean; right?: boolean; top?: boolean; bottom?: boolean }) => {
    if (!interactive) return;
    event.preventDefault();
    event.stopPropagation();
    const bounds = event.currentTarget.closest(".slide")?.getBoundingClientRect();
    const scale = bounds && bounds.width > 0 ? bounds.width / slideWidth : 1;
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = { ...box };
    let moved = false;
    const move = (next: PointerEvent) => {
      const dx = (next.clientX - startX) / scale;
      const dy = (next.clientY - startY) / scale;
      if (Math.hypot(dx, dy) < 1) return;
      moved = true;
      let { x, y, width, height } = origin;
      if (edges.move) { x += dx; y += dy; }
      if (edges.left) { x += dx; width -= dx; }
      if (edges.right) width += dx;
      if (edges.top) { y += dy; height -= dy; }
      if (edges.bottom) height += dy;
      onChange({ x, y, width: Math.max(24, width), height: Math.max(24, height) });
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      if (moved) onCommit?.();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
  };
  return <div className={`${className}${interactive ? " chrome-edit" : ""}`} style={textStyle} onPointerDown={(event) => drag(event, { move: true })}>
    {interactive && <span className="chrome-edit-label">{label}</span>}
    {children}
    {interactive && chromeHandles.map((handle) => <button key={handle.key} type="button" className={`chrome-handle chrome-handle-${handle.key}`} aria-label={`Resize ${label}`} onPointerDown={(event) => drag(event, handle.edges)} />)}
  </div>;
}

const chromeHandles: { key: string; edges: { left?: boolean; right?: boolean; top?: boolean; bottom?: boolean } }[] = [
  { key: "nw", edges: { left: true, top: true } },
  { key: "n", edges: { top: true } },
  { key: "ne", edges: { right: true, top: true } },
  { key: "e", edges: { right: true } },
  { key: "se", edges: { right: true, bottom: true } },
  { key: "s", edges: { bottom: true } },
  { key: "sw", edges: { left: true, bottom: true } },
  { key: "w", edges: { left: true } }
];

function boxStyle(box: ChromeBox): CSSProperties {
  return { left: box.x, top: box.y, width: box.width, height: box.height };
}

function chromeStyle(item: { x: number; y: number; width: number; height: number; color: string; fontSize: number; align: "left" | "center" | "right" }): CSSProperties {
  return { left: item.x, top: item.y, width: item.width, height: item.height, color: item.color, fontSize: item.fontSize, textAlign: item.align };
}

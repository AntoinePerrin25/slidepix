import { expandCitationMarkers, formatBibliography, formatPageLabel, manimScriptFileLabel, renderMarkdown, roundedEdgeFadeMask, type Citation, type Deck, type MediaStorage, type Slide, type SlideElement } from "@slidepix/core";
import { useEffect, useState, type CSSProperties, type MouseEvent } from "react";

type Props = {
  deck: Deck;
  slide: Slide;
  scale?: number;
  interactive?: boolean;
  selectedElementIds?: string[];
  editingElementId?: string;
  resolveAsset?: (source: string, storage: MediaStorage) => string;
  citations?: readonly Citation[];
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
      <SlideChrome deck={deck} slide={slide} pageIndex={pageIndex} total={visibleSlides.length} citations={citations} />
    </div>
  );
}

function ElementView({
  element,
  citations,
  interactive,
  selected,
  editing,
  resolveAsset,
  onMouseDown,
  onDoubleClick
}: {
  element: SlideElement;
  citations: readonly Citation[];
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
          dangerouslySetInnerHTML={{ __html: renderMarkdown(expandCitationMarkers(element.markdown, citations)) }}
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
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(expandCitationMarkers(element.cells[row]?.[column] ?? "", citations)) }}
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

function SlideChrome({ deck, slide, pageIndex, total, citations }: { deck: Deck; slide: Slide; pageIndex: number; total: number; citations: readonly Citation[] }) {
  const showPage = pageIndex >= 0 && !slide.hidePageNumber && deck.pageNumbers.enabled;
  const ratio = Math.min(1, Math.max(0, (pageIndex + 1) / Math.max(1, total)));
  const bibliography = slide.bibliography
    ? citations.length
      ? formatBibliography(citations, deck.bibliography.format, deck.bibliography.indent)
      : deck.bibliography.file ? "No citations in the reference file." : "Choose a reference file in the Bibliography tab."
    : "";
  return <>
    {deck.header.enabled && deck.header.text && <div className="slide-header" style={chromeStyle(deck.header)}>{deck.header.text}</div>}
    {deck.footer.enabled && deck.footer.text && <div className="slide-footer" style={chromeStyle(deck.footer)}>{deck.footer.text}</div>}
    {showPage && <div className="page-number" style={chromeStyle(deck.pageNumbers)}>{formatPageLabel(deck.pageNumbers.format, pageIndex, total)}</div>}
    {showPage && deck.pageNumbers.progress.enabled && <div className="slide-progress" style={{ left: deck.pageNumbers.progress.x, top: deck.pageNumbers.progress.y, width: deck.pageNumbers.progress.width, height: deck.pageNumbers.progress.thickness }}><div className="slide-progress-fill" style={{ width: `${ratio * 100}%`, background: deck.pageNumbers.progress.color }} /></div>}
    {slide.bibliography && <div className="slide-bibliography" style={{ left: 72, top: 72, width: Math.max(1, deck.size.width - 144), height: Math.max(1, deck.size.height - 144), color: deck.theme.foreground, fontFamily: deck.theme.fontFamily }}><div className="slide-bibliography-title">{deck.bibliography.title || "Bibliography"}</div><div>{bibliography}</div></div>}
  </>;
}

function chromeStyle(item: { x: number; y: number; width: number; height: number; color: string; fontSize: number; align: "left" | "center" | "right" }): CSSProperties {
  return { left: item.x, top: item.y, width: item.width, height: item.height, color: item.color, fontSize: item.fontSize, textAlign: item.align };
}

import { bibliographyBody, chartMarkup, expandCitationMarkers, formatPageLabel, isPlaceholderImage, manimScriptFileLabel, paintLayoutElements, renderMarkdown, roundedEdgeFadeMask, vectorMarkup, type Citation, type Deck, type MediaStorage, type Slide, type SlideElement } from "@slidepix/core";
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { coveredBySelectedGroup } from "./selection";

type Props = {
  deck: Deck;
  slide: Slide;
  scale?: number;
  interactive?: boolean;
  selectedElementIds?: string[];
  emphasizedIds?: readonly string[];
  dimUnselected?: boolean;
  blinkSelected?: boolean;
  editingElementId?: string;
  resolveAsset?: (source: string, storage: MediaStorage) => string;
  citations?: readonly Citation[];
  onChromeGeometry?: (kind: ChromeKind, box: ChromeBox) => void;
  onChromeCommit?: () => void;
  onSelectElement?: (id?: string, additive?: boolean) => void;
  onEditText?: (id: string) => void;
  onEditImage?: (id: string) => void;
  onEditComponent?: (componentId: string) => void;
  onEditChart?: (id: string) => void;
  onChartValue?: (id: string, seriesIndex: number, rowIndex: number, value: number | "focus" | "commit") => void;
};

export function SlideView({
  deck,
  slide,
  scale = 1,
  interactive = false,
  selectedElementIds = [],
  emphasizedIds = [],
  dimUnselected = false,
  blinkSelected = false,
  editingElementId,
  resolveAsset = (value) => value,
  citations = [],
  onChromeGeometry,
  onChromeCommit,
  onSelectElement,
  onEditText,
  onEditImage,
  onEditComponent,
  onEditChart,
  onChartValue
}: Props) {
  const layout = deck.layouts[slide.layout ?? ""];
  const background = slide.background ?? layout?.background ?? deck.theme.background;
  const backgroundSource = slide.backgroundImage ?? layout?.backgroundImage;
  const backgroundImage = backgroundSource ? `url("${resolveAsset(backgroundSource.src, backgroundSource.storage)}")` : undefined;
  const visibleSlides = deck.slides.filter((item) => !item.hidden);
  const pageIndex = visibleSlides.findIndex((item) => item.id === slide.id);
  const emphasized = new Set(emphasizedIds);
  const covered = coveredBySelectedGroup(slide.elements, selectedElementIds);
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
      {paintLayoutElements(slide, layout, interactive ? "prompt" : "blank").sort((a, b) => a.z - b.z).map((element) => (
        <ElementView
          key={`layout-${element.id}`}
          element={element}
          peers={layout?.elements ?? []}
          components={deck.components}
          citations={citations}
          citationFormat={deck.bibliography.citationFormat}
          indent={deck.bibliography.indent}
          interactive={interactive && Boolean(element.placeholder)}
          selected={selectedElementIds.includes(`slot:${element.id}`)}
          dimmed={dimUnselected && !selectedElementIds.includes(`slot:${element.id}`)}
          blink={false}
          editing={false}
          resolveAsset={resolveAsset}
          layoutSlot
          onMouseDown={(event) => {
            if (!interactive || !element.placeholder) return;
            event.stopPropagation();
            onSelectElement?.(`slot:${element.id}`, event.shiftKey);
          }}
          onDoubleClick={() => undefined}
        />
      ))}
      {[...slide.elements].sort((a, b) => a.z - b.z).map((element) => (
        <ElementView
          key={element.id}
          element={element}
          peers={slide.elements}
          components={deck.components}
          citations={citations}
          citationFormat={deck.bibliography.citationFormat}
          indent={deck.bibliography.indent}
          interactive={interactive}
          selected={emphasized.has(element.id)}
          dimmed={dimUnselected && !emphasized.has(element.id)}
          blink={blinkSelected && emphasized.has(element.id)}
          passThrough={covered.has(element.id)}
          editing={editingElementId === element.id}
          resolveAsset={resolveAsset}
          onMouseDown={(event) => stop(event, element.id)}
          onChartValue={onChartValue}
          onDoubleClick={() => {
            if (element.type === "text") onEditText?.(element.id);
            if (element.type === "image" && !isPlaceholderImage(element)) onEditImage?.(element.id);
            if (element.type === "component") onEditComponent?.(element.componentId);
            if (element.type === "chart") onEditChart?.(element.id);
          }}
        />
      ))}
      <SlideChrome deck={deck} slide={slide} pageIndex={pageIndex} total={visibleSlides.length} citations={citations} interactive={interactive} onChromeGeometry={onChromeGeometry} onChromeCommit={onChromeCommit} />
    </div>
  );
}

function ElementView({
  element,
  peers,
  components,
  citations,
  citationFormat,
  indent,
  interactive,
  selected,
  dimmed = false,
  blink = false,
  passThrough = false,
  editing,
  resolveAsset,
  layoutSlot = false,
  onMouseDown,
  onDoubleClick,
  onChartValue
}: {
  element: SlideElement;
  peers: readonly SlideElement[];
  components: Deck["components"];
  citations: readonly Citation[];
  citationFormat: string;
  indent: number;
  interactive: boolean;
  selected: boolean;
  dimmed?: boolean;
  blink?: boolean;
  passThrough?: boolean;
  editing: boolean;
  resolveAsset: (source: string, storage: MediaStorage) => string;
  layoutSlot?: boolean;
  onMouseDown: (event: MouseEvent) => void;
  onDoubleClick: () => void;
  onChartValue?: (id: string, seriesIndex: number, rowIndex: number, value: number | "focus" | "commit") => void;
}) {
  if (element.hidden) return null;
  const style: CSSProperties = {
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    transform: `rotate(${element.rotation}deg)`,
    ["--paint-opacity" as string]: dimmed ? element.opacity * 0.5 : element.opacity,
    opacity: dimmed ? element.opacity * 0.5 : element.opacity,
    zIndex: element.z,
    pointerEvents: passThrough || element.locked || (layoutSlot && !element.placeholder) ? "none" : undefined
  };
  return (
    <div
      id={interactive && !layoutSlot ? `element-${element.id}` : undefined}
      className={`slide-element ${selected ? "selected" : ""} ${blink ? "selection-blink" : ""} ${editing ? "editing" : ""} ${layoutSlot ? "layout-slot" : ""} ${element.type === "group" ? "group-frame" : ""}`}
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
      {element.type === "image" && (isPlaceholderImage(element) ? <div className="drawing-placeholder">{element.placeholder?.prompt || "Image"}</div> : <ImageView element={element} src={resolveAsset(element.src, element.storage)} />)}
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
      {element.type === "vector" && <div className="vector-frame" dangerouslySetInnerHTML={{ __html: vectorMarkup(element) || `<div class="drawing-placeholder">SVG</div>` }} />}
      {element.type === "chart" && <div className="chart-frame" dangerouslySetInnerHTML={{ __html: chartMarkup(element, peers.filter((item) => item.type === "table")) }} onMouseDown={(event) => { if (selected && (event.target as Element).closest?.("[data-chart-row]")) event.stopPropagation(); }} onPointerDown={(event) => dragChartMark(event, element, selected, onChartValue)} />}
      {element.type === "component" && <ComponentView element={element} component={components[element.componentId]} citations={citations} citationFormat={citationFormat} indent={indent} resolveAsset={resolveAsset} />}
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

function ComponentView({ element, component, citations, citationFormat, indent, resolveAsset }: { element: Extract<SlideElement, { type: "component" }>; component: Deck["components"][string] | undefined; citations: readonly Citation[]; citationFormat: string; indent: number; resolveAsset: (source: string, storage: MediaStorage) => string }) {
  if (!component) return <div className="drawing-placeholder">Missing component</div>;
  const sx = element.width / component.width;
  const sy = element.height / component.height;
  return <div className="component-frame"><div className="component-scale" style={{ width: component.width, height: component.height, transform: `scale(${sx}, ${sy})` }}>
    {component.elements.filter((child) => !child.hidden).sort((a, b) => a.z - b.z).map((child) => (
      <ElementView key={child.id} element={child} peers={component.elements} components={{}} citations={citations} citationFormat={citationFormat} indent={indent} interactive={false} selected={false} editing={false} resolveAsset={resolveAsset} onMouseDown={() => undefined} onDoubleClick={() => undefined} />
    ))}
  </div></div>;
}

const chromeNames: Record<ChromeKind, string> = { header: "Header", footer: "Footer", bibliography: "Bibliography", citations: "Citations" };

function SlideChrome({ deck, slide, pageIndex, total, citations, interactive, onChromeGeometry, onChromeCommit }: { deck: Deck; slide: Slide; pageIndex: number; total: number; citations: readonly Citation[]; interactive: boolean; onChromeGeometry?: (kind: ChromeKind, box: ChromeBox) => void; onChromeCommit?: () => void }) {
  const [pinned, setPinned] = useState<ChromeKind | undefined>();
  const [hovered, setHovered] = useState<ChromeKind | undefined>();
  const [fading, setFading] = useState<ChromeKind | undefined>();
  const [fadeRun, setFadeRun] = useState<ChromeKind | undefined>();
  const fadeTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => { if (fadeTimer.current) window.clearTimeout(fadeTimer.current); }, []);
  useEffect(() => {
    if (!interactive) return;
    const clear = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".chrome-edit")) return;
      setPinned(undefined);
    };
    window.addEventListener("pointerdown", clear);
    return () => window.removeEventListener("pointerdown", clear);
  }, [interactive]);
  const show = (kind: ChromeKind) => {
    setHovered(kind);
    setFading(undefined);
    setFadeRun(undefined);
    if (fadeTimer.current) window.clearTimeout(fadeTimer.current);
  };
  const hide = (kind: ChromeKind) => {
    setHovered((current) => current === kind ? undefined : current);
    if (fadeTimer.current) window.clearTimeout(fadeTimer.current);
    setFading(kind);
    setFadeRun(undefined);
    window.requestAnimationFrame(() => setFadeRun(kind));
    fadeTimer.current = window.setTimeout(() => {
      setFading((current) => current === kind ? undefined : current);
      setFadeRun((current) => current === kind ? undefined : current);
    }, 5000);
  };
  const chromeState = (kind: ChromeKind): "visible" | "fade" | "armed" | "idle" => pinned === kind || hovered === kind ? "visible" : fadeRun === kind ? "fade" : fading === kind ? "armed" : "idle";
  const showPage = pageIndex >= 0 && !slide.hidePageNumber && deck.pageNumbers.enabled;
  const ratio = Math.min(1, Math.max(0, (pageIndex + 1) / Math.max(1, total)));
  const bibliography = deck.bibliography;
  const body = slide.bibliography
    ? bibliographyBody(citations, bibliography.format, bibliography.indent, Boolean(bibliography.file.trim() || bibliography.source.trim()))
    : "";
  const change = (kind: ChromeKind) => (box: ChromeBox) => onChromeGeometry?.(kind, box);
  return <>
    {deck.header.enabled && (interactive || deck.header.text) && <EditableChrome label={chromeNames.header} className="slide-header" box={deck.header} textStyle={chromeStyle(deck.header)} interactive={interactive} slideWidth={deck.size.width} frame={chromeState("header")} onArm={() => show("header")} onRelease={() => hide("header")} onPin={() => setPinned("header")} onChange={change("header")} onCommit={onChromeCommit}>{deck.header.text}</EditableChrome>}
    {deck.footer.enabled && (interactive || deck.footer.text) && <EditableChrome label={chromeNames.footer} className="slide-footer" box={deck.footer} textStyle={chromeStyle(deck.footer)} interactive={interactive} slideWidth={deck.size.width} frame={chromeState("footer")} onArm={() => show("footer")} onRelease={() => hide("footer")} onPin={() => setPinned("footer")} onChange={change("footer")} onCommit={onChromeCommit}>{deck.footer.text}</EditableChrome>}
    {showPage && <div className="page-number" style={chromeStyle(deck.pageNumbers)}>{formatPageLabel(deck.pageNumbers.format, pageIndex, total)}</div>}
    {showPage && deck.pageNumbers.progress.enabled && <div className="slide-progress" style={{ left: deck.pageNumbers.progress.x, top: deck.pageNumbers.progress.y, width: deck.pageNumbers.progress.width, height: deck.pageNumbers.progress.thickness }}><div className="slide-progress-fill" style={{ width: `${ratio * 100}%`, background: deck.pageNumbers.progress.color }} /></div>}
    {slide.bibliography && <EditableChrome label={chromeNames.bibliography} className="slide-bibliography" box={bibliography.titleBox} textStyle={{ ...boxStyle(bibliography.titleBox), color: deck.theme.foreground, fontFamily: deck.theme.fontFamily, fontSize: 48, fontWeight: 700, textAlign: "left" }} interactive={interactive} slideWidth={deck.size.width} frame={chromeState("bibliography")} onArm={() => show("bibliography")} onRelease={() => hide("bibliography")} onPin={() => setPinned("bibliography")} onChange={change("bibliography")} onCommit={onChromeCommit}>{bibliography.title || "Bibliography"}</EditableChrome>}
    {slide.bibliography && <EditableChrome label={chromeNames.citations} className="slide-citations" box={bibliography.listBox} textStyle={{ ...boxStyle(bibliography.listBox), color: deck.theme.foreground, fontFamily: deck.theme.fontFamily, fontSize: 28, textAlign: "left" }} interactive={interactive} slideWidth={deck.size.width} frame={chromeState("citations")} onArm={() => show("citations")} onRelease={() => hide("citations")} onPin={() => setPinned("citations")} onChange={change("citations")} onCommit={onChromeCommit}>{body}</EditableChrome>}
  </>;
}

function EditableChrome({ label, className, box, textStyle, interactive, slideWidth, frame, onArm, onRelease, onPin, onChange, onCommit, children }: { label: string; className: string; box: ChromeBox; textStyle: CSSProperties; interactive: boolean; slideWidth: number; frame: "visible" | "fade" | "armed" | "idle"; onArm(): void; onRelease(): void; onPin(): void; onChange(box: ChromeBox): void; onCommit?: () => void; children: string }) {
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
  return <div className={`${className}${interactive ? ` chrome-edit chrome-${frame}` : ""}`} style={textStyle} onPointerEnter={() => interactive && onArm()} onPointerLeave={() => interactive && onRelease()} onPointerDown={(event) => { onPin(); drag(event, { move: true }); }}>
    {interactive && <span className={`chrome-edit-label${box.y < 22 ? " inside" : ""}`}>{label}</span>}
    <div className="chrome-edit-body">{children}</div>
    {interactive && chromeHandles.map((handle) => <button key={handle.key} type="button" className={`chrome-handle chrome-handle-${handle.key}`} aria-label={`Resize ${label}`} onPointerDown={(event) => { onPin(); drag(event, handle.edges); }} />)}
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

function dragChartMark(event: ReactPointerEvent, element: Extract<SlideElement, { type: "chart" }>, selected: boolean, onChartValue?: (id: string, seriesIndex: number, rowIndex: number, value: number | "focus" | "commit") => void): void {
  if (!selected || !onChartValue || event.button !== 0) return;
  const mark = (event.target as Element).closest?.("[data-chart-row]");
  if (!(mark instanceof SVGElement)) return;
  event.stopPropagation();
  event.preventDefault();
  const row = Number(mark.dataset.chartRow);
  const series = Number(mark.dataset.chartSeries);
  const startValue = Number(mark.dataset.chartValue);
  const plotH = Number(mark.dataset.plotH);
  const min = Number(mark.dataset.min);
  const max = Number(mark.dataset.max);
  const svg = mark.ownerSVGElement;
  const bounds = svg?.getBoundingClientRect();
  const viewHeight = svg?.viewBox.baseVal.height || bounds?.height || 1;
  const startY = event.clientY;
  let dragged = false;
  const canDrag = element.chart !== "pie" && !element.dataLink && Number.isFinite(plotH) && plotH > 0 && bounds;
  const move = (ev: PointerEvent) => {
    if (!canDrag || !bounds) return;
    if (Math.abs(ev.clientY - startY) < 3) return;
    dragged = true;
    const dy = ((ev.clientY - startY) / bounds.height) * viewHeight;
    const span = Math.max(1e-6, max - min);
    onChartValue(element.id, series, row, Math.round((startValue - (dy / plotH) * span) * 100) / 100);
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    onChartValue(element.id, series, row, dragged ? "commit" : "focus");
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

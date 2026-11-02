import { createElement, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fileKind, fileKindMeta } from '../../lib/fileKind';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, Icon, IconButton, Txt } from '../../ui';
import { t } from '../../i18n';

type Props = { visible: boolean; url: string | null; name: string; mime?: string | null; size?: number | null; onClose: () => void };
type Table = { rows: string[][]; truncated: boolean };

const FONT_STACK = ['Inter_400Regular', 'system-ui', 'sans-serif'].join(', ');
const MAX_ROWS = 500; const MAX_COLS = 40; const MAX_PAGES = 60; const MAX_SHEET_BYTES = 12 * 1024 * 1024;

type PdfJs = { GlobalWorkerOptions: { workerSrc: string }; getDocument: (o: { data: ArrayBuffer }) => { promise: Promise<PdfDoc> } };
type PdfDoc = { numPages: number; getPage: (n: number) => Promise<{ getViewport: (o: { scale: number }) => { width: number; height: number }; render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void> } }> };
let pdfjs: Promise<PdfJs> | null = null;
/** pdf.js is served from our own domain (/vendor/pdfjs, copied at build time): no third-party CDN, works offline once cached. */
function loadPdfJs(): Promise<PdfJs> {
  pdfjs ??= new Promise<PdfJs>((resolve, reject) => {
    const w = window as unknown as { pdfjsLib?: PdfJs };
    if (w.pdfjsLib) return resolve(w.pdfjsLib);
    const s = document.createElement('script'); s.src = '/vendor/pdfjs/pdf.min.js'; s.async = true;
    s.onload = () => { if (!w.pdfjsLib) return reject(new Error('pdfjs_missing')); w.pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.js'; resolve(w.pdfjsLib); };
    s.onerror = () => { pdfjs = null; reject(new Error('pdfjs_missing')); };
    document.head.appendChild(s);
  });
  return pdfjs;
}

const cell = (v: unknown): string => (v == null ? '' : v instanceof Date ? v.toLocaleDateString() : String(v));
function parseCsv(text: string, delim: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cur = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; rows.push(row); row = []; if (rows.length > MAX_ROWS + 1) break; }
    else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
const clip = (rows: unknown[][]): Table => ({ rows: rows.slice(0, MAX_ROWS).map((r) => r.slice(0, MAX_COLS).map(cell)), truncated: rows.length > MAX_ROWS || rows.some((r) => r.length > MAX_COLS) });

/** In-app reader: PDF (page by page), .xlsx / CSV as tables, and plain text. Web only; on phones' native builds the system viewer opens the file. */
export function DocViewer({ visible, url, name, mime, size, onClose }: Props) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const kind = fileKind(name, mime);
  const e = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '';
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [pages, setPages] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [sheets, setSheets] = useState<string[]>([]); const [sheet, setSheet] = useState(0);
  const [table, setTable] = useState<Table | null>(null);
  const [book, setBook] = useState<{ name: string; table: Table }[]>([]);
  const [text, setText] = useState<string | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const pdfRef = useRef<PdfDoc | null>(null);
  const renderId = useRef(0);

  // Phones' native builds: hand the file to the system viewer.
  useEffect(() => { if (visible && url && Platform.OS !== 'web') { Linking.openURL(url).catch(() => {}); onClose(); } }, [visible, url, onClose]);

  const fail = useCallback((why: string) => { setError(why); setState('error'); }, []);

  const renderPages = useCallback(async (scaleFactor: number) => {
    const doc = pdfRef.current; const host = hostRef.current; if (!doc || !host) return;
    const id = ++renderId.current;
    host.innerHTML = '';
    const width = Math.max(240, host.clientWidth - 8);
    for (let n = 1; n <= Math.min(doc.numPages, MAX_PAGES); n++) {
      const page = await doc.getPage(n); if (id !== renderId.current) return;
      const base = page.getViewport({ scale: 1 });
      const scale = (width / base.width) * scaleFactor * Math.min(window.devicePixelRatio || 1, 2);
      const vp = page.getViewport({ scale });
      const canvas = document.createElement('canvas'); canvas.width = Math.floor(vp.width); canvas.height = Math.floor(vp.height);
      canvas.style.cssText = `width:${Math.floor(vp.width / Math.min(window.devicePixelRatio || 1, 2))}px;max-width:none;display:block;margin:0 auto 10px;background:#fff;box-shadow:0 1px 6px rgba(0,0,0,.25)`;
      host.appendChild(canvas);
      await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise;
    }
  }, []);

  useEffect(() => {
    if (!visible || !url || Platform.OS !== 'web') return;
    let live = true;
    setState('loading'); setError(''); setPages(0); setZoom(1); setSheets([]); setBook([]); setSheet(0); setTable(null); setText(null); pdfRef.current = null;
    (async () => {
      try {
        const res = await fetch(url); if (!res.ok) throw new Error('download_failed');
        const blob = await res.blob(); if (!live) return; blobRef.current = blob;
        if (kind === 'pdf') {
          const lib = await loadPdfJs(); const doc = await lib.getDocument({ data: await blob.arrayBuffer() }).promise;
          if (!live) return; pdfRef.current = doc; setPages(doc.numPages); setState('ready');
        } else if (kind === 'sheet' && (e === 'csv' || e === 'tsv')) {
          const rows = parseCsv(await blob.text(), e === 'tsv' ? '\t' : (await blob.slice(0, 2000).text()).split(';').length > (await blob.slice(0, 2000).text()).split(',').length ? ';' : ',');
          if (live) { setTable(clip(rows)); setState('ready'); }
        } else if (kind === 'sheet') {
          if (blob.size > MAX_SHEET_BYTES) throw new Error('too_big');
          const { default: readXlsx } = await import('read-excel-file/browser');
          const all = (await readXlsx(blob)).map((s) => ({ name: s.sheet, table: clip(s.data as unknown[][]) })); if (!live) return;
          setBook(all); setTable(all[0]?.table ?? { rows: [], truncated: false }); setSheets(all.map((s) => s.name)); setState('ready');
        } else if (kind === 'text') {
          const body = await blob.text(); if (live) { setText(body.slice(0, 400_000)); setState('ready'); }
        } else fail('unsupported');
      } catch (err) { if (live) fail((err as Error).message); }
    })();
    return () => { live = false; renderId.current++; };
  }, [visible, url, kind, e, fail]);

  useEffect(() => { if (state === 'ready' && pages) renderPages(zoom).catch(() => fail('render_failed')); }, [state, pages, zoom, renderPages, fail]);

  const pickSheet = (i: number) => { setSheet(i); setTable(book[i]?.table ?? null); };

  if (!visible || Platform.OS !== 'web') return null;
  const meta = fileKindMeta[kind];
  const message = error === 'too_big' ? t('La hoja es demasiado grande para verla aquí. Ábrela con otra app.') : error === 'unsupported' ? t('Este tipo de archivo no se puede ver aquí.') : t('No se pudo abrir el archivo.');

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <View style={{ paddingTop: insets.top + 8, paddingBottom: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border }}>
          <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: meta.color, alignItems: 'center', justifyContent: 'center' }}><Icon name={meta.icon} size={20} color="#fff" /></View>
          <View style={{ flex: 1 }}>
            <Txt v="bodyStrong" numberOfLines={1}>{name}</Txt>
            <Txt v="caption" tone="muted">{[t(meta.label), pages ? t('{n} páginas', { n: pages }) : null, size ? `${(size / 1048576).toFixed(size > 1048576 ? 1 : 2)} MB` : null].filter(Boolean).join(' · ')}</Txt>
          </View>
          {kind === 'pdf' && state === 'ready' && (
            <>
              <IconButton icon="remove" label="Alejar" size={38} onPress={() => setZoom((z) => Math.max(0.6, +(z - 0.25).toFixed(2)))} />
              <IconButton icon="add" label="Acercar" size={38} onPress={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))} />
            </>
          )}
          {url && <IconButton icon="download" label="Abrir o descargar" size={38} onPress={() => Linking.openURL(url)} />}
          <IconButton icon="close" label="Cerrar" size={38} onPress={onClose} />
        </View>

        {state === 'loading' && <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={c.accent} /></View>}
        {state === 'error' && (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 30 }}>
            <Icon name={meta.icon} size={40} color={meta.color} /><Txt tone="muted" style={{ textAlign: 'center' }}>{message}</Txt>
            {url && <Button title="Abrir o descargar" icon="download" onPress={() => Linking.openURL(url)} />}
          </View>
        )}

        {state === 'ready' && kind === 'pdf' && (
          <ScrollView style={{ flex: 1, backgroundColor: c.sunken }} contentContainerStyle={{ padding: 8, paddingBottom: insets.bottom + 20 }} horizontal={false}>
            {createElement('div', { ref: hostRef, style: { overflowX: 'auto' } })}
            {pages > MAX_PAGES && <Txt v="small" tone="muted" style={{ textAlign: 'center', padding: 12 }}>{t('Se muestran las primeras {n} páginas.', { n: MAX_PAGES })}</Txt>}
          </ScrollView>
        )}

        {state === 'ready' && (kind === 'sheet') && (
          <View style={{ flex: 1 }}>
            {sheets.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.surface }} contentContainerStyle={{ paddingHorizontal: 8, gap: 4 }}>
                {sheets.map((s, i) => (
                  <View key={s} style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 3, borderBottomColor: i === sheet ? meta.color : 'transparent' }}>
                    <Txt v="smallStrong" tone={i === sheet ? 'text' : 'muted'} onPress={() => pickSheet(i)} accessibilityRole="button">{s}</Txt>
                  </View>
                ))}
              </ScrollView>
            )}
            {!table ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={c.accent} /></View> : (
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
                <ScrollView horizontal>
                  {createElement('table', { style: { borderCollapse: 'collapse', fontSize: 13, color: c.text, fontFamily: FONT_STACK } },
                    createElement('tbody', null, table.rows.map((r, i) => createElement('tr', { key: i, style: { background: i === 0 ? c.surfaceAlt : i % 2 ? c.surface : 'transparent' } },
                      r.map((v, j) => createElement(i === 0 ? 'th' : 'td', { key: j, style: { border: `1px solid ${c.border}`, padding: '6px 10px', textAlign: 'left', whiteSpace: 'nowrap', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: i === 0 ? 700 : 400 } }, v))))))}
                </ScrollView>
                {table.truncated && <Txt v="small" tone="muted" style={{ textAlign: 'center', padding: 12 }}>{t('Vista parcial: primeras {r} filas y {k} columnas.', { r: MAX_ROWS, k: MAX_COLS })}</Txt>}
              </ScrollView>
            )}
          </View>
        )}

        {state === 'ready' && kind === 'text' && (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}>
            <Txt v="mono" selectable style={{ color: c.text }}>{text}</Txt>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

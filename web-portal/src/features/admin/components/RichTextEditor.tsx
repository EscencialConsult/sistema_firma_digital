import { useEffect, useRef, useState } from "react";
import {
  useEditor, EditorContent, Editor,
  ReactNodeViewRenderer, NodeViewWrapper,
} from "@tiptap/react";
import { Node, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight,
  Bold, Check, Code, Copy, Eye, Info, Italic, List, ListOrdered, Minus,
  Printer, Strikethrough, UnderlineIcon, X,
} from "lucide-react";
// pagedjs polyfill served from public/ (copied from node_modules/pagedjs/dist/paged.polyfill.min.js)
const pagedJsUrl = "/pagedjs.js";

// ─── Font-size extension ──────────────────────────────────────────────────────

const FontSizeExtension = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).style.fontSize || null,
        renderHTML: (attrs) =>
          attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {},
      },
    };
  },
});

// ─── Variable metadata ────────────────────────────────────────────────────────

const VAR_META: Record<string, { label: string; category: string }> = {
  // firmante (auto)
  nombre_usuario:    { label: "Nombre",        category: "usuario"  },
  email_usuario:     { label: "Email",         category: "usuario"  },
  dni_usuario:       { label: "DNI",           category: "usuario"  },
  cuil_usuario:      { label: "CUIL",          category: "usuario"  },
  domicilio_usuario: { label: "Domicilio",     category: "usuario"  },
  // empresa (auto)
  nombre_empresa:          { label: "Empresa",           category: "empresa" },
  nombre_consultora:       { label: "Consultora",        category: "empresa" },
  razon_social:            { label: "Razón social",      category: "empresa" },
  razon_social_empresa:    { label: "Razón social emp.", category: "empresa" },
  razon_social_consultora: { label: "Razón social cons.",category: "empresa" },
  cuit_empresa:            { label: "CUIT empresa",      category: "empresa" },
  cuit_consultora:         { label: "CUIT consultora",   category: "empresa" },
  domicilio_empresa:       { label: "Domicilio emp.",    category: "empresa" },
  domicilio_consultora:    { label: "Domicilio cons.",   category: "empresa" },
  ciudad_empresa:          { label: "Ciudad emp.",       category: "empresa" },
  ciudad_consultora:       { label: "Ciudad cons.",      category: "empresa" },
  provincia_empresa:       { label: "Provincia emp.",    category: "empresa" },
  provincia_consultora:    { label: "Provincia cons.",   category: "empresa" },
  email_empresa:           { label: "Email empresa",     category: "empresa" },
  email_consultora:        { label: "Email consultora",  category: "empresa" },
  telefono_empresa:        { label: "Tel. empresa",      category: "empresa" },
  telefono_consultora:     { label: "Tel. consultora",   category: "empresa" },
  representante_legal:     { label: "Representante",     category: "empresa" },
  representante_empresa:   { label: "Rep. empresa",      category: "empresa" },
  representante_consultora:{ label: "Rep. consultora",   category: "empresa" },
  autoridad_nombre:        { label: "Autoridad",         category: "empresa" },
  autoridad_cuil:          { label: "CUIL autoridad",    category: "empresa" },
  autoridad_email:         { label: "Email autoridad",   category: "empresa" },
  // sistema (admin completa)
  fecha_inicio:      { label: "Inicio",        category: "sistema"  },
  fecha_fin:         { label: "Fin",           category: "sistema"  },
  fecha_entrega:     { label: "Entrega",       category: "sistema"  },
  monto:             { label: "Monto",         category: "sistema"  },
  monto_inicial:     { label: "Monto inicial", category: "sistema"  },
  monto_final:       { label: "Monto final",   category: "sistema"  },
  cuotas:            { label: "Cuotas",        category: "sistema"  },
  objeto:            { label: "Objeto",        category: "sistema"  },
  descripcion:       { label: "Descripción",   category: "sistema"  },
  ciudad:            { label: "Ciudad",        category: "sistema"  },
  provincia:         { label: "Provincia",     category: "sistema"  },
};

// ─── Variable chip (visual) ───────────────────────────────────────────────────

// verde = firmante auto, azul = empresa auto, celeste = sistema, naranja = personalizada
const CHIP_COLORS: Record<string, string> = {
  usuario: "#10B981",  // green  — firmante
  empresa: "#3B82F6",  // blue   — datos de la empresa (auto)
  sistema: "#0EA5E9",  // sky    — admin completa
  fechas:  "#0EA5E9",  // legacy alias → sistema
  montos:  "#0EA5E9",  // legacy alias → sistema
  propia:  "#F59E0B",  // orange — personalizada
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function VariableChip({ node }: any) {
  const { label, category } = node.attrs as { label: string; category: string };
  const color = CHIP_COLORS[category] ?? CHIP_COLORS.propia;
  return (
    <NodeViewWrapper as="span">
      <span
        contentEditable={false}
        style={{
          background:   `${color}18`,
          color,
          border:       `1px solid ${color}44`,
          borderRadius: 4,
          padding:      "1px 7px",
          fontWeight:   700,
          fontSize:     "0.88em",
          userSelect:   "none",
          cursor:       "default",
          whiteSpace:   "nowrap",
        }}
      >
        {`{{${label}}}`}
      </span>
    </NodeViewWrapper>
  );
}

// ─── Variable node extension ──────────────────────────────────────────────────

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    variable: {
      insertVariable: (attrs: { variableId: string; label: string; category: string }) => ReturnType;
    };
  }
}

const VariableNode = Node.create({
  name:       "variable",
  group:      "inline",
  inline:     true,
  atom:       true,  // indivisible — cursor never enters the chip
  selectable: true,
  draggable:  false,

  addAttributes() {
    return {
      variableId: { default: null },
      label:      { default: "" },
      category:   { default: "propia" },
    };
  },

  parseHTML() {
    return [{
      tag: "span[data-variable]",
      getAttrs: (el) => ({
        variableId: (el as HTMLElement).getAttribute("data-variable"),
        label:      (el as HTMLElement).getAttribute("data-label") ?? "",
        category:   (el as HTMLElement).getAttribute("data-category") ?? "propia",
      }),
    }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, {
      "data-variable": node.attrs.variableId,
      "data-label":    node.attrs.label,
      "data-category": node.attrs.category,
      class:           "variable-chip",
    }), `{{${node.attrs.variableId}}}`];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VariableChip);
  },

  addCommands() {
    return {
      insertVariable: (attrs) => ({ chain }) =>
        chain().insertContent({ type: "variable", attrs }).run(),
    };
  },
});

// ─── HTML upgrade: plain {{var}} → <span data-variable> ──────────────────────
// Runs once at load. Converts old plain-text variables to TipTap node format.
// Skips text already inside a data-variable span (idempotent).

function upgradeHTML(html: string): string {
  if (!html || !html.includes("{{")) return html;

  const doc = new DOMParser().parseFromString(html, "text/html");

  function walk(parent: ChildNode) {
    const children = Array.from(parent.childNodes);
    for (const child of children) {
      if (child.nodeType === 3 /* TEXT_NODE */) {
        const text = child.textContent ?? "";
        if (!text.includes("{{")) continue;
        if ((child.parentElement as HTMLElement)?.hasAttribute?.("data-variable")) continue;

        const parts = text.split(/(\{\{\w+\}\})/g);
        if (parts.length <= 1) continue;

        const frag = doc.createDocumentFragment();
        for (const part of parts) {
          const m = part.match(/^\{\{(\w+)\}\}$/);
          if (m) {
            const key = m[1];
            const meta = VAR_META[key] ?? { label: key, category: "propia" };
            const span = doc.createElement("span");
            span.setAttribute("data-variable", key);
            span.setAttribute("data-label", meta.label);
            span.setAttribute("data-category", meta.category);
            span.textContent = `{{${key}}}`;
            frag.appendChild(span);
          } else if (part) {
            frag.appendChild(doc.createTextNode(part));
          }
        }
        child.replaceWith(frag);
      } else if (child.nodeType === 1 /* ELEMENT_NODE */) {
        if (!(child as HTMLElement).hasAttribute("data-variable")) {
          walk(child);
        }
      }
    }
  }

  walk(doc.body);
  return doc.body.innerHTML;
}

// ─── Variable catalog ─────────────────────────────────────────────────────────

const AUTO_VAR_DESCRIPTIONS: Record<string, string> = {
  // firmante
  nombre_usuario:    "Nombre completo del firmante, tomado del usuario seleccionado.",
  email_usuario:     "Email del firmante, tomado del perfil del usuario.",
  dni_usuario:       "DNI verificado durante el proceso KYC.",
  cuil_usuario:      "CUIL/CUIT verificado durante el proceso KYC.",
  domicilio_usuario: "Domicilio verificado durante el proceso KYC.",
  // empresa
  nombre_empresa:          "Nombre comercial de tu empresa (desde Configuración).",
  nombre_consultora:       "Nombre de la consultora (desde Configuración).",
  razon_social:            "Razón social completa de la organización.",
  razon_social_empresa:    "Razón social de la empresa.",
  razon_social_consultora: "Razón social de la consultora.",
  cuit_empresa:            "CUIT de la empresa (desde Configuración).",
  cuit_consultora:         "CUIT de la consultora (desde Configuración).",
  domicilio_empresa:       "Domicilio legal de la empresa.",
  domicilio_consultora:    "Domicilio legal de la consultora.",
  ciudad_empresa:          "Ciudad de la empresa.",
  ciudad_consultora:       "Ciudad de la consultora.",
  provincia_empresa:       "Provincia de la empresa.",
  provincia_consultora:    "Provincia de la consultora.",
  email_empresa:           "Email de contacto de la empresa.",
  email_consultora:        "Email de contacto de la consultora.",
  telefono_empresa:        "Teléfono de la empresa.",
  telefono_consultora:     "Teléfono de la consultora.",
  representante_legal:     "Representante legal de la organización.",
  representante_empresa:   "Representante legal de la empresa.",
  representante_consultora:"Representante legal de la consultora.",
  autoridad_nombre:        "Nombre de la autoridad firmante.",
  autoridad_cuil:          "CUIL de la autoridad firmante.",
  autoridad_email:         "Email de la autoridad firmante.",
};

const SUGGESTED_VARS: { group: string; vars: { key: string; label: string; auto?: boolean }[] }[] = [
  { group: "Firmante (auto)", vars: [
    { key: "nombre_usuario",    label: "Nombre",    auto: true },
    { key: "email_usuario",     label: "Email",     auto: true },
    { key: "dni_usuario",       label: "DNI",       auto: true },
    { key: "cuil_usuario",      label: "CUIL",      auto: true },
    { key: "domicilio_usuario", label: "Domicilio", auto: true },
  ]},
  { group: "Empresa (auto)", vars: [
    { key: "nombre_empresa",          label: "Nombre empresa",    auto: true },
    { key: "razon_social",            label: "Razón social",      auto: true },
    { key: "cuit_empresa",            label: "CUIT empresa",      auto: true },
    { key: "domicilio_empresa",       label: "Domicilio",         auto: true },
    { key: "ciudad_empresa",          label: "Ciudad",            auto: true },
    { key: "provincia_empresa",       label: "Provincia",         auto: true },
    { key: "email_empresa",           label: "Email",             auto: true },
    { key: "telefono_empresa",        label: "Teléfono",          auto: true },
    { key: "representante_legal",     label: "Representante",     auto: true },
    { key: "autoridad_nombre",        label: "Autoridad",         auto: true },
    { key: "autoridad_cuil",          label: "CUIL autoridad",    auto: true },
    { key: "autoridad_email",         label: "Email autoridad",   auto: true },
  ]},
  { group: "Fechas", vars: [
    { key: "fecha_inicio",  label: "Inicio" },
    { key: "fecha_fin",     label: "Fin" },
    { key: "fecha_entrega", label: "Entrega" },
  ]},
  { group: "Montos", vars: [
    { key: "monto",         label: "Monto" },
    { key: "monto_inicial", label: "Monto inicial" },
    { key: "monto_final",   label: "Monto final" },
    { key: "cuotas",        label: "Cuotas" },
  ]},
  { group: "Contrato", vars: [
    { key: "objeto",      label: "Objeto" },
    { key: "descripcion", label: "Descripción" },
    { key: "ciudad",      label: "Ciudad" },
    { key: "provincia",   label: "Provincia" },
  ]},
];

// ─── System prompt for AI-assisted contract drafting ─────────────────────────

const SYSTEM_PROMPT = `DATOS DEL FIRMANTE (se completan automáticamente desde el perfil del usuario):
• Nombre completo: {{nombre_usuario}}
• Correo electrónico: {{email_usuario}}
• DNI: {{dni_usuario}}
• CUIL/CUIT: {{cuil_usuario}}
• Domicilio: {{domicilio_usuario}}

DATOS DE LA EMPRESA/ORGANIZACIÓN (se completan automáticamente desde la configuración):
• Nombre de la empresa: {{nombre_empresa}}
• Razón social: {{razon_social}}
• CUIT: {{cuit_empresa}}
• Domicilio: {{domicilio_empresa}}
• Ciudad: {{ciudad_empresa}}
• Provincia: {{provincia_empresa}}
• Email de contacto: {{email_empresa}}
• Teléfono: {{telefono_empresa}}
• Representante legal: {{representante_legal}}
• Autoridad firmante: {{autoridad_nombre}}
• CUIL autoridad: {{autoridad_cuil}}
• Email autoridad: {{autoridad_email}}

FECHAS:
• Fecha de inicio: {{fecha_inicio}}
• Fecha de fin: {{fecha_fin}}
• Fecha de entrega: {{fecha_entrega}}

MONTOS:
• Monto total: {{monto}}
• Monto inicial: {{monto_inicial}}
• Monto final: {{monto_final}}
• Cantidad de cuotas: {{cuotas}}

DATOS DEL CONTRATO:
• Objeto del contrato: {{objeto}}
• Descripción: {{descripcion}}
• Ciudad: {{ciudad}}
• Provincia: {{provincia}}

Para campos específicos no cubiertos por las variables anteriores, crear variables personalizadas con el formato {{nombre_en_minusculas}} (sin espacios, sin caracteres especiales). No inventar datos concretos; usar siempre variables del sistema o personalizadas donde corresponda.`;

// ─── Toolbar ──────────────────────────────────────────────────────────────────

function ToolBtn({ active, onClick, title, children }: {
  active?: boolean; onClick: () => void; title?: string; children: React.ReactNode;
}) {
  return (
    <button type="button" title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={`grid h-7 w-7 place-items-center rounded text-xs transition
        ${active ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"}`}>
      {children}
    </button>
  );
}

function Toolbar({ editor, onPreview }: { editor: Editor | null; onPreview: () => void }) {
  if (!editor) return <div className="h-11 border-b border-zinc-200 bg-zinc-50" />;
  const ed       = editor;
  const rawSize  = ed.getAttributes("textStyle").fontSize as string | undefined;
  const fontSize = rawSize ? parseInt(rawSize) : 13;
  function setSize(delta: number) {
    const next = Math.min(40, Math.max(8, fontSize + delta));
    ed.chain().focus().setMark("textStyle", { fontSize: `${next}px` }).run();
  }
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-zinc-200 bg-zinc-50 px-3 py-2 select-none">
      <button type="button" onMouseDown={(e) => { e.preventDefault(); setSize(-1); }}
        className="grid h-7 w-7 place-items-center rounded text-[11px] font-bold text-zinc-500 hover:bg-zinc-100 transition">A-</button>
      <span className="w-7 text-center text-[11px] font-mono text-zinc-500">{fontSize}</span>
      <button type="button" onMouseDown={(e) => { e.preventDefault(); setSize(+1); }}
        className="grid h-7 w-7 place-items-center rounded text-[11px] font-bold text-zinc-500 hover:bg-zinc-100 transition">A+</button>
      <div className="mx-1 h-4 w-px bg-zinc-200" />
      <ToolBtn active={ed.isActive("bold")}      onClick={() => ed.chain().focus().toggleBold().run()}><Bold size={13}/></ToolBtn>
      <ToolBtn active={ed.isActive("italic")}    onClick={() => ed.chain().focus().toggleItalic().run()}><Italic size={13}/></ToolBtn>
      <ToolBtn active={ed.isActive("underline")} onClick={() => ed.chain().focus().toggleUnderline().run()}><UnderlineIcon size={13}/></ToolBtn>
      <ToolBtn active={ed.isActive("strike")}    onClick={() => ed.chain().focus().toggleStrike().run()}><Strikethrough size={13}/></ToolBtn>
      <ToolBtn active={ed.isActive("code")}      onClick={() => ed.chain().focus().toggleCode().run()}><Code size={13}/></ToolBtn>
      <div className="mx-1 h-4 w-px bg-zinc-200" />
      {(["left","center","right","justify"] as const).map((a) => {
        const Icon = { left: AlignLeft, center: AlignCenter, right: AlignRight, justify: AlignJustify }[a];
        return <ToolBtn key={a} active={ed.isActive({ textAlign: a })} onClick={() => ed.chain().focus().setTextAlign(a).run()}><Icon size={13}/></ToolBtn>;
      })}
      <div className="mx-1 h-4 w-px bg-zinc-200" />
      <ToolBtn active={ed.isActive("bulletList")}  onClick={() => ed.chain().focus().toggleBulletList().run()}><List size={13}/></ToolBtn>
      <ToolBtn active={ed.isActive("orderedList")} onClick={() => ed.chain().focus().toggleOrderedList().run()}><ListOrdered size={13}/></ToolBtn>
      <div className="mx-1 h-4 w-px bg-zinc-200" />
      {([1,2,3] as const).map((level) => (
        <ToolBtn key={level} active={ed.isActive("heading",{level})} onClick={() => ed.chain().focus().toggleHeading({level}).run()}>
          <span className="text-[10px] font-bold">H{level}</span>
        </ToolBtn>
      ))}
      <ToolBtn onClick={() => ed.chain().focus().setHorizontalRule().run()}><Minus size={13}/></ToolBtn>
      <div className="mx-1 h-4 w-px bg-zinc-200" />
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); onPreview(); }}
        className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 h-7 text-[11px] font-medium text-zinc-600 hover:bg-zinc-100 transition"
      >
        <Eye size={12} />
        Vista previa
      </button>
    </div>
  );
}

// ─── Editor CSS classes ───────────────────────────────────────────────────────

const EDITOR_CLS = [
  "[&_.ProseMirror]:outline-none",
  "[&_.ProseMirror]:min-h-[600px]",
  "[&_.ProseMirror_p]:my-2",
  "[&_.ProseMirror_h1]:text-xl [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h1]:text-center [&_.ProseMirror_h1]:mb-4",
  "[&_.ProseMirror_h2]:text-base [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_h2]:mb-2",
  "[&_.ProseMirror_h3]:text-sm [&_.ProseMirror_h3]:font-semibold",
  "[&_.ProseMirror_strong]:font-bold",
  "[&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-5",
  "[&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-5",
  "[&_.ProseMirror_li]:my-0.5",
  "[&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
  "[&_.ProseMirror_p.is-editor-empty:first-child::before]:text-zinc-300",
  "[&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left",
  "[&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none",
].join(" ");

// ─── Preview modal (paged.js via iframe) ─────────────────────────────────────

interface PagedHTMLOptions {
  notifyParent?: boolean; // true = postMessage to parent iframe (preview)
  autoPrint?:    boolean; // true = call window.print() after paged.js renders (print window)
}

function buildPagedHTML(
  html: string,
  hasHeader: boolean,
  logoUrl?: string | null,
  logoWatermark?: boolean,
  { notifyParent = false, autoPrint = false }: PagedHTMLOptions = {},
): string {
  const headerHtml = hasHeader
    ? `<div class="doc-header"><img src="${logoUrl}" /></div>`
    : "";

  const watermarkCss = logoWatermark && logoUrl
    ? `body::before{content:'';display:block;position:fixed;inset:0;background:url('${logoUrl}') no-repeat center center;background-size:50%;opacity:0.07;pointer-events:none;z-index:0;}`
    : "";

  const onReady = [
    notifyParent && `window.parent.postMessage({type:'pagedjs-ready',pages:n},'*');`,
    autoPrint    && `window.print();`,
  ].filter(Boolean).join("\n");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<script>window.PagedConfig={auto:true};</script>
<script src="${pagedJsUrl}"></script>
<script>
// Poll for paged.js completion
window.addEventListener('load',function(){
  var attempts=0;
  var iv=setInterval(function(){
    attempts++;
    var n=document.querySelectorAll('.pagedjs_page').length;
    if(n>0||attempts>20){
      clearInterval(iv);
      ${onReady}
    }
  },150);
});
</script>
<style>
@page{
  size:A4 portrait;
  margin:2.5cm 2cm;
  @bottom-center{
    content:"Página " counter(page) " de " counter(pages);
    font-family:Georgia,serif;
    font-size:9pt;
    color:#9ca3af;
  }
}
*{box-sizing:border-box;}
body{
  font-family:Georgia,'Times New Roman',serif;
  font-size:12pt;
  line-height:1.6;
  color:#1a1a1a;
  margin:0;
  background:#e8e8e8;
}
${watermarkCss}
h1{font-size:1.2em;font-weight:bold;text-align:center;margin:.8em 0;}
h2{font-size:1em;font-weight:bold;margin:.6em 0;}
h3{font-size:.9em;font-weight:600;}
p{margin:.5em 0;}
ul{list-style:disc;padding-left:1.5em;}
ol{list-style:decimal;padding-left:1.5em;}
li{margin:.1em 0;}
strong{font-weight:bold;}
em{font-style:italic;}
u{text-decoration:underline;}
hr{border:none;border-top:1px solid #e5e7eb;margin:.5em 0;}
.variable-chip{background:none!important;border:none!important;color:inherit!important;font-weight:bold;padding:0;font-size:inherit;}
.doc-header{margin-bottom:1cm;padding-bottom:.5cm;border-bottom:1.5px solid #d1d5db;}
.doc-header img{height:1.8cm;display:block;}
/* ── screen-only: center pages in canvas ── */
@media screen{
  html,body{width:100%;min-height:100vh;margin:0;padding:0;}
  body{display:flex;justify-content:center;background:#e8e8e8;}
  .pagedjs_pages{display:flex!important;flex-direction:column!important;align-items:center!important;gap:28px;padding:32px;width:auto!important;}
  .pagedjs_page{box-shadow:0 0 0 1px rgba(0,0,0,.06),0 6px 28px rgba(0,0,0,.5);}
}
/* ── print: clean white, no decorations ── */
@media print{
  body{background:white!important;}
  .pagedjs_pages{display:block!important;padding:0!important;gap:0!important;background:white!important;}
  .pagedjs_page{box-shadow:none!important;margin:0!important;}
}
</style>
</head>
<body>
${headerHtml}
${html}
</body>
</html>`;
}

function PreviewModal({ html, logoUrl, logoHeader, logoWatermark, onClose }: {
  html:           string;
  logoUrl?:       string | null;
  logoHeader?:    boolean;
  logoWatermark?: boolean;
  onClose:        () => void;
}) {
  const iframeRef    = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading]     = useState(true);
  const [pageTotal, setPageTotal] = useState<number | null>(null);
  const hasHeader = Boolean(logoHeader && logoUrl);

  // Listen for paged.js completion from iframe
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.data?.type === "pagedjs-ready") {
        setPageTotal(e.data.pages as number);
        setLoading(false);
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // Write content into iframe on open (preview mode — notifies parent when ready)
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    setLoading(true);
    setPageTotal(null);

    const doc = iframe.contentDocument;
    if (!doc) return;

    doc.open();
    doc.write(buildPagedHTML(html, hasHeader, logoUrl, logoWatermark, { notifyParent: true }));
    doc.close();
  }, [html, hasHeader, logoUrl, logoWatermark]);

  // Print: open a NEW window with paged.js + auto-print after render.
  // This avoids sandbox restrictions and guarantees a clean vector PDF
  // (no grey background, no box-shadows — only the document content).
  function handlePrint() {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.open();
    win.document.write(
      buildPagedHTML(html, hasHeader, logoUrl, logoWatermark, { autoPrint: true })
    );
    win.document.close();
    win.focus();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "rgba(0,0,0,0.9)" }}>
      {/* Header bar */}
      <div className="shrink-0 flex items-center justify-between px-5 py-2.5 bg-zinc-900 border-b border-zinc-700">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-zinc-200">Vista previa del contrato</span>
          {pageTotal !== null && (
            <span className="text-xs text-zinc-500 tabular-nums">
              {pageTotal} {pageTotal === 1 ? "página" : "páginas"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 px-3 py-1.5 text-xs font-medium text-white transition">
            <Printer size={13} /> Imprimir / PDF
          </button>
          <button type="button" onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded hover:bg-zinc-700 text-zinc-400 hover:text-white transition">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Paged.js iframe */}
      <div className="relative flex-1 overflow-hidden">
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3"
            style={{ background: "#525659" }}>
            <div className="w-8 h-8 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
            <p className="text-xs text-zinc-400">Paginando documento…</p>
          </div>
        )}
        <iframe
          ref={iframeRef}
          title="Vista previa paginada"
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-modals"
        />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface RichTextEditorProps {
  value:          string;
  onChange:       (html: string) => void;
  placeholder?:   string;
  logoHeader?:    boolean;
  logoWatermark?: boolean;
  logoUrl?:       string | null;
  className?:     string;
  documentTitle?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Redactá el contrato...",
  logoHeader,
  logoWatermark,
  logoUrl,
  className = "",
  documentTitle,
}: RichTextEditorProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [showPrompt, setShowPrompt]   = useState(false);
  const [copied, setCopied]           = useState(false);
  const hasHeader = Boolean(logoHeader && logoUrl);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      FontSizeExtension,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder }),
      VariableNode,
    ],
    content: upgradeHTML(value || "<p></p>"),
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  });

  // Sync when an external value change arrives (e.g. user switches contracts)
  const prevValueRef = useRef(value);
  useEffect(() => {
    if (!editor || value === prevValueRef.current) return;
    prevValueRef.current = value;
    const upgraded = upgradeHTML(value || "<p></p>");
    if (editor.getHTML() !== upgraded) {
      editor.commands.setContent(upgraded);
    }
  }, [editor, value]);

  function insertVariable(key: string) {
    const meta = VAR_META[key] ?? { label: key, category: "propia" };
    editor?.chain().focus().insertVariable({
      variableId: key,
      label:      meta.label,
      category:   meta.category,
    }).run();
  }

  return (
    <div className={`flex gap-0 rounded-2xl overflow-hidden border border-zinc-200 shadow-sm ${className}`} style={{ height: "82vh" }}>

      {/* ── Editor column ──────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        <div className="shrink-0">
          <Toolbar editor={editor} onPreview={() => setShowPreview(true)} />
        </div>

        {/* Scroll-continuo editor — no page counting, no measurement */}
        <div className="flex-1 overflow-auto" style={{ background: "#525659" }}>
          <div className="flex justify-center py-10 px-6">
            <div style={{
              width: 794,
              minHeight: 1123,
              background: "white",
              boxShadow: "0 0 0 1px rgba(0,0,0,0.06), 0 8px 32px rgba(0,0,0,0.55)",
              position: "relative",
            }}>
              {/* Watermark */}
              {logoWatermark && logoUrl && (
                <div style={{
                  position: "absolute", inset: 0, zIndex: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  pointerEvents: "none",
                }}>
                  <img src={logoUrl} alt="" style={{ width: "55%", opacity: 0.07, objectFit: "contain" }} />
                </div>
              )}

              <div style={{
                position: "relative", zIndex: 1,
                padding: "64px 80px",
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: 13, lineHeight: 1.85, color: "#1a1a1a",
              }}>
                {/* Header logo */}
                {hasHeader && (
                  <div style={{ paddingBottom: 16, borderBottom: "1.5px solid #d1d5db", marginBottom: 20 }}>
                    <img src={logoUrl!} alt="Logo" style={{ height: 68, objectFit: "contain", display: "block" }} />
                  </div>
                )}

                {/* Título del documento — no editable, viene del campo "Nombre de la plantilla" */}
                {documentTitle && (
                  <div
                    contentEditable={false}
                    style={{
                      textAlign: "center",
                      paddingBottom: 20,
                      marginBottom: 20,
                      borderBottom: "1px solid #e5e7eb",
                      userSelect: "none",
                      fontSize: 13,
                      fontFamily: "system-ui, sans-serif",
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "#111827",
                      lineHeight: 1.4,
                    }}
                  >
                    {documentTitle}
                  </div>
                )}

                <EditorContent editor={editor} className={EDITOR_CLS} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Variables panel ────────────────────────────────────────────── */}
      <div className="w-52 shrink-0 border-l border-zinc-200 bg-white flex flex-col overflow-hidden">
        <div className="px-3 py-2.5 border-b border-zinc-100 flex items-center justify-between gap-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Variables</p>
          <button
            type="button"
            onClick={() => setShowPrompt(true)}
            className="flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-[9px] font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 transition"
          >
            <Copy size={9} />
            del sistema
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">

          {/* Personalizadas — naranja */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">Personalizadas</p>
            <p className="text-[10px] text-amber-800 leading-relaxed">Escribí directamente en el texto:</p>
            <code className="block text-center text-[10px] font-mono font-bold text-amber-900 bg-white border border-amber-200 rounded-lg px-2 py-1.5">
              {"{{nombre_variable}}"}
            </code>
            <p className="text-[10px] text-amber-700 leading-relaxed">Se convierte en chip naranja automáticamente.</p>
          </div>

          {SUGGESTED_VARS.map((group) => (
            <div key={group.group} className="space-y-1.5">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">{group.group}</p>
              <div className="flex flex-col gap-1">
                {group.vars.map((v) => (
                  <div key={v.key} className="group/tip">
                    <button type="button" onClick={() => insertVariable(v.key)}
                      className={`flex w-full items-center gap-1 rounded-lg border px-2 py-1.5 text-left transition hover:brightness-105 ${
                        v.auto
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
                      }`}>
                      <span className="font-mono text-[9px] flex-1 truncate leading-none">
                        {`{{${v.key}}}`}
                      </span>
                      {v.auto && <Info size={10} className="text-emerald-400 shrink-0" />}
                    </button>
                    {v.auto && AUTO_VAR_DESCRIPTIONS[v.key] && (
                      <div className="overflow-hidden max-h-0 group-hover/tip:max-h-24 transition-all duration-200">
                        <p className="mt-1 px-2 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 text-[9px] text-emerald-800 leading-relaxed">
                          <span className="font-semibold block text-emerald-600 mb-0.5">Se completa sola</span>
                          {AUTO_VAR_DESCRIPTIONS[v.key]}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Leyenda */}
          <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 text-[9.5px] text-zinc-500 leading-relaxed space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
              <span>Verde — auto (datos del usuario)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-sky-400 shrink-0" />
              <span>Celeste — sistema predeterminado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
              <span>Naranja — personalizada</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Prompt modal ───────────────────────────────────────────────── */}
      {showPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="relative w-full max-w-lg mx-4 rounded-2xl bg-white shadow-2xl flex flex-col" style={{ maxHeight: "80vh" }}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100">
              <div>
                <p className="text-sm font-semibold text-zinc-800">Variables del sistema</p>
                <p className="text-[10px] text-zinc-400 mt-0.5">Copiá este texto y pegalo en tu IA para redactar el contrato con las variables del sistema.</p>
              </div>
              <button type="button" onClick={() => { setShowPrompt(false); setCopied(false); }}
                className="grid h-7 w-7 place-items-center rounded-lg hover:bg-zinc-100 text-zinc-400 transition">
                <X size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <pre className="text-[10.5px] font-mono text-zinc-700 whitespace-pre-wrap leading-relaxed bg-zinc-50 border border-zinc-100 rounded-xl p-4">
                {SYSTEM_PROMPT}
              </pre>
            </div>
            <div className="px-5 py-3.5 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(SYSTEM_PROMPT).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  });
                }}
                className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition ${
                  copied
                    ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                    : "bg-zinc-900 text-white hover:bg-zinc-700"
                }`}
              >
                {copied ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar al portapapeles</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Preview modal ──────────────────────────────────────────────── */}
      {showPreview && (
        <PreviewModal
          html={editor?.getHTML() ?? ""}
          logoUrl={logoUrl}
          logoHeader={logoHeader}
          logoWatermark={logoWatermark}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}

import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Italic,
  List,
  ListOrdered,
  Minus,
  Strikethrough,
  UnderlineIcon,
} from "lucide-react";

// ─── Suggested variables panel ────────────────────────────────────────────────

const SUGGESTED_VARS: { group: string; vars: { key: string; label: string; auto?: boolean }[] }[] = [
  {
    group: "Usuario (auto)",
    vars: [
      { key: "nombre_usuario",    label: "Nombre",    auto: true },
      { key: "email_usuario",     label: "Email",     auto: true },
      { key: "dni_usuario",       label: "DNI",       auto: true },
      { key: "cuil_usuario",      label: "CUIL",      auto: true },
      { key: "domicilio_usuario", label: "Domicilio", auto: true },
    ],
  },
  {
    group: "Fechas",
    vars: [
      { key: "fecha_inicio",   label: "Inicio" },
      { key: "fecha_fin",      label: "Fin" },
      { key: "fecha_entrega",  label: "Entrega" },
    ],
  },
  {
    group: "Montos",
    vars: [
      { key: "monto",          label: "Monto" },
      { key: "monto_inicial",  label: "Monto inicial" },
      { key: "monto_final",    label: "Monto final" },
      { key: "cuotas",         label: "Cuotas" },
    ],
  },
  {
    group: "Contrato",
    vars: [
      { key: "objeto",      label: "Objeto" },
      { key: "descripcion", label: "Descripción" },
      { key: "ciudad",      label: "Ciudad" },
      { key: "provincia",   label: "Provincia" },
    ],
  },
];

// ─── Toolbar button ───────────────────────────────────────────────────────────

function ToolBtn({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={`grid h-7 w-7 place-items-center rounded text-xs transition
        ${active ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"}`}
    >
      {children}
    </button>
  );
}

// ─── Toolbar ─────────────────────────────────────────────────────────────────

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-zinc-200 bg-zinc-50 px-3 py-2">
      <ToolBtn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrita">
        <Bold size={13} />
      </ToolBtn>
      <ToolBtn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Cursiva">
        <Italic size={13} />
      </ToolBtn>
      <ToolBtn active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Subrayado">
        <UnderlineIcon size={13} />
      </ToolBtn>
      <ToolBtn active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title="Tachado">
        <Strikethrough size={13} />
      </ToolBtn>
      <ToolBtn active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()} title="Código">
        <Code size={13} />
      </ToolBtn>

      <div className="mx-1.5 h-4 w-px bg-zinc-200" />

      {(["left", "center", "right", "justify"] as const).map((a) => {
        const icons = { left: AlignLeft, center: AlignCenter, right: AlignRight, justify: AlignJustify };
        const Icon = icons[a];
        return (
          <ToolBtn key={a} active={editor.isActive({ textAlign: a })}
            onClick={() => editor.chain().focus().setTextAlign(a).run()} title={`Alinear ${a}`}>
            <Icon size={13} />
          </ToolBtn>
        );
      })}

      <div className="mx-1.5 h-4 w-px bg-zinc-200" />

      <ToolBtn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista">
        <List size={13} />
      </ToolBtn>
      <ToolBtn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada">
        <ListOrdered size={13} />
      </ToolBtn>

      <div className="mx-1.5 h-4 w-px bg-zinc-200" />

      {(["h1", "h2", "h3"] as const).map((h, i) => (
        <ToolBtn key={h} active={editor.isActive("heading", { level: i + 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: (i + 1) as 1|2|3 }).run()} title={`Título ${i + 1}`}>
          <span className="text-[10px] font-bold">H{i + 1}</span>
        </ToolBtn>
      ))}

      <ToolBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Línea horizontal">
        <Minus size={13} />
      </ToolBtn>
    </div>
  );
}

// ─── Main editor component ────────────────────────────────────────────────────

interface RichTextEditorProps {
  value:       string;
  onChange:    (html: string) => void;
  placeholder?: string;
  minHeight?:  number;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Redactá el contrato aquí...",
  minHeight = 420,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  });

  function insertVariable(key: string) {
    if (!editor) return;
    editor.chain().focus().insertContent(`{{${key}}}`).run();
  }

  if (!editor) return null;

  return (
    <div className="flex gap-4">
      {/* Editor panel */}
      <div className="flex-1 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        <Toolbar editor={editor} />
        <EditorContent
          editor={editor}
          className="prose prose-sm max-w-none p-5 text-zinc-900 focus-within:outline-none"
          style={{ minHeight }}
        />
      </div>

      {/* Variables side panel */}
      <div className="w-48 shrink-0 space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Variables</p>
        {SUGGESTED_VARS.map((group) => (
          <div key={group.group} className="space-y-1.5">
            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-wide">{group.group}</p>
            <div className="flex flex-col gap-1">
              {group.vars.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => insertVariable(v.key)}
                  title={`Insertar {{${v.key}}}`}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium text-left transition hover:brightness-105
                    ${v.auto
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100"}`}
                >
                  <span className="font-mono text-[10px] opacity-70">{"{{"}</span>
                  <span className="truncate">{v.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 text-[10px] text-zinc-400 leading-relaxed">
          <p className="font-semibold text-zinc-500 mb-1">Variables en verde</p>
          Se completan automáticamente con los datos del usuario asignado.
        </div>
      </div>
    </div>
  );
}

import { useState, useRef, useEffect } from "react";
import { Copy, Plus } from "lucide-react";
import { Button } from "../../../shared/components/ui/Button";

interface ContractEditorProps {
  initialContent?: string;
  onChange: (content: string) => void;
  variables?: string[];
  placeholder?: string;
}

const COMMON_VARIABLES = [
  "{{fecha_inicio}}",
  "{{fecha_final}}",
  "{{monto_inicial}}",
  "{{monto_final}}",
  "{{nombre_usuario}}",
  "{{dni_usuario}}",
  "{{domicilio_usuario}}",
  "{{email_usuario}}",
];

export function ContractEditor({ initialContent = "", onChange, variables = COMMON_VARIABLES, placeholder }: ContractEditorProps) {
  const [content, setContent] = useState(initialContent);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    onChange(e.target.value);
    
    // Auto-resize
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const insertVariable = (variable: string) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const newContent = content.substring(0, start) + variable + content.substring(end);
    setContent(newContent);
    onChange(newContent);
    
    // Focus back and move cursor
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start + variable.length, start + variable.length);
      }
    }, 0);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Editor Surface */}
      <div className="flex-1 bg-zinc-100 p-4 sm:p-8 rounded-2xl overflow-y-auto max-h-[70vh] shadow-inner border border-zinc-200 flex justify-center">
        <div className="w-full max-w-3xl bg-white shadow-sm ring-1 ring-zinc-200 p-8 sm:p-12 min-h-[800px]">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            placeholder={placeholder || "Escribí o pegá el texto del contrato acá..."}
            className="w-full h-full min-h-[700px] resize-none outline-none font-serif text-[13px] leading-7 text-zinc-900 bg-transparent"
          />
        </div>
      </div>

      {/* Variables Sidebar */}
      <div className="w-full lg:w-72 shrink-0 space-y-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="font-bold text-zinc-900 text-sm mb-1">Variables Dinámicas</h3>
          <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
            Hacé clic en una variable para insertarla en el texto, o copiala y pegala. El sistema pedirá estos datos antes de enviar.
          </p>

          <div className="space-y-2">
            {variables.map((v) => (
              <button
                key={v}
                onClick={() => insertVariable(v)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-zinc-100 bg-zinc-50 hover:bg-zinc-100 hover:border-zinc-300 transition group"
                title="Insertar variable"
              >
                <code className="text-[11px] font-mono text-emerald-700 font-semibold">{v}</code>
                <Plus size={14} className="text-zinc-400 group-hover:text-emerald-600 transition" />
              </button>
            ))}
          </div>
        </div>
        
        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-xs text-blue-800 leading-relaxed">
          <strong>Tip:</strong> Puedes crear tus propias variables escribiendo cualquier palabra entre dobles llaves, por ejemplo: <code>{"{{cargo}}"}</code>.
        </div>
      </div>
    </div>
  );
}

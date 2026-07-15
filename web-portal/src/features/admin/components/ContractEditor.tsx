import { useState, useRef, useEffect } from "react";
import { Copy, Info, Plus } from "lucide-react";
import { Button } from "../../../shared/components/ui/Button";
import { AUTO_FILL_VARS } from "../../../shared/services/contractTemplates.service";

const AUTO_VAR_DESCRIPTIONS: Record<string, string> = {
  nombre_usuario:    "Nombre completo del firmante. Se completa automáticamente con los datos del usuario seleccionado.",
  email_usuario:     "Email del firmante. Se toma del perfil del usuario seleccionado.",
  dni_usuario:       "DNI del firmante, verificado durante el proceso KYC.",
  cuil_usuario:      "CUIL/CUIT del firmante, verificado durante el proceso KYC.",
  domicilio_usuario: "Domicilio del firmante, verificado durante el proceso KYC.",
};

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
            {variables.map((v) => {
              const key = v.replace(/[{}]/g, "");
              const isAuto = AUTO_FILL_VARS.has(key);
              const description = AUTO_VAR_DESCRIPTIONS[key];
              return (
                <button
                  key={v}
                  onClick={() => insertVariable(v)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-zinc-100 bg-zinc-50 hover:bg-zinc-100 hover:border-zinc-300 transition group"
                  title="Insertar variable"
                >
                  <code className={`text-[11px] font-mono font-semibold ${isAuto ? "text-emerald-700" : "text-zinc-600"}`}>{v}</code>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isAuto && description && (
                      <span className="relative flex items-center group/tip">
                        <Info size={12} className="text-emerald-400 hover:text-emerald-600 transition cursor-help" />
                        <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 w-52 rounded-lg border border-emerald-100 bg-white p-2.5 text-[10px] leading-relaxed text-zinc-600 shadow-lg opacity-0 group-hover/tip:opacity-100 transition-opacity z-50">
                          <span className="block font-bold text-emerald-600 mb-1">Auto-completada</span>
                          {description}
                        </span>
                      </span>
                    )}
                    <Plus size={14} className="text-zinc-400 group-hover:text-emerald-600 transition" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">Variables propias</p>
          <p className="text-xs text-amber-800 leading-relaxed">
            Podés crear tus propias variables usando el formato:
          </p>
          <code className="block text-center text-sm font-mono font-bold text-amber-900 bg-amber-100 rounded-lg px-3 py-2">
            {"{{nombre_de_variable}}"}
          </code>
          <p className="text-xs text-amber-700 leading-relaxed">
            Al enviar la plantilla, el sistema te pedirá completar cada variable que hayas definido.
          </p>
        </div>
      </div>
    </div>
  );
}

import { CheckCircle, X, XCircle } from "lucide-react";
import { useEffect } from "react";

type ToastType = "success" | "error";

type ToastProps = {
  message: string;
  type: ToastType;
  visible: boolean;
  onClose: () => void;
  duration?: number;
};

export function Toast({ message, type, visible, onClose, duration = 4000 }: ToastProps) {
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [visible, duration, onClose]);

  if (!visible) return null;

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in">
      <div
        className={`flex items-center gap-3 rounded-2xl border px-5 py-4 shadow-2xl backdrop-blur-md transition-all duration-300 ${
          type === "success"
            ? "border-emerald-700 bg-emerald-900/90 text-emerald-200"
            : "border-red-700 bg-red-900/90 text-red-200"
        }`}
      >
        {type === "success" ? (
          <CheckCircle size={20} className="text-emerald-400 shrink-0" />
        ) : (
          <XCircle size={20} className="text-red-400 shrink-0" />
        )}
        <p className="text-sm font-semibold">{message}</p>
        <button
          type="button"
          onClick={onClose}
          className="ml-2 grid h-6 w-6 shrink-0 place-items-center rounded-full hover:bg-black/20 transition"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

import { Component, type ErrorInfo, type ReactNode, useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./app/providers/AuthProvider";
import { ThemeProvider } from "./app/providers/ThemeProvider";
import { AppRouter } from "./app/router/AppRouter";
import { UpdateToast } from "./shared/components/ui/UpdateToast";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="grid min-h-screen place-items-center bg-zinc-50 p-6">
          <div className="max-w-md text-center space-y-4">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-red-100">
              <span className="text-2xl font-bold text-red-400">!</span>
            </div>
            <h2 className="text-xl font-bold text-zinc-950">Algo salió mal</h2>
            <p className="text-sm text-zinc-500 leading-relaxed">
              Ocurrió un error inesperado. Recargá la página para intentar de nuevo.
            </p>
            <pre className="rounded-xl bg-red-50 border border-red-100 p-3 text-xs text-red-700 text-left overflow-auto max-h-32">
              {this.state.error.message}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 transition"
            >
              Recargar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function App() {
  useEffect(() => {
    if (window.top && window.top !== window.self) {
      try {
        window.top.location.href = window.self.location.href;
      } catch (err) {
        console.error("Iframe breakout failed:", err);
      }
    }
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <ErrorBoundary>
            <AppRouter />
            <UpdateToast />
          </ErrorBoundary>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

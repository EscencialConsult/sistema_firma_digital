import { BrowserRouter } from "react-router-dom";
import { PortalShell } from "./app/layouts/PortalShell";
import { AuthProvider } from "./app/providers/AuthProvider";

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PortalShell />
      </AuthProvider>
    </BrowserRouter>
  );
}

import { PortalShell } from "./app/layouts/PortalShell";
import { AuthProvider } from "./app/providers/AuthProvider";

export function App() {
  return (
    <AuthProvider>
      <PortalShell />
    </AuthProvider>
  );
}

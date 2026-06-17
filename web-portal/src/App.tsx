import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./app/providers/AuthProvider";
import { AppRouter } from "./app/router/AppRouter";

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </BrowserRouter>
  );
}

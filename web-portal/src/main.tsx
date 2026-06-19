import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";

// Force reload on dynamic import/chunk loading failures (e.g. after a new deployment)
window.addEventListener("vite:preloadError", () => {
  window.location.reload();
});

window.addEventListener("error", (e) => {
  if (e.message && e.message.includes("Failed to fetch dynamically imported module")) {
    window.location.reload();
  }
}, true);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

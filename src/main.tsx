import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { loadApiConfig } from "./lib/apiConfig";
import "./index.css";

const root = document.getElementById("root")!;

function showBootError(message: string) {
  root.innerHTML = `<div style="padding:24px;font-family:sans-serif;color:#fff;background:#1a3a8f;min-height:100vh"><p>${message}</p></div>`;
}

loadApiConfig()
  .then(() => {
    createRoot(root).render(
      <StrictMode>
        <HashRouter>
          <App />
        </HashRouter>
      </StrictMode>
    );
  })
  .catch(() => {
    showBootError("앱을 불러오지 못했습니다. 새로고침 해 주세요.");
  });

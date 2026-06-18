import "./styles.css";
import { App } from "./game/App";
import { loadModels } from "./game/assets/models";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("Missing #app root.");
}

const loading = document.createElement("div");
loading.textContent = "Loading…";
loading.style.cssText =
  "position:fixed;inset:0;display:grid;place-items:center;color:#cdebd0;" +
  "font:600 18px system-ui,sans-serif;background:#13261c;";
root.appendChild(loading);

loadModels()
  .then(() => {
    loading.remove();
    new App(root);
  })
  .catch((error) => {
    loading.textContent = "Failed to load models.";
    console.error(error);
  });

import "./styles.css";
import { App } from "./game/App";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("Missing #app root.");
}

new App(root);

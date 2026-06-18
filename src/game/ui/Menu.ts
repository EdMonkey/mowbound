export function createButton(label: string, onClick: () => void, className = ""): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.className = className;
  button.addEventListener("click", onClick);
  return button;
}

export function clearElement(element: HTMLElement): void {
  while (element.firstChild) {
    element.firstChild.remove();
  }
}

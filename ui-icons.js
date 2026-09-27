// The interface's small drawn icons (the SVG pictures near the top of
// index.html, like "basket", "moon" or "sun"), for use from code instead
// of emoji. uiIcon("moon") gives the HTML for one; `cls` adds a class
// (like "header-icon" for the bigger header ones).
export function uiIcon(name, cls = "") {
  const href = name === "nook-bird" ? "#nook-bird" : `#ic-${name}`;
  return `<svg class="ui-icon${cls ? " " + cls : ""}" aria-hidden="true"><use href="${href}"></use></svg>`;
}

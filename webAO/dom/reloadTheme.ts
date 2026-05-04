import { client } from "../client";

/**
 * Triggered by the theme selector.
 */
export const reloadTheme = () => {
  client.viewport.setTheme(
    (<HTMLSelectElement>document.getElementById("client_themeselect")).value,
  );

  localStorage.setItem("theme", client.viewport.getTheme());
  (<HTMLAnchorElement>document.getElementById("client_theme")).href =
    `styles/${client.viewport.getTheme()}.css`;
};
window.reloadTheme = reloadTheme;

import { client } from "../client";
import { AO_HOST } from "../client/aoHost";
import { resolveAndPreloadImage } from "../utils/assetCache";

const PREVIEW_OFFSET = 16;

let previewEl: HTMLImageElement | null = null;
let activeButton: HTMLElement | null = null;
let activeToken = 0;

function buildIdleUrls(charactername: string, emotename: string): string[] {
  const characterFolder = `${AO_HOST}characters/`;
  const urls: string[] = [];
  for (const extension of client.emote_extensions) {
    if (extension === ".png") {
      urls.push(`${characterFolder}${encodeURI(charactername)}/${encodeURI(emotename)}${extension}`);
    } else if (extension === ".webp.static") {
      urls.push(`${characterFolder}${encodeURI(charactername)}/${encodeURI(emotename)}.webp`);
    } else {
      urls.push(`${characterFolder}${encodeURI(charactername)}/(a)${encodeURI(emotename)}${extension}`);
    }
  }
  return urls;
}

function ensurePreviewEl(): HTMLImageElement {
  if (previewEl) return previewEl;
  const el = document.createElement("img");
  el.id = "sprite_preview";
  el.style.display = "none";
  document.body.appendChild(el);
  previewEl = el;
  return el;
}

function positionPreview(event: MouseEvent) {
  if (!previewEl || previewEl.style.display === "none") return;
  const width = previewEl.offsetWidth || 192;
  const height = previewEl.offsetHeight || 192;
  let x = event.clientX + PREVIEW_OFFSET;
  let y = event.clientY + PREVIEW_OFFSET;
  if (x + width > window.innerWidth) x = event.clientX - width - PREVIEW_OFFSET;
  if (y + height > window.innerHeight) y = event.clientY - height - PREVIEW_OFFSET;
  if (x < 0) x = 0;
  if (y < 0) y = 0;
  previewEl.style.left = `${x}px`;
  previewEl.style.top = `${y}px`;
}

function hidePreview() {
  activeButton = null;
  activeToken++;
  if (previewEl) {
    previewEl.style.display = "none";
    previewEl.removeAttribute("src");
  }
}

export function attachSpritePreview(
  button: HTMLElement,
  charactername: string,
  emotename: string,
) {
  button.addEventListener("mouseenter", async (event) => {
    activeButton = button;
    const token = ++activeToken;
    positionPreview(event as MouseEvent);

    const url = await resolveAndPreloadImage(buildIdleUrls(charactername, emotename));
    if (token !== activeToken || activeButton !== button) return;

    const el = ensurePreviewEl();
    el.src = url;
    el.style.display = "block";
    positionPreview(event as MouseEvent);
  });

  button.addEventListener("mousemove", (event) => {
    positionPreview(event as MouseEvent);
  });

  button.addEventListener("mouseleave", () => {
    if (activeButton === button) hidePreview();
  });
}

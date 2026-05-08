import { useEffect } from "react";

const SITE_URL = "https://www.toutsuitannonce.com";
const DEFAULT_IMAGE = `${SITE_URL}/icon-512.png`;

const upsertMeta = (selector: string, attrs: Record<string, string>) => {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    Object.entries(attrs).forEach(([k, v]) => k !== "content" && el!.setAttribute(k, v));
    document.head.appendChild(el);
  }
  el.setAttribute("content", attrs.content);
};

const upsertLink = (rel: string, href: string) => {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
};

const setJsonLd = (id: string, data: unknown | null) => {
  let el = document.head.querySelector<HTMLScriptElement>(`script[data-seo="${id}"]`);
  if (!data) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("script");
    el.type = "application/ld+json";
    el.setAttribute("data-seo", id);
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
};

export interface SEOOptions {
  title: string;
  description: string;
  canonical?: string;
  image?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

export const useSEO = ({ title, description, canonical, image, jsonLd }: SEOOptions) => {
  useEffect(() => {
    document.title = title;
    upsertMeta('meta[name="description"]', { name: "description", content: description });
    upsertMeta('meta[property="og:title"]', { property: "og:title", content: title });
    upsertMeta('meta[property="og:description"]', { property: "og:description", content: description });
    upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: title });
    upsertMeta('meta[name="twitter:description"]', { name: "twitter:description", content: description });
    if (image) {
      upsertMeta('meta[property="og:image"]', { property: "og:image", content: image });
      upsertMeta('meta[name="twitter:image"]', { name: "twitter:image", content: image });
    }
    const url = canonical ?? `${SITE_URL}${window.location.pathname}`;
    upsertLink("canonical", url);
    upsertMeta('meta[property="og:url"]', { property: "og:url", content: url });
    setJsonLd("page", jsonLd ?? null);
  }, [title, description, canonical, image, JSON.stringify(jsonLd)]);
};

export { SITE_URL, DEFAULT_IMAGE };

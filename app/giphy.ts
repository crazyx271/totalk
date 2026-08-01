const GIPHY_HOST_PATTERN = /^([a-z0-9-]+\.)?giphy\.com$/i;

export function isGiphyUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    return GIPHY_HOST_PATTERN.test(url.hostname);
  } catch {
    return false;
  }
}

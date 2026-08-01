const SERVER_HUE_COUNT = 6;

export function serverHueClass(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index++) hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  return `hue-${hash % SERVER_HUE_COUNT}`;
}

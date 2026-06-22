const CHIP_TEXT = '#41493E';

function namePill(name: string): any {
  const short = name.length > 14 ? name.slice(0, 13) + '…' : name;
  return { type: 'text', text: `👤 ${short}`, size: 'xs', color: CHIP_TEXT, weight: 'bold', flex: 0, gravity: 'center', align: 'end', wrap: false };
}

function titleRowOf(box: any): any {
  if (!box?.contents || !Array.isArray(box.contents)) return null;
  return box.contents.find((c: any) => c?.type === 'box' && c.layout === 'horizontal'
    && Array.isArray(c.contents) && c.contents.some((k: any) => k?.type === 'text')) || null;
}

function injectBubble(bubble: any, name: string): any {
  const pill = namePill(name);
  for (const slot of ['header', 'body'] as const) {
    const box = bubble[slot];
    const row = titleRowOf(box);
    if (row) {
      const newRow = { ...row, contents: [...row.contents, pill] };
      return { ...bubble, [slot]: { ...box, contents: box.contents.map((c: any) => (c === row ? newRow : c)) } };
    }
  }
  const line = { type: 'text', text: `👤 ${name}`, size: 'xxs', color: CHIP_TEXT, weight: 'bold' };
  if (bubble.body?.contents) return { ...bubble, body: { ...bubble.body, contents: [line, ...bubble.body.contents] } };
  if (bubble.header?.contents) return { ...bubble, header: { ...bubble.header, contents: [line, ...bubble.header.contents] } };
  return { ...bubble, body: { type: 'box', layout: 'vertical', paddingAll: '8px', contents: [line] } };
}

function injectFlex(contents: any, name: string): any {
  if (contents.type === 'carousel' && Array.isArray(contents.contents) && contents.contents.length) {
    return { ...contents, contents: [injectBubble(contents.contents[0], name), ...contents.contents.slice(1)] };
  }
  if (contents.type === 'bubble') return injectBubble(contents, name);
  return contents;
}

export function tagName(messages: any[], name: string): any[] {
  if (!messages?.length) return messages;
  const fi = messages.findIndex((m: any) => m?.type === 'flex' && m.contents);
  if (fi >= 0) {
    const out = [...messages];
    out[fi] = { ...messages[fi], contents: injectFlex(messages[fi].contents, name) };
    return out;
  }
  const first = messages[0];
  if (first?.type === 'text' && typeof first.text === 'string') {
    return [{ ...first, text: `👤 ${name}\n${first.text}` }, ...messages.slice(1)];
  }
  return messages;
}

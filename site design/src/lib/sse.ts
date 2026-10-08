/** Read a text/event-stream response and call onEvent for every frame (comments and keep-alives skipped). */
export async function readSse(
  res: Response,
  onEvent: (event: string, data: Record<string, unknown>) => void,
): Promise<void> {
  if (!res.body) throw new Error("The stream did not open.");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buf.search(/\r?\n\r?\n/)) >= 0) {
      const block = buf.slice(0, sep);
      buf = buf.slice(sep).replace(/^\r?\n\r?\n/, "");
      let event = "message";
      const lines: string[] = [];
      for (const line of block.split(/\r?\n/)) {
        if (line.startsWith(":")) continue;
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) lines.push(line.slice(5).replace(/^ /, ""));
      }
      if (!lines.length) continue;
      try {
        const data = JSON.parse(lines.join("\n")) as Record<string, unknown>;
        if (event === "message" && typeof data.event_type === "string") event = data.event_type;
        onEvent(event, data);
      } catch {
        /* a broken frame is skipped */
      }
    }
  }
}

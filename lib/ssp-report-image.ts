type ReportEntry = { before: string; answer: string };

/** Render locally so students' answers never need to leave their browser. */
export async function createReportImage(entries: ReportEntry[]): Promise<Blob> {
  await document.fonts.ready;
  const font = getComputedStyle(document.body).fontFamily;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image export is unavailable.");

  const width = 900;
  const margin = 56;
  const textX = margin + 58;
  const textWidth = width - textX - margin;
  const lineHeight = 36;
  const textFont = `24px ${font}`;
  ctx.font = textFont;

  function wrap(text: string): string[] {
    const lines: string[] = [];
    let line = "";
    // Split unusually long words too, so every answer remains inside the page.
    for (const word of text.trim().split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx!.measureText(candidate).width <= textWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = "";
      for (const character of Array.from(word)) {
        if (line && ctx!.measureText(line + character).width > textWidth) {
          lines.push(line);
          line = "";
        }
        line += character;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  const rows = entries.map(({ before, answer }) => {
    const clean = answer.trim();
    const lines = wrap(`${before} ${clean}${/[.!?]$/.test(clean) ? "" : "."}`);
    return { lines, height: lines.length * lineHeight + 50 };
  });
  const contentTop = 328;
  const footerTop = contentTop + rows.reduce((total, row) => total + row.height, 0) + 12;
  const height = footerTop + 128;
  // Twice the layout resolution keeps lettering crisp when saved or shared.
  canvas.width = width * 2;
  canvas.height = height * 2;
  ctx.scale(2, 2);
  ctx.textBaseline = "top";
  ctx.fillStyle = "#F6F3EC";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#0B2418";
  ctx.fillRect(0, 0, width, 238);
  ctx.fillStyle = "#C9A227";
  ctx.fillRect(0, 238, width, 6);
  ctx.font = `500 18px ${font}`;
  ctx.fillStyle = "#E4C766";
  ctx.fillText("GREEN ENGINEERING ACADEMY", margin, 42);
  ctx.font = `700 48px ${font}`;
  ctx.fillStyle = "#F6F3EC";
  ctx.fillText("Our shake-test report", margin, 91);
  ctx.font = `24px ${font}`;
  ctx.fillText("Science at Stockmens Park", margin, 163);
  ctx.font = `18px ${font}`;
  ctx.fillStyle = "#123524";
  ctx.fillText("Spaghetti + marshmallows + tape · 10-minute build", margin, 276);

  let y = contentTop;
  rows.forEach((row, index) => {
    ctx.strokeStyle = "#D5D9CE";
    ctx.beginPath();
    ctx.moveTo(margin, y);
    ctx.lineTo(width - margin, y);
    ctx.stroke();
    ctx.fillStyle = "#123524";
    ctx.beginPath();
    ctx.arc(margin + 18, y + 42, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#F6F3EC";
    ctx.font = `500 18px ${font}`;
    ctx.textAlign = "center";
    ctx.fillText(String(index + 1), margin + 18, y + 32);
    ctx.textAlign = "left";
    ctx.font = textFont;
    ctx.fillStyle = "#0B2418";
    row.lines.forEach((line, lineIndex) => ctx.fillText(line, textX, y + 25 + lineIndex * lineHeight));
    y += row.height;
  });

  ctx.fillStyle = "#E8ECE3";
  ctx.fillRect(0, footerTop, width, height - footerTop);
  ctx.fillStyle = "#0B2418";
  ctx.font = `500 24px ${font}`;
  ctx.fillText("Build. Test. Learn. Improve.", margin, footerTop + 30);
  ctx.font = `18px ${font}`;
  ctx.fillText("livermoregea.org", margin, footerTop + 75);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not create the report image.")), "image/png");
  });
}

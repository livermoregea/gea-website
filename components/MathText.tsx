import katex from "katex";

function normalizeMath(input: string) {
  return input
    .replace(/≤/g, "\\le ")
    .replace(/≥/g, "\\ge ")
    .replace(/≠/g, "\\ne ")
    .replace(/≈/g, "\\approx ")
    .replace(/×/g, "\\times ")
    .replace(/÷/g, "\\div ")
    .replace(/±/g, "\\pm ")
    .replace(/∓/g, "\\mp ")
    .replace(/∞/g, "\\infty ")
    .replace(/π/g, "\\pi ")
    .replace(/θ/g, "\\theta ")
    .replace(/λ/g, "\\lambda ")
    .replace(/μ/g, "\\mu ")
    .trim();
}

function renderMath(input: string, displayMode: boolean) {
  return katex.renderToString(normalizeMath(input), {
    displayMode,
    throwOnError: false,
    strict: "ignore",
  });
}

function isStandaloneMathLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  return (
    /^[^A-Za-z]*[A-Za-z0-9π∞√][A-Za-z0-9π∞√\s()[\]{}.,]*[+\-*/=<>^_][A-Za-z0-9π∞√\s()[\]{}.,]*$/.test(trimmed) ||
    /^\\[A-Za-z]+/.test(trimmed) ||
    /^[0-9]+\s*[+\-*/=<>^_]\s*[0-9A-Za-zπ∞√(){}\[\].,\s]+$/.test(trimmed)
  );
}

function splitInlineMath(line: string) {
  const pattern = /(^|[\s([{>])([A-Za-z0-9π∞√]+(?:\s*[+\-*/=<>^_]\s*[A-Za-z0-9π∞√(){}\[\].,]+)+)(?=$|[\s)\]}.,;:!?])/g;
  const parts: Array<{ type: "text" | "math"; value: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: line.slice(lastIndex, match.index) });
    }
    if (match[1]) {
      parts.push({ type: "text", value: match[1] });
    }
    parts.push({ type: "math", value: match[2] });
    lastIndex = match.index + match[0].length;
  }

  if (parts.length === 0) {
    return [{ type: "text" as const, value: line }];
  }

  if (lastIndex < line.length) {
    parts.push({ type: "text", value: line.slice(lastIndex) });
  }

  return parts;
}

function renderLine(line: string, key: string) {
  if (line.trim().length === 0) {
    return <br key={key} />;
  }

  if (isStandaloneMathLine(line)) {
    return (
      <span
        key={key}
        className="block overflow-x-auto py-1"
        dangerouslySetInnerHTML={{ __html: renderMath(line, true) }}
      />
    );
  }

  const parts = splitInlineMath(line);

  return (
    <span key={key}>
      {parts.map((part, index) =>
        part.type === "math" ? (
          <span
            key={`${key}-math-${index}`}
            className="align-baseline"
            dangerouslySetInnerHTML={{ __html: renderMath(part.value, false) }}
          />
        ) : (
          <span key={`${key}-text-${index}`}>{part.value}</span>
        )
      )}
    </span>
  );
}

export default function MathText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const lines = text.split(/\r?\n/);

  return (
    <div className={className}>
      {lines.map((line, index) => (
        <span key={`${index}`} className="block whitespace-pre-wrap">
          {renderLine(line, `${index}`)}
        </span>
      ))}
    </div>
  );
}

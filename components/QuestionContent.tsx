export default function QuestionContent({
  question,
  className = "",
}: {
  question: string;
  className?: string;
}) {
  return (
    <div className={`space-y-3 ${className}`.trim()}>
      <p className="whitespace-pre-wrap text-base leading-relaxed text-forest">
        {question || "No question text provided."}
      </p>
    </div>
  );
}

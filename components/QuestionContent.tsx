export default function QuestionContent({
  question,
  className = "",
}: {
  question: string;
  className?: string;
}) {
  return (
    <div className={`space-y-3 ${className}`.trim()}>
      <p className="font-display text-base text-forest whitespace-pre-wrap">
        {question || "No question text provided."}
      </p>
    </div>
  );
}

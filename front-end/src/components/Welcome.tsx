import {
  ArrowUpRight,
  BookOpen,
  ListChecks,
  ScanText,
  Sparkles,
} from "lucide-react";

const examples = [
  {
    icon: ScanText,
    title: "快速掌握全貌",
    description: "提炼核心观点，把长文读薄",
    question: "请总结已上传文档的核心内容，并列出关键观点。",
  },
  {
    icon: ListChecks,
    title: "找到关键细节",
    description: "从资料中梳理信息与待办",
    question: "文档中提到了哪些重要任务和要求？请逐项整理。",
  },
  {
    icon: BookOpen,
    title: "深入理解内容",
    description: "理清概念，读懂背后的联系",
    question: "请解释文档中的关键概念，以及它们之间的关系。",
  },
];
export function Welcome({
  onExample,
  hasDocuments,
}: {
  onExample: (question: string) => void;
  hasDocuments: boolean;
}) {
  return (
    <section className="welcome">
      <div className="welcome-symbol">
        <BookOpen size={34} strokeWidth={1.35} />
        <span>
          <Sparkles size={13} />
        </span>
      </div>
      <div className="eyebrow">YOUR DOCUMENTS. YOUR INSIGHTS.</div>
      <h1>让文档，成为答案。</h1>
      <p className="welcome-description">
        从一份资料，到一个清晰的答案。
        <br />
        {hasDocuments
          ? "你的资料已就绪，现在开始探索其中的知识。"
          : "上传你的文档，让 AI 帮你梳理、理解与发现。"}
      </p>
      <div className="suggestion-label">从一个好问题开始</div>
      <div className="suggestions">
        {examples.map(({ icon: Icon, title, description, question }) => (
          <button
            key={title}
            onClick={() => onExample(question)}
            className="suggestion"
          >
            <Icon size={20} strokeWidth={1.5} />
            <strong>
              {title}
              <ArrowUpRight size={15} />
            </strong>
            <span>{description}</span>
          </button>
        ))}
      </div>
      <div className="welcome-footnote">
        <span className="tiny-dot" />
        连接你的资料，专注你的问题
      </div>
    </section>
  );
}

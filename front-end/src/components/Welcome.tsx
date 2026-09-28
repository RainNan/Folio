import { ArrowUpRight, FileText, ListChecks, Quote } from "lucide-react";
const examples = [
  {
    icon: FileText,
    title: "读懂一份文档",
    question: "请总结已上传文档的核心内容，并列出关键观点。",
  },
  {
    icon: ListChecks,
    title: "梳理任务与要求",
    question: "文档中提到了哪些重要任务和要求？请逐项整理。",
  },
  {
    icon: Quote,
    title: "解释一个概念",
    question: "请解释文档中的关键概念，以及它们之间的关系。",
  },
];
export function Welcome({
  onExample,
  hasDocuments,
  onLibrary,
}: {
  onExample: (question: string) => void;
  hasDocuments: boolean;
  onLibrary: () => void;
}) {
  return (
    <section className="welcome">
      <div className="folio-emblem" aria-hidden="true">
        <span />
        <span />
        <span />
        <i>F</i>
      </div>
      <h1>给你的文档，一个好问题。</h1>
      <p className="welcome-description">
        把散落的信息，读成清晰的思路。
        <br />
        {hasDocuments
          ? "资料已就绪，从你关心的地方开始。"
          : "先放入一份资料，再聊聊你想知道的事。"}
      </p>
      {!hasDocuments && (
        <button className="text-button" onClick={onLibrary}>
          添加第一份文档 <ArrowUpRight size={16} />
        </button>
      )}
      <div className="suggestions">
        {examples.map(({ icon: Icon, title, question }) => (
          <button
            key={title}
            className="suggestion"
            onClick={() => onExample(question)}
          >
            <Icon size={19} />
            <span>{title}</span>
            <ArrowUpRight size={15} />
          </button>
        ))}
      </div>
    </section>
  );
}

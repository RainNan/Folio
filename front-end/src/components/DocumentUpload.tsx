import { useRef, useState } from "react";
import { LoaderCircle, Plus, Upload } from "lucide-react";

interface Props {
  busy: boolean;
  uploading: boolean;
  onUpload: (file: File) => Promise<void>;
}
export function DocumentUpload({ busy, uploading, onUpload }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  return (
    <div
      className={`upload-zone ${dragging ? "dragging" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        if (!busy) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files[0];
        if (file && !busy) void onUpload(file);
      }}
    >
      <input
        ref={input}
        className="visually-hidden"
        type="file"
        accept=".txt,.md,.pdf,.docx"
        disabled={busy}
        aria-label="选择上传文档"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onUpload(file);
          event.target.value = "";
        }}
      />
      <button
        className="upload-button"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        {uploading ? (
          <LoaderCircle size={17} className="spin" />
        ) : dragging ? (
          <Upload size={17} />
        ) : (
          <Plus size={18} />
        )}
        {uploading ? "正在解析并建立索引…" : "上传文档"}
      </button>
      <p>{uploading ? "文档就绪后即可开始提问" : "或将文件拖放到这里"}</p>
      <span>TXT · MD · PDF · DOCX / 最大 10 MiB</span>
      <p className="upload-source-hint">DOCX 将转换并保存为 PDF，供核对来源页码。</p>
    </div>
  );
}

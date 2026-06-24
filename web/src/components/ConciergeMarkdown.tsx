import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  content: string;
}

export function ConciergeMarkdown({ content }: Props) {
  return (
    <div className="concierge-md text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
        em: ({ children }) => <em className="italic text-slate-700">{children}</em>,
        ul: ({ children }) => <ul className="mb-2 list-disc pl-4 space-y-1 last:mb-0">{children}</ul>,
        ol: ({ children }) => <ol className="mb-2 list-decimal pl-4 space-y-1 last:mb-0">{children}</ol>,
        li: ({ children }) => <li className="text-slate-800">{children}</li>,
        h1: ({ children }) => <h3 className="mb-1.5 mt-2 text-sm font-bold text-slate-900 first:mt-0">{children}</h3>,
        h2: ({ children }) => <h4 className="mb-1.5 mt-2 text-sm font-bold text-slate-900 first:mt-0">{children}</h4>,
        h3: ({ children }) => <h5 className="mb-1 mt-1.5 text-xs font-bold uppercase tracking-wide text-emerald-800 first:mt-0">{children}</h5>,
        hr: () => <hr className="my-2 border-slate-200" />,
        blockquote: ({ children }) => (
          <blockquote className="my-2 border-l-2 border-emerald-300 pl-3 text-slate-600">{children}</blockquote>
        ),
        code: ({ className, children }) => {
          const inline = !className;
          if (inline) {
            return (
              <code className="rounded bg-slate-200/80 px-1 py-0.5 text-[11px] font-mono text-slate-800">{children}</code>
            );
          }
          return (
            <code className="block overflow-x-auto rounded-md bg-slate-800 px-2 py-1.5 text-[11px] font-mono text-slate-100">
              {children}
            </code>
          );
        },
        pre: ({ children }) => <pre className="my-2 overflow-x-auto rounded-md last:mb-0">{children}</pre>,
        table: ({ children }) => (
          <div className="my-2 overflow-x-auto rounded-md border border-slate-200 last:mb-0">
            <table className="min-w-full text-left text-[11px]">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-emerald-50 text-emerald-900">{children}</thead>,
        th: ({ children }) => <th className="px-2 py-1.5 font-semibold">{children}</th>,
        td: ({ children }) => <td className="border-t border-slate-100 px-2 py-1.5 text-slate-700">{children}</td>,
        tr: ({ children }) => <tr className="even:bg-slate-50/80">{children}</tr>,
        a: ({ href, children }) => (
          <a href={href} className="text-emerald-700 underline underline-offset-2 hover:text-emerald-900" target="_blank" rel="noreferrer">
            {children}
          </a>
        ),
      }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

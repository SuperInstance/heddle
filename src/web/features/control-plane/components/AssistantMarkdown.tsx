import ReactMarkdown, { type Components } from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

const markdownComponents: Components = {
  a: ({ node: _node, ...props }) => (
    <a {...props} target="_blank" rel="noreferrer noopener" />
  ),
};

export function AssistantMarkdown({ markdown }: { markdown: string }) {
  return (
    <div className="assistant-markdown">
      <ReactMarkdown
        components={markdownComponents}
        remarkPlugins={[remarkGfm, remarkBreaks]}
        skipHtml
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

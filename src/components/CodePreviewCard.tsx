import { useState, useMemo } from 'react';
import { Code, Eye, EyeOff, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CodePreviewCardProps {
  artifactId: string;
  title: string;
  html?: string;
  css?: string;
  js?: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildFullDocument(html?: string, css?: string, js?: string): string {
  if (html && html.trim().startsWith('<!DOCTYPE')) {
    return html;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
${css ?? ''}
</style>
</head>
<body>
${html ?? ''}
<script>
${js ?? ''}
</script>
</body>
</html>`;
}

export function CodePreviewCard({ artifactId, title, html, css, js }: CodePreviewCardProps) {
  const [showPreview, setShowPreview] = useState(false);

  const fullDocument = useMemo(
    () => buildFullDocument(html, css, js),
    [html, css, js],
  );

  function handleDownload() {
    const blob = new Blob([fullDocument], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${slugify(title)}.html`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  return (
    <div
      data-artifact-id={artifactId}
      className="border border-[#00F0FF]/30 bg-[#06060B] rounded-xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#00F0FF]/20">
        <div className="flex items-center gap-2 min-w-0">
          <Code className="size-4 shrink-0 text-[#00F0FF]" />
          <span className="text-sm font-medium text-[#E8E8F0] truncate">
            {title}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPreview((prev) => !prev)}
            className="text-[#6B7280] hover:text-[#E8E8F0] hover:bg-[#00F0FF]/10"
          >
            {showPreview ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
            <span className="text-xs">Preview</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            className="text-[#6B7280] hover:text-[#E8E8F0] hover:bg-[#00F0FF]/10"
          >
            <Download className="size-4" />
            <span className="text-xs">Download</span>
          </Button>
        </div>
      </div>

      {/* Preview iframe */}
      {showPreview && (
        <div className="w-full bg-white">
          <iframe
            title={title}
            srcDoc={fullDocument}
            sandbox="allow-scripts"
            className="w-full border-0"
            style={{ height: 400 }}
          />
        </div>
      )}
    </div>
  );
}

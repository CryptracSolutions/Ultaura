type Heading = { level: number; text: string; id: string };

export default function TableOfContents({ headings }: { headings?: Heading[] }) {
  if (!headings || headings.length === 0) return null;

  return (
    <details className="border border-border rounded-lg bg-card p-5 mt-8 group">
      <summary className="flex items-center justify-between cursor-pointer list-none font-medium text-foreground">
        <span>Table of Contents</span>
        <svg
          className="h-5 w-5 text-muted-foreground transition-transform group-open:rotate-180"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </summary>

      <nav className="mt-4 flex flex-col gap-2">
        {headings.map((heading) => (
          <a
            key={heading.id}
            href={`#${heading.id}`}
            className={`text-sm text-muted-foreground hover:text-primary transition-colors ${
              heading.level === 3 ? 'pl-4' : 'font-medium'
            }`}
          >
            {heading.text}
          </a>
        ))}
      </nav>
    </details>
  );
}

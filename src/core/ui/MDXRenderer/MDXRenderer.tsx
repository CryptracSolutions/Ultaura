import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as _jsx_runtime from 'react/jsx-runtime';
import type { MDXComponents } from 'mdx/types';
import styles from './MDXRenderer.module.css';
import Components from './MDXComponents';

const mdxRuntime = {
  React,
  ReactDOM,
  _jsx_runtime,
};

function getMDXComponent(code: string) {
  // eslint-disable-next-line no-new-func -- MDX compiler output is trusted at build time.
  const fn = new Function(
    ...Object.keys(mdxRuntime),
    `${code}\nreturn MDXContent;`,
  );
  const result = fn(...Object.values(mdxRuntime)) as
    | { default: React.ComponentType<{ components?: MDXComponents }> }
    | React.ComponentType<{ components?: MDXComponents }>;

  return 'default' in result ? result.default : result;
}

function Mdx({
  code,
}: React.PropsWithChildren<{
  code: string;
}>) {
  const Component = getMDXComponent(code);

  return (
    <div className={styles['MDX']}>
      <Component components={Components as unknown as MDXComponents} />
    </div>
  );
}

export default Mdx;

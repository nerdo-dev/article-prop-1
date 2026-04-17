import {
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  toolbarPlugin,
  UndoRedo,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  CreateLink,
  linkPlugin,
  linkDialogPlugin,
  type MDXEditorMethods,
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import type { MutableRefObject } from 'react';

export type ProposalEditorHandle = Pick<MDXEditorMethods, 'setMarkdown'>;

type ProposalEditorProps = {
  editorRef: MutableRefObject<ProposalEditorHandle | null>;
  markdown: string;
  onChange: (value: string) => void;
};

export default function ProposalEditor({
  editorRef,
  markdown,
  onChange,
}: ProposalEditorProps) {
  return (
    <MDXEditor
      ref={(instance) => {
        editorRef.current = instance;
      }}
      markdown={markdown}
      onChange={onChange}
      className="mdxeditor-dark dark-theme dark-editor"
      plugins={[
        headingsPlugin(),
        listsPlugin(),
        quotePlugin(),
        thematicBreakPlugin(),
        markdownShortcutPlugin(),
        linkPlugin(),
        linkDialogPlugin(),
        toolbarPlugin({
          toolbarContents: () => (
            <>
              <UndoRedo />
              <BoldItalicUnderlineToggles />
              <BlockTypeSelect />
              <CreateLink />
            </>
          ),
        }),
      ]}
    />
  );
}

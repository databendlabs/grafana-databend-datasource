import React, { useState } from 'react';
import { QueryEditorProps } from '@grafana/data';
import { DataSource } from '../datasource';
import { styles } from 'styles';
import { DatabendOptions, DatabendQuery } from '../types/sql';
import { CodeEditor } from '@grafana/ui';

type Props = QueryEditorProps<DataSource, DatabendQuery, DatabendOptions>;

interface Expand {
  height: string;
  icon: 'plus' | 'minus';
  on: boolean;
}

export const QueryEditor = (props: Props) => {
  const defaultHeight = '150px';
  const { query, onChange } = props;
  const [codeEditor, setCodeEditor] = useState<any>();
  const [expand, setExpand] = useState<Expand>({
    height: defaultHeight,
    icon: 'plus',
    on: query.expand || false,
  });
  const saveChanges = (changes: Partial<DatabendQuery>) => {
    onChange({
      ...query,

      ...changes
    });
  }

  const updateExpand = (expand: Expand) => {
    setExpand(expand);
    saveChanges({ expand: expand.on });
  }

  const onToggleExpand = () => {
    const on = !expand.on;
    const icon = on ? 'minus' : 'plus';

    if (!codeEditor) {
      return;
    }
    if (on) {
      codeEditor.expanded = true;
      const height = getEditorHeight(codeEditor);
      updateExpand({ height: `${height}px`, on, icon });
      return;
    }

    codeEditor.expanded = false;
    updateExpand({ height: defaultHeight, icon, on });
  };

  const handleMount = (editor: any) => {
    editor.expanded = query.expand;
    editor.onDidChangeModelDecorations((a: any) => {
      if (editor.expanded) {
        const height = getEditorHeight(editor);
        updateExpand({ height: `${height}px`, on: true, icon: 'minus' });
      }
    });
    setCodeEditor(editor);
  };

  return (
    <>
      <div className={styles.Common.wrapper}>
        <a
          onClick={() => onToggleExpand()}
          className={styles.Common.expand}
          data-testid={'data-testid-code-editor-expand-button'}
        >
          <i className={`fa fa-${expand.icon}`}></i>
        </a>
        <CodeEditor
          aria-label="SQL Editor"
          height={expand.height}
          language="sql"
          value={query.rawSql}
          onSave={sql => saveChanges({ rawSql: sql })}
          showMiniMap={false}
          showLineNumbers={true}
          onBlur={sql => saveChanges({ rawSql: sql })}
          onEditorDidMount={(editor: any) => handleMount(editor)}
        />
      </div>
    </>
  );
};

const getEditorHeight = (editor: any): number | undefined => {
  const editorElement = editor.getDomNode();
  if (!editorElement) {
    return;
  }

  const lineCount = editor.getModel()?.getLineCount() || 1;
  return editor.getTopForLineNumber(lineCount + 1) + 40;
};

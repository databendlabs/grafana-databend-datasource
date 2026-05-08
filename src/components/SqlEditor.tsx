import React, { useRef, useState } from 'react';
import { CodeEditor, IconButton, HorizontalGroup, Tooltip, Icon } from '@grafana/ui';
import { DatabendQuery, QueryType } from '../types/sql';
import { styles } from '../styles';

interface SqlEditorProps {
  query: DatabendQuery;
  onChange: (query: DatabendQuery) => void;
  onRunQuery: () => void;
  queryType?: QueryType;
  onQueryTypeChange?: (queryType: QueryType) => void;
}

export const SqlEditor: React.FC<SqlEditorProps> = ({ query, onChange, onRunQuery, queryType, onQueryTypeChange }) => {
  const editorRef = useRef<any>(null);
  const [expanded, setExpanded] = useState<boolean>((query as any).expand || false);

  const saveChanges = (changes: Partial<DatabendQuery>) => {
    onChange({
      ...query,
      ...changes,
    } as DatabendQuery);
  };

  const handleMount = (editor: any, monaco: any) => {
    editorRef.current = editor;

    editor.addAction({
      id: 'run-query',
      label: 'Run Query',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.5,
      run: (ed: any) => {
        saveChanges({ rawSql: ed.getValue() });
        onRunQuery();
      },
    });
  };

  const triggerFormat = () => {
    if (editorRef.current !== null) {
      editorRef.current.trigger('editor', 'editor.action.formatDocument', '');
    }
  };

  return (
    <>
      <div className={styles.Common.wrapper}>
        <a
          onClick={() => {
            setExpanded(!expanded);
            saveChanges({ expand: !expanded } as any);
          }}
          className={styles.Common.expand}
          data-testid="code-editor-expand-button"
        >
          <i className={`fa fa-${expanded ? 'minus' : 'plus'}`}></i>
        </a>
        <CodeEditor
          aria-label="SQL Editor"
          height={expanded ? '300px' : '150px'}
          language="sql"
          value={query.rawSql}
          onSave={(sql) => saveChanges({ rawSql: sql })}
          showMiniMap={false}
          showLineNumbers={true}
          onBlur={(sql) => saveChanges({ rawSql: sql })}
          onEditorDidMount={handleMount}
        />
        <div className={styles.Common.toolbox}>
          <HorizontalGroup>
            <IconButton
              onClick={triggerFormat}
              name="brackets-curly"
              size="xs"
              tooltip="Format query"
              aria-label="Format query"
            />
            <Tooltip content="Hit CTRL/CMD+Return to run query">
              <Icon name="keyboard" />
            </Tooltip>
          </HorizontalGroup>
        </div>
      </div>
    </>
  );
};

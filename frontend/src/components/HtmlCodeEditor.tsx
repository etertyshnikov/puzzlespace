import { forwardRef, useImperativeHandle, useRef, useCallback } from 'react'
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { html } from '@codemirror/lang-html'

export interface HtmlCodeEditorHandle {
  insertTextAtCursor: (text: string) => void
  getValue: () => string
}

interface HtmlCodeEditorProps {
  value: string
  onChange?: (html: string) => void
  readOnly?: boolean
  height?: string
}

export const HtmlCodeEditor = forwardRef<HtmlCodeEditorHandle, HtmlCodeEditorProps>(
  function HtmlCodeEditor({ value, onChange, readOnly = false, height = '500px' }, ref) {
    const cmRef = useRef<ReactCodeMirrorRef>(null)

    const getValue = useCallback(() => {
      const view = cmRef.current?.view
      return view ? view.state.doc.toString() : value
    }, [value])

    const insertTextAtCursor = useCallback(
      (text: string) => {
        const view = cmRef.current?.view
        if (!view) return
        const { from } = view.state.selection.main
        view.dispatch({ changes: { from, to: from, insert: text } })
        onChange?.(view.state.doc.toString())
        view.focus()
      },
      [onChange],
    )

    useImperativeHandle(ref, () => ({ insertTextAtCursor, getValue }), [insertTextAtCursor, getValue])

    return (
      <CodeMirror
        ref={cmRef}
        value={value}
        height={height}
        extensions={[html()]}
        readOnly={readOnly}
        onChange={(val) => onChange?.(val)}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: !readOnly,
          bracketMatching: true,
          autocompletion: true,
          indentOnInput: true,
        }}
        style={{
          fontSize: 13,
          border: '1px solid #ccc',
          borderRadius: 4,
          flex: 1,
          minHeight: 0,
        }}
      />
    )
  }
)

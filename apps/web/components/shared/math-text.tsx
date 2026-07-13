"use client"

import { Fragment, useMemo } from "react"
import katex from "katex"
import "katex/dist/katex.min.css"

const MATH_PATTERN = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\$([^$\n]+?)\$|\\\(([\s\S]+?)\\\)/g

function renderKatex(latex: string, displayMode: boolean) {
  try {
    return katex.renderToString(latex, { throwOnError: false, displayMode })
  } catch {
    return latex
  }
}

interface Props {
  text: string
  className?: string
}

export function MathText({ text, className }: Props) {
  const parts = useMemo(() => {
    const result: { type: "text" | "math"; value: string; display?: boolean }[] = []
    let lastIndex = 0
    let match: RegExpExecArray | null

    MATH_PATTERN.lastIndex = 0
    while ((match = MATH_PATTERN.exec(text)) !== null) {
      if (match.index > lastIndex) {
        result.push({ type: "text", value: text.slice(lastIndex, match.index) })
      }
      const [, block, blockBracket, inline, inlineParen] = match
      if (block !== undefined) {
        result.push({ type: "math", value: block, display: true })
      } else if (blockBracket !== undefined) {
        result.push({ type: "math", value: blockBracket, display: true })
      } else if (inline !== undefined) {
        result.push({ type: "math", value: inline, display: false })
      } else if (inlineParen !== undefined) {
        result.push({ type: "math", value: inlineParen, display: false })
      }
      lastIndex = match.index + match[0].length
    }
    if (lastIndex < text.length) {
      result.push({ type: "text", value: text.slice(lastIndex) })
    }
    return result
  }, [text])

  if (parts.length === 1 && parts[0].type === "text") {
    return <span className={className}>{text}</span>
  }

  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.type === "text" ? (
          <Fragment key={index}>{part.value}</Fragment>
        ) : (
          <span
            key={index}
            className={part.display ? "block my-1" : "inline"}
            dangerouslySetInnerHTML={{ __html: renderKatex(part.value, Boolean(part.display)) }}
          />
        ),
      )}
    </span>
  )
}

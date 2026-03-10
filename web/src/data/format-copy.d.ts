/** Shape of a single FAQ entry in the format copy JSON. */
interface FormatCopyFaq {
  question: string
  answer: string
}

/** Shape of a single format pair entry in the format copy JSON. */
interface FormatCopyEntry {
  headline: string
  description: string
  body: string
  faqs: FormatCopyFaq[]
}

/** Type for the entire format-copy.json file. */
declare const formatCopy: Record<string, FormatCopyEntry>
export default formatCopy

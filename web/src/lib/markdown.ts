/**
 * Whether a spoken line needs a markdown renderer, or is prose to read along.
 *
 * Nearly everything an agent says is a sentence, and a sentence gets the
 * plain paragraph that the voice can be followed through. Only a line with
 * real structure — a heading, a quote, a table, bullets, emphasis, code — is
 * handed to the renderer, which cannot be read along.
 *
 * A number and a period at the start of a line is the one piece of markdown
 * that is also ordinary speech. Told to count from 95, Steve said "95. Jordan,
 * you’re next." and the renderer, following CommonMark to the letter, made it
 * an ordered list starting at 95: the number became a list marker outside the
 * text, and Pepe’s "100." became an empty item — a blank bubble at the end of
 * the count. A list is two or more such lines; one is somebody saying a
 * number.
 */
export function needsMarkdown(text: string): boolean {
  if (/(^|\n)\s*[#>|*-]|[*_`\[]/.test(text)) return true
  const numbered = text.match(/(^|\n)\s*\d+\.(\s|$)/g)
  return (numbered?.length ?? 0) >= 2
}

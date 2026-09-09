// Marks a run of real Japanese content so the browser's own translate
// feature leaves it alone — lang="ja" is also the correct semantic markup
// given index.html declares the page lang="en" (this is a study tool: all
// UI strings are English, only word/card/article data is Japanese). `as`
// lets a caller replace an existing wrapper element (span/div/h1/...)
// instead of adding a nested one.
export default function Japanese({ as: Tag = 'span', children, ...rest }) {
  return (
    <Tag lang="ja" translate="no" {...rest}>
      {children}
    </Tag>
  )
}

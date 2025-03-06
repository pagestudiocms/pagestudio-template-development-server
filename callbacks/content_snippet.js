
module.exports = (params, context, innerContent, data, parser) => {
  const template = `<div class="snippet">
      <p>Param: ${params.param}</p>
      <p>Content: ${innerContent.trim()}</p>
      <p>Data: ${JSON.stringify(data)}</p>
    </div>`;

  return parser.parse(template, context, data);
};
'use strict';

// This is the bounded CMS Lex profile, not a replacement for either compiler.
// Sources and verified differences are recorded in docs/template-syntax.md.
function analyzeTemplateSyntax(source, file) {
  const findings = [];
  const limitations = [
    'Syntax checks cover CMS Lex if/elseif/else/endif or /if structure, comments and noparse boundaries only.',
    'Variable/loop data, plugin names/parameters, conditional expressions, PHP, specialty HTML tags and undocumented dialects are not validated.'
  ];
  const lineStarts = [0];
  for (let index = 0; index < source.length; index++) if (source[index] === '\n') lineStarts.push(index + 1);
  function location(offset) {
    let low = 0, high = lineStarts.length;
    while (low + 1 < high) {
      const mid = (low + high) >> 1;
      if (lineStarts[mid] <= offset) low = mid; else high = mid;
    }
    return { line: low + 1, column: offset - lineStarts[low] + 1 };
  }
  const add = (ruleId, offset, construct, message, recommendation) => findings.push({
    ruleId, severity: 'error', file, ...location(offset), construct, message,
    evidence: { construct, offset, specification: 'CMS Lex_Parser::setup_regex / parse_comments / extract_noparse' },
    explanation: message, recommendation
  });
  // CMS removes Lex comments before extracting noparse. Mask without moving offsets.
  let text = source.replace(/\{\{#[\s\S]*?#\}\}/g, match => match.replace(/[^\n\r]/g, ' '));
  const stack = [];
  let cursor = 0;
  while (cursor < text.length) {
    const start = text.indexOf('{{', cursor);
    if (start === -1) break;
    if (text.startsWith('{{#', start)) {
      add('PS-SYN-001', start, '{{#', 'Lex comment is missing its #}} terminator.', 'Close the Lex comment with #}}.');
      break;
    }
    const end = text.indexOf('}}', start + 2);
    if (end === -1) {
      if (/^\s*(if|elseif|else|endif|\/if|noparse|\/noparse)(?:\s|$)/.test(text.slice(start + 2))) {
        add('PS-SYN-001', start, text.slice(start), 'Recognized Lex construct is missing its }} delimiter.', 'Close the construct with }}.');
      } else limitations.push('An unclosed, unrecognized {{ construct was left unchecked.');
      break;
    }
    cursor = end + 2;
    const construct = text.slice(start, cursor);
    const body = text.slice(start + 2, end).trim();
    if (body === 'noparse') {
      const close = /\{\{\s*\/noparse\s*\}\}/g;
      close.lastIndex = cursor;
      const match = close.exec(text);
      if (!match) {
        add('PS-SYN-001', start, construct, 'Lex noparse block is missing its closing tag.', 'Add {{ /noparse }} after the literal content.');
        break;
      }
      cursor = close.lastIndex;
      continue;
    }
    if (body === '/noparse') {
      add('PS-SYN-001', start, construct, 'Lex noparse closing tag has no opener.', 'Add {{ noparse }} or remove the unmatched closing tag.');
      continue;
    }
    const token = /^(if|elseif)(?:\s+([\s\S]*))?$/.exec(body);
    if (token) {
      if (!token[2] || !token[2].trim()) add('PS-SYN-002', start, construct, 'Lex conditional requires an expression.', 'Supply the CMS Lex conditional expression.');
      if (token[1] === 'if') stack.push({ start, construct, hasElse: false });
      else if (!stack.length || stack[stack.length - 1].hasElse) add('PS-SYN-002', start, construct,
        'Lex elseif requires an open if before its else branch.', 'Place elseif inside an if block, before else.');
    } else if (body === 'else') {
      const current = stack[stack.length - 1];
      if (!current || current.hasElse) add('PS-SYN-002', start, construct, 'Lex else is unmatched or duplicated.', 'Use one else branch inside an open if block.');
      if (current) current.hasElse = true;
    } else if (body === 'endif' || body === '/if') {
      if (!stack.length) add('PS-SYN-002', start, construct, 'Lex conditional closer has no open if.', 'Remove the extra closer or add the intended if block.');
      else stack.pop();
    } else if (/^\/?(?:unless|elseunless|unlessif|endunless)\b/.test(body)) {
      limitations.push(`Undocumented CMS conditional left unchecked at ${file}:${location(start).line}: ${construct}`);
    }
  }
  for (const open of stack) add('PS-SYN-002', open.start, open.construct, 'Lex if block is missing its closing tag.', 'Close the conditional with {{ endif }} or {{ /if }}.');
  return { findings, limitations: [...new Set(limitations)] };
}

module.exports = { analyzeTemplateSyntax };

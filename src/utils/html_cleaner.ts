import { load } from 'cheerio';

export enum CleaningMode {
  NONE = 'NONE',
  ULTIMATE = 'ULTIMATE',
  TEXT_CONTENT_FOCUSED = 'TEXT_CONTENT_FOCUSED',
  THOROUGH = 'THOROUGH',
  STANDARD = 'STANDARD',
  MINIMAL = 'MINIMAL',
  GOOGLE_SEARCH_RESULT = 'GOOGLE_SEARCH_RESULT'
}

const VOID_TAGS = new Set(['br', 'hr', 'img']);

const cleanWhitespace = (text: string): string => {
  return text.replace(/\s+/g, ' ').trim();
};

const removeEmptyTags = ($: ReturnType<typeof load>, element: any): boolean => {
  if (element.type === 'comment') {
    $(element).remove();
    return true;
  }

  if (element.type === 'text') {
    const data = (element.data ?? '').trim();
    if (!data) {
      $(element).remove();
      return true;
    }
    return false;
  }

  if (element.type === 'tag') {
    const children = $(element).contents().toArray();
    for (const child of children) {
      removeEmptyTags($, child);
    }

    const tagName = element.tagName?.toLowerCase() ?? '';
    const textContent = $(element).text().trim();
    if (!VOID_TAGS.has(tagName) && textContent.length === 0) {
      $(element).remove();
      return true;
    }
  }

  return false;
};

const cleanGoogleSearchResult = ($: ReturnType<typeof load>): string => {
  const parts: string[] = [];
  const addedText = new Set<string>();

  $('a').each((_, el) => {
    const linkText = $(el).text().trim();
    const href = $(el).attr('href');
    const hrefAttr = href ? ` href="${href}"` : '';
    parts.push(`<a${hrefAttr}>${linkText}</a>`);
    if (linkText) {
      addedText.add(linkText);
    }
  });

  $.root()
    .find('*')
    .contents()
    .each((_: any, node: any) => {
      if (node.type !== 'text') {
        return;
      }
      const text = (node.data ?? '').trim();
      if (!text || addedText.has(text)) {
        return;
      }
      parts.push(text);
    });

  return cleanWhitespace(parts.join(' '));
};

export const clean = (htmlText: string, mode: CleaningMode = CleaningMode.STANDARD): string => {
  if (mode === CleaningMode.NONE) {
    return htmlText;
  }

  if (!htmlText || !htmlText.trim()) {
    return '';
  }

  const $ = load(htmlText, { decodeEntities: false } as any);

  if (mode === CleaningMode.TEXT_CONTENT_FOCUSED) {
    $('script, style').remove();
    const textContent = $.text();
    return cleanWhitespace(textContent);
  }

  if (mode === CleaningMode.GOOGLE_SEARCH_RESULT) {
    return cleanGoogleSearchResult($);
  }

  const content: any = $('body').length ? $('body') : $.root();

  content.find('script, style').remove();

  content
    .find('*')
    .contents()
    .each((_: any, node: any) => {
      if (node.type === 'comment') {
        $(node).remove();
      }
    });

  const whitelistTags = mode === CleaningMode.ULTIMATE
    ? [
        'p', 'span', 'em', 'strong', 'i', 'b', 'u', 'sub', 'sup',
        'a', 'img', 'br', 'hr', 'blockquote', 'pre', 'code',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'dl', 'dt', 'dd',
        'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td'
      ]
    : [
        'header', 'nav', 'main', 'footer', 'section', 'article', 'aside',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'div', 'em', 'strong', 'i', 'b', 'u', 'sub', 'sup',
        'a', 'img',
        'ul', 'ol', 'li', 'dl', 'dt', 'dd',
        'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
        'form', 'input', 'textarea', 'select', 'option', 'button', 'label',
        'br', 'hr', 'blockquote', 'pre', 'code', 'figure', 'figcaption'
      ];

  const whitelistSet = new Set(whitelistTags);

  content.find('*').toArray().forEach((el: any) => {
    const tagName = el.tagName?.toLowerCase() ?? '';
    if (!whitelistSet.has(tagName)) {
      if (mode === CleaningMode.ULTIMATE) {
        $(el).replaceWith($(el).contents());
      } else {
        $(el).remove();
      }
    }
  });

  content.find('img').each((_: any, img: any) => {
    const src = $(img).attr('src') ?? '';
    if (src.startsWith('data:image')) {
      $(img).remove();
    }
  });

  if ([CleaningMode.ULTIMATE, CleaningMode.THOROUGH, CleaningMode.STANDARD].includes(mode)) {
    const whitelistAttrs = [
      'href', 'src', 'alt', 'title', 'id', 'name', 'value', 'type', 'placeholder',
      'checked', 'selected', 'disabled', 'readonly', 'for', 'action', 'method', 'target',
      'width', 'height', 'colspan', 'rowspan', 'lang'
    ];

    if (mode === CleaningMode.STANDARD) {
      whitelistAttrs.push('class');
    }

    const whitelistAttrSet = new Set(whitelistAttrs);

    content.find('*').each((_: any, el: any) => {
      const attrs = (el.attribs ?? {}) as Record<string, string>;
      for (const attr of Object.keys(attrs)) {
        if (!whitelistAttrSet.has(attr)) {
          $(el).removeAttr(attr);
        }
      }
      if ($(el).attr('style')) {
        $(el).removeAttr('style');
      }
    });
  }

  content.contents().toArray().forEach((el: any) => {
    removeEmptyTags($, el);
  });

  const cleanedHtml = content.contents().toString();
  return cleanWhitespace(cleanedHtml);
};

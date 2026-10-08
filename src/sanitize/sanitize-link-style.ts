const UNSAFE_CSS_VALUE_PATTERN =
    /(?:expression\s*\(|javascript:|vbscript:|@import|url\s*\(|image\s*\(|image-set\s*\()/i;

const ALLOWED_LINK_STYLE_PROPERTIES = new Set([
    'align-items',
    'background',
    'background-color',
    'border',
    'border-bottom',
    'border-bottom-color',
    'border-bottom-left-radius',
    'border-bottom-right-radius',
    'border-bottom-style',
    'border-bottom-width',
    'border-color',
    'border-left',
    'border-left-color',
    'border-left-style',
    'border-left-width',
    'border-radius',
    'border-right',
    'border-right-color',
    'border-right-style',
    'border-right-width',
    'border-style',
    'border-top',
    'border-top-color',
    'border-top-left-radius',
    'border-top-right-radius',
    'border-top-style',
    'border-top-width',
    'border-width',
    'box-shadow',
    'color',
    'display',
    'height',
    'font',
    'font-family',
    'font-size',
    'font-style',
    'font-weight',
    'gap',
    'justify-content',
    'letter-spacing',
    'line-height',
    'margin',
    'margin-bottom',
    'margin-left',
    'margin-right',
    'margin-top',
    'max-height',
    'max-width',
    'min-height',
    'min-width',
    'opacity',
    'padding',
    'padding-bottom',
    'padding-left',
    'padding-right',
    'padding-top',
    'pointer-events',
    'text-align',
    'text-decoration',
    'text-decoration-color',
    'text-decoration-line',
    'text-decoration-style',
    'text-transform',
    'text-underline-offset',
    'transform',
    'transform-origin',
    'vertical-align',
    'white-space',
    'word-break',
    'overflow-wrap',
    'width',
    'animation',
    'animation-delay',
    'animation-direction',
    'animation-duration',
    'animation-fill-mode',
    'animation-iteration-count',
    'animation-name',
    'animation-play-state',
    'animation-timing-function',
]);

const ENUM_VALUE_WHITELISTS: Partial<Record<string, Set<string>>> = {
    'align-items': new Set(['baseline', 'center', 'flex-end', 'flex-start', 'stretch']),
    display: new Set(['inline', 'inline-block', 'inline-flex']),
    'font-style': new Set(['italic', 'normal', 'oblique']),
    'justify-content': new Set([
        'center',
        'flex-end',
        'flex-start',
        'space-around',
        'space-between',
        'space-evenly',
    ]),
    'pointer-events': new Set(['auto', 'none']),
    'text-align': new Set(['center', 'left', 'right']),
    'text-decoration-line': new Set(['line-through', 'none', 'overline', 'underline']),
    'text-decoration-style': new Set(['dashed', 'dotted', 'double', 'solid', 'wavy']),
    'text-transform': new Set(['capitalize', 'lowercase', 'none', 'uppercase']),
    'vertical-align': new Set([
        'baseline',
        'bottom',
        'middle',
        'sub',
        'super',
        'text-bottom',
        'text-top',
        'top',
    ]),
    'white-space': new Set(['break-spaces', 'normal', 'nowrap', 'pre', 'pre-line', 'pre-wrap']),
    'word-break': new Set(['break-all', 'break-word', 'keep-all', 'normal']),
    'overflow-wrap': new Set(['anywhere', 'break-word', 'normal']),
};

const isSafeCssValue = (value: string) => {
    return !!value && !UNSAFE_CSS_VALUE_PATTERN.test(value);
};

const sanitizePropertyValue = (property: string, value: string) => {
    const trimmedValue = value.trim();

    if (!isSafeCssValue(trimmedValue)) {
        return null;
    }

    if (typeof document === 'undefined') {
        const allowedValues = ENUM_VALUE_WHITELISTS[property];

        if (allowedValues && !allowedValues.has(trimmedValue.toLowerCase())) {
            return null;
        }

        return trimmedValue;
    }

    const element = document.createElement('a');
    element.style.setProperty(property, trimmedValue);

    const normalizedValue = element.style.getPropertyValue(property).trim();

    if (!isSafeCssValue(normalizedValue)) {
        return null;
    }

    const allowedValues = ENUM_VALUE_WHITELISTS[property];

    if (allowedValues && !allowedValues.has(normalizedValue.toLowerCase())) {
        return null;
    }

    if (property === 'font-weight') {
        const normalized = normalizedValue.toLowerCase();

        if (!/^(normal|bold|bolder|lighter|[1-9]00)$/.test(normalized)) {
            return null;
        }
    }

    if (property === 'opacity') {
        const opacity = Number.parseFloat(normalizedValue);

        if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
            return null;
        }
    }

    return normalizedValue;
};

export const sanitizeLinkStyle = (styleText: string | null | undefined) => {
    if (!styleText?.trim()) {
        return null;
    }

    const orderedProperties: string[] = [];
    const sanitizedValues = new Map<string, string>();

    styleText.split(';').forEach((declaration) => {
        const separatorIndex = declaration.indexOf(':');

        if (separatorIndex === -1) {
            return;
        }

        const property = declaration.slice(0, separatorIndex).trim().toLowerCase();
        const value = declaration.slice(separatorIndex + 1).trim();

        if (!ALLOWED_LINK_STYLE_PROPERTIES.has(property)) {
            return;
        }

        const sanitizedValue = sanitizePropertyValue(property, value);

        if (!sanitizedValue) {
            return;
        }

        const existingIndex = orderedProperties.indexOf(property);

        if (existingIndex !== -1) {
            orderedProperties.splice(existingIndex, 1);
        }

        orderedProperties.push(property);
        sanitizedValues.set(property, sanitizedValue);
    });

    if (orderedProperties.length === 0) {
        return null;
    }

    return orderedProperties
        .map((property) => `${property}: ${sanitizedValues.get(property)}`)
        .join('; ');
};

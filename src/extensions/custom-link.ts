import Link from '@tiptap/extension-link';

import { sanitizeLinkStyle } from '../sanitize';

export const CustomLink = Link.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            style: {
                default: null,
                parseHTML: (element) => {
                    return sanitizeLinkStyle(element.getAttribute('style'));
                },
                renderHTML: (attributes) => {
                    const sanitizedStyle = sanitizeLinkStyle(attributes.style);

                    if (!sanitizedStyle) {
                        return {};
                    }

                    return {
                        style: sanitizedStyle,
                    };
                },
            },
        };
    },
});

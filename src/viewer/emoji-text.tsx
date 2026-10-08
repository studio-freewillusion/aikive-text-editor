import { gitHubEmojis } from '@tiptap/extension-emoji';

const emojiByName = new Map<string, (typeof gitHubEmojis)[number]>();

gitHubEmojis.forEach((item) => {
    emojiByName.set(item.name, item);
    item.shortcodes?.forEach((shortcode) => {
        if (!emojiByName.has(shortcode)) {
            emojiByName.set(shortcode, item);
        }
    });
});

const EmojiText = ({ name }: { name?: string }) => {
    const item = name ? emojiByName.get(name) : undefined;

    if (!item) {
        return <span data-type="emoji">{`:${name ?? ''}:`}</span>;
    }

    if (item.emoji) {
        return <span data-type="emoji">{item.emoji}</span>;
    }

    return (
        <span data-type="emoji">
            <img src={item.fallbackImage} alt={item.name} draggable="false" loading="lazy" />
        </span>
    );
};

export default EmojiText;

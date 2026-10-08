import type { AnyExtension } from '@tiptap/core';
import Emoji, { gitHubEmojis } from '@tiptap/extension-emoji';
import { TableKit } from '@tiptap/extension-table';
import TextAlign from '@tiptap/extension-text-align';
import { Color, FontFamily, FontSize, LineHeight, TextStyle } from '@tiptap/extension-text-style';
import Youtube from '@tiptap/extension-youtube';
import StarterKit from '@tiptap/starter-kit';
import { ClampColumnWidth, CustomImage, CustomLink, VideoBlock } from '../extensions';
import { isAllowedEditorUri } from '../sanitize';
import type { HtmlClassNames } from './types';

export function buildExtensions(editable: boolean, classNames: HtmlClassNames = {}): AnyExtension[] {
  return [
    StarterKit.configure({ link: false, trailingNode: editable ? undefined : false }),
    CustomLink.configure({
      openOnClick: !editable,
      autolink: true,
      defaultProtocol: 'https',
      protocols: ['http', 'https'],
      isAllowedUri: isAllowedEditorUri,
    }),
    TextStyle,
    FontSize.configure({ types: ['textStyle'] }),
    // 글꼴 버튼은 없지만 기존 글의 글꼴을 열고 저장해도 지우지 않으려고 등록한다
    FontFamily.configure({ types: ['textStyle'] }),
    LineHeight.configure({ types: ['textStyle'] }),
    Color.configure({ types: ['textStyle'] }),
    Emoji.configure({ emojis: gitHubEmojis }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    TableKit.configure({
      table: { resizable: true, handleWidth: 5, cellMinWidth: 25, lastColumnResizable: true, allowTableNodeSelection: true },
    }),
    ClampColumnWidth,
    CustomImage,
    Youtube.configure({
      controls: false,
      nocookie: true,
      HTMLAttributes: classNames.youtube ? { class: classNames.youtube } : {},
    }),
    VideoBlock,
  ];
}

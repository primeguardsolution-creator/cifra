import { ReactNode } from 'react';
import { View } from 'react-native';
import { font } from '../../theme/tokens';
import { Txt } from '../../ui';

/** Tiny markdown subset used by the assistant's answers: **bold**, *italic*, `code`, "• " bullets and "1. " steps. */
function inline(text: string, color: string, codeBg: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*)/g).filter(Boolean).map((p, i) => {
    if (p.startsWith('**')) return <Txt key={i} style={{ color, fontFamily: font.bold, fontSize: 15.5, lineHeight: 22 }}>{p.slice(2, -2)}</Txt>;
    if (p.startsWith('`')) return <Txt key={i} style={{ color, fontFamily: font.mono, fontSize: 13.5, backgroundColor: codeBg }}>{` ${p.slice(1, -1)} `}</Txt>;
    if (p.startsWith('*')) return <Txt key={i} style={{ color, fontStyle: 'italic', fontSize: 15.5, lineHeight: 22 }}>{p.slice(1, -1)}</Txt>;
    return p;
  });
}

export function RichBot({ text, color, codeBg }: { text: string; color: string; codeBg: string }) {
  const lines = text.split('\n');
  return (
    <View style={{ gap: 3 }}>
      {lines.map((line, i) => {
        if (!line.trim()) return <View key={i} style={{ height: 5 }} />;
        const bullet = line.match(/^(•|-)\s+(.*)$/);
        const step = line.match(/^(\d+)\.\s+(.*)$/);
        const marker = bullet ? '•' : step ? `${step[1]}.` : null;
        const body = bullet ? bullet[2] : step ? step[2] : line;
        if (marker) {
          return (
            <View key={i} style={{ flexDirection: 'row', gap: 8, paddingLeft: 2 }}>
              <Txt style={{ color, fontSize: 15.5, lineHeight: 22, minWidth: 16, fontFamily: step ? font.semibold : font.regular }}>{marker}</Txt>
              <Txt style={{ color, fontSize: 15.5, lineHeight: 22, flex: 1 }}>{inline(body, color, codeBg)}</Txt>
            </View>
          );
        }
        return <Txt key={i} style={{ color, fontSize: 15.5, lineHeight: 22 }}>{inline(body, color, codeBg)}</Txt>;
      })}
    </View>
  );
}

import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { BizHeader, Key } from '../../components/BizUi';
import { useSpace } from '../../state/SpaceProvider';
import { useTheme } from '../../theme/ThemeProvider';
import { Icon, IconName, Pressy, Txt } from '../../ui';

export default function More() {
  const { c, r } = useTheme();
  const { active, switchSpace } = useSpace();
  const rows: { icon: IconName; title: string; sub: string; go: string }[] = [
    { icon: 'aperture', title: 'Publicaciones', sub: 'Novedades, fotos y vídeos que ven tus clientes · 7 días', go: '/posts' },
    { icon: 'pricetags', title: 'Catálogo', sub: 'Productos y servicios que ven tus clientes', go: '/catalog' },
    { icon: 'storefront', title: 'Perfil, equipo y automatizaciones', sub: 'Saludo, ausencia, respuestas rápidas, roles', go: '/business' },
    ...(active ? [{ icon: 'eye' as IconName, title: 'Mi perfil público', sub: 'Así te ven los clientes · compartir enlace', go: `/b/${active.business.id}` }] : []),
    { icon: 'settings', title: 'Ajustes', sub: 'Apariencia, privacidad, bloqueo con PIN', go: '/settings' },
    { icon: 'sparkles', title: 'Pregunta a @maestro', sub: 'Te explica cómo hacer cualquier cosa', go: '/assistant' },
  ];
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <BizHeader eyebrow="Negocio" title="Más" sub={active?.business.name} right={<Key icon="swap-horizontal" label="Personal" onPress={() => switchSpace('personal')} />} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
        {rows.map((x) => (
          <Pressy key={x.go} onPress={() => router.push(x.go as never)} accessibilityRole="button" scale={0.99} hoverStyle={{ backgroundColor: c.surfaceAlt }} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: r(12), backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
            <View style={{ width: 42, height: 42, borderRadius: r(10), backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}><Icon name={x.icon} size={20} color={c.accentSoftText} /></View>
            <View style={{ flex: 1 }}><Txt v="bodyStrong">{x.title}</Txt><Txt v="small" tone="muted">{x.sub}</Txt></View>
            <Icon name="chevron-forward" size={18} tone="faint" />
          </Pressy>
        ))}
      </ScrollView>
    </View>
  );
}

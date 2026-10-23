import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createBusiness } from '../../lib/api';
import { categories } from '../../lib/business';
import { friendly } from '../../lib/errors';
import { slugify } from '../../lib/format';
import { useAuth } from '../../state/AuthProvider';
import { useSpace } from '../../state/SpaceProvider';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, Chip, Field, Icon, IconButton, Txt } from '../../ui';

export default function BusinessCreate() {
  const { c, setSpace } = useTheme();
  const { profile } = useAuth();
  const { refreshBusinesses, setActiveBusiness } = useSpace();
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [touched, setTouched] = useState(false);
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onName = (t: string) => { setName(t); if (!touched) setHandle(slugify(t)); };
  const submit = async () => {
    setError(null);
    if (!name.trim()) return setError('Escribe el nombre de tu negocio.');
    if (!/^[a-z0-9-]{3,48}$/.test(handle)) return setError('El identificador debe tener 3–48 caracteres: minúsculas, números y guiones.');
    setBusy(true);
    try {
      const id = await createBusiness({ name, handle, category, description, phone: profile?.phone ?? '' });
      await refreshBusinesses(); setActiveBusiness(id); setSpace('business');
      router.replace('/business');
    } catch (e) { setError(friendly(e, 'No se pudo crear el negocio.')); } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ alignItems: 'center', padding: 20, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <View style={{ width: '100%', maxWidth: 520, gap: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <IconButton icon="close" label="Cerrar" onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))} />
              <Txt v="h3">Nuevo negocio</Txt><View style={{ width: 40 }} />
            </View>
            <View style={{ alignItems: 'center', gap: 8, paddingVertical: 4 }}>
              <View style={{ width: 76, height: 76, borderRadius: 24, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}><Icon name="storefront" size={36} color={c.accentText} /></View>
              <Txt v="small" tone="muted" style={{ textAlign: 'center' }}>Podrás añadir el logo y el resto de datos al terminar.</Txt>
            </View>
            <Field label="Nombre del negocio" value={name} onChangeText={onName} placeholder="Café Aurora" maxLength={80} autoCapitalize="words" />
            <Field label="Identificador público" value={handle} onChangeText={(t) => { setTouched(true); setHandle(t.toLowerCase().replace(/[^a-z0-9-]/g, '')); }} autoCapitalize="none" autoCorrect={false} left={<Txt tone="muted">@</Txt>} hint="Así te encontrarán tus clientes. No podrás repetirlo." />
            <View style={{ gap: 8 }}>
              <Txt v="caption" tone="muted" style={{ marginLeft: 2 }}>Categoría</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{categories.map((x) => <Chip key={x} label={x} active={category === x} onPress={() => setCategory(category === x ? '' : x)} />)}</View>
            </View>
            <Field label="Descripción" value={description} onChangeText={setDescription} placeholder="Qué haces y cómo ayudas a tus clientes" multiline maxLength={400} />
            {error && <Txt v="small" tone="danger" accessibilityLiveRegion="polite">{error}</Txt>}
            <Button title="Crear negocio" size="lg" iconRight="arrow-forward" loading={busy} onPress={submit} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

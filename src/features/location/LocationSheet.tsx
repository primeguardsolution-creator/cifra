import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GeoError, getPosition } from '../../lib/geo';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, Field, Sheet, Txt } from '../../ui';
import { t } from '../../i18n';
import { MapPreview } from './MapPreview';

const WHY: Record<GeoError, string> = {
  denied: 'No tenemos permiso para ver tu ubicación. Actívalo para CIFRA en los ajustes del navegador o del teléfono.',
  unavailable: 'No se pudo determinar tu ubicación. Prueba en un sitio con mejor señal.',
  timeout: 'Tardó demasiado en encontrar tu ubicación. Inténtalo de nuevo.',
  unsupported: 'Este dispositivo no permite compartir la ubicación.',
};

/** Reads your position, shows it on a map so you can check it, and sends it only when you confirm. */
export function LocationSheet({ visible, onClose, onSend }: { visible: boolean; onClose: () => void; onSend: (p: { lat: number; lng: number; label: string }) => Promise<void> }) {
  const { c } = useTheme();
  const [pos, setPos] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [error, setError] = useState<GeoError | null>(null);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!visible) return;
    let live = true; setPos(null); setError(null); setLabel('');
    getPosition().then((p) => live && setPos(p)).catch((e) => live && setError(((e as Error).message as GeoError) in WHY ? ((e as Error).message as GeoError) : 'unavailable'));
    return () => { live = false; };
  }, [visible, attempt]);

  const send = async () => { if (!pos) return; setBusy(true); try { await onSend({ lat: pos.lat, lng: pos.lng, label }); onClose(); } finally { setBusy(false); } };
  return (
    <Sheet visible={visible} onClose={onClose} title="Enviar ubicación">
      <View style={{ gap: 12 }}>
        {!pos && !error && <View style={{ height: 190, alignItems: 'center', justifyContent: 'center', gap: 10 }}><ActivityIndicator color={c.accent} /><Txt tone="muted">Buscando tu ubicación…</Txt></View>}
        {error && (
          <View style={{ gap: 12, paddingVertical: 8 }}>
            <Txt tone="muted">{WHY[error]}</Txt>
            {error !== 'unsupported' && error !== 'denied' && <Button title="Reintentar" icon="refresh" variant="secondary" onPress={() => setAttempt((n) => n + 1)} />}
          </View>
        )}
        {pos && (
          <>
            <View style={{ alignItems: 'center' }}><MapPreview lat={pos.lat} lng={pos.lng} width={300} height={190} radius={14} /></View>
            <Txt v="caption" tone="muted" style={{ textAlign: 'center' }}>{t('Precisión aproximada: {m} m', { m: Math.max(5, Math.round(pos.accuracy)) })}</Txt>
            <Field label="Nombre del lugar (opcional)" value={label} onChangeText={setLabel} placeholder="Mi oficina, entrada norte…" maxLength={80} />
            <Button title="Enviar esta ubicación" icon="send" loading={busy} onPress={send} />
            <Txt v="caption" tone="faint" style={{ textAlign: 'center' }}>Se envía una vez; no te seguimos.</Txt>
          </>
        )}
      </View>
    </Sheet>
  );
}

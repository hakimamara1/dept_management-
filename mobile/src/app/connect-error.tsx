import { useRouter } from 'expo-router'
import { AppButton, AppText, CenteredMessage, Screen } from '@/shared/components/ui'
import { useI18n } from '@/shared/i18n/useI18n'
import { reconnect } from '@/modules/connection/services/connectionManager'
import { useConnectionStore } from '@/modules/connection/store'

/** Shown instead of a broken app whenever the desktop can't be used: off, other network, revoked, or version mismatch. */
export default function ConnectErrorScreen() {
  const { t } = useI18n()
  const router = useRouter()
  const status = useConnectionStore((s) => s.status)
  const connection = useConnectionStore((s) => s.connection)
  const searching = status === 'connecting'

  const copy =
    status === 'unauthorized'
      ? { title: t('connection.unauthorizedTitle'), body: t('connection.unauthorizedBody') }
      : status === 'incompatible'
        ? { title: t('connection.incompatibleTitle'), body: t('connection.incompatibleBody') }
        : { title: t('connection.unreachableTitle'), body: t('connection.unreachableBody') }

  return (
    <Screen scroll={false}>
      <CenteredMessage title={copy.title} body={searching ? t('connection.searching') : copy.body}>
        {connection && status !== 'unauthorized' && (
          <AppText variant="caption" style={{ writingDirection: 'ltr' }}>
            {t('connection.lastKnown')}: {connection.lastHost}:{connection.port}
          </AppText>
        )}
        {status !== 'unauthorized' && status !== 'incompatible' && (
          <AppButton label={t('common.retry')} onPress={() => reconnect()} loading={searching} />
        )}
        <AppButton variant="outline" label={t('connection.rescan')} onPress={() => router.push('/pair')} />
      </CenteredMessage>
    </Screen>
  )
}

/**
 * Vue composable over the detector client.
 *
 *   import { useMeetingDetector } from 'meetcap-detector/vue'
 *   const { meeting, isInMeeting } = useMeetingDetector()
 *
 * `vue` is an optional peer dependency.
 */
import { computed, onUnmounted, ref, type ComputedRef, type Ref } from 'vue'
import type { MeetingInfo } from 'meetcap-core'
import { createDetectorClient } from './renderer'

export function useMeetingDetector(): {
  meeting: Ref<MeetingInfo | null>
  isInMeeting: ComputedRef<boolean>
} {
  const meeting = ref<MeetingInfo | null>(null)
  const client = createDetectorClient()
  client.on('meeting-detected', (m) => (meeting.value = m))
  client.on('meeting-ended', () => (meeting.value = null))
  onUnmounted(() => client.destroy())

  return { meeting, isInMeeting: computed(() => meeting.value !== null) }
}

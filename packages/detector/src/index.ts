/**
 * meetcap-detector — meeting detection by window title + process name, with
 * custom rules.
 *
 * This root entry is the pure, framework-agnostic core (safe to unit-test, no
 * electron). The Electron poller is `meetcap-detector/main`; the renderer
 * client is `meetcap-detector/renderer`.
 */
export { presets, toMatcher } from './rules'
export {
  matchWindow,
  matchProcess,
  resolveMeeting,
  createDetectionState,
  type DetectorConfig,
} from './engine'
export type { MeetingRule, MeetingInfo, DetectorEvent } from 'meetcap-core'

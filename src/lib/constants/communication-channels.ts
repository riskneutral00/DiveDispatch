export const COMMUNICATION_CHANNELS = [
  { key: 'WhatsApp', label: 'WhatsApp' },
  { key: 'LINE', label: 'LINE' },
  { key: 'Messenger', label: 'Messenger' },
  { key: 'WeChat', label: 'WeChat' },
  { key: 'KakaoTalk', label: 'KakaoTalk' },
  { key: 'Instagram', label: 'Instagram' },
] as const

export type ChannelKey = (typeof COMMUNICATION_CHANNELS)[number]['key']

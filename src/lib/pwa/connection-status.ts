export enum ConnectionStatus {
  Online = 'online',
  Offline = 'offline',
  Stale = 'stale',
}

interface ConnectionInput {
  navigatorOnline: boolean
  isStale: boolean
}

export function getConnectionStatus(input: ConnectionInput): ConnectionStatus {
  if (!input.navigatorOnline) {
    return ConnectionStatus.Offline
  }
  if (input.isStale) {
    return ConnectionStatus.Stale
  }
  return ConnectionStatus.Online
}

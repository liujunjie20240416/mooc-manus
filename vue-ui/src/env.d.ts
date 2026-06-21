/// <reference types="vite/client" />

declare module '@novnc/novnc/lib/rfb.js' {
  type RfbInstance = {
    disconnect: () => void
    scaleViewport?: boolean
    background?: string
    addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void
  }

  type RfbConstructor = new (
    target: Element | string,
    url: string,
    options?: {
      credentials?: {
        username?: string
        password?: string
        target?: string
      }
    },
  ) => RfbInstance

  const RFB: RfbConstructor
  export default RFB
}

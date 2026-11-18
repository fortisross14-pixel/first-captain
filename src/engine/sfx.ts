export type SfxName = 'click' | 'coin' | 'hit' | 'hurt' | 'drop' | 'splash' | 'pour' | 'bad' | 'fanfare' | 'chime' | 'flip' | 'page' | 'tick' | 'bell' | 'handbell';

/** Fire-and-forget sound effect; the Sound engine listens if it is running. */
export function sfx(name: SfxName): void {
  window.dispatchEvent(new CustomEvent<SfxName>('sfx', { detail: name }));
}

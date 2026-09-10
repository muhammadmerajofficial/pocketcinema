// Sound effects disabled per user request: website does not need any sound system of its own
class RemoteSoundController {
  public enabled: boolean = false;

  public playClick(_type: 'nav' | 'ok' | 'switch' | 'voice' = 'nav') {
    // Disabled - no sounds generated
    return;
  }

  public toggleSound(): boolean {
    this.enabled = false;
    return false;
  }
}

export const soundFx = new RemoteSoundController();

export class CabinAudio{
  async setEnabled(enabled){if(enabled&&!this.context){const C=window.AudioContext||window.webkitAudioContext;if(!C)return;this.context=new C();this.gain=this.context.createGain();this.gain.gain.value=0;this.gain.connect(this.context.destination);for(const frequency of[58,87,116]){const o=this.context.createOscillator();o.type='sine';o.frequency.value=frequency;o.connect(this.gain);o.start();}}if(enabled)await this.context?.resume();this.enabled=enabled;this.update(false);}
  update(flying){if(this.gain)this.gain.gain.setTargetAtTime(this.enabled&&flying?.022:0,this.context.currentTime,.2);}
  dispose(){this.context?.close();}
}

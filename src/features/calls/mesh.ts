/**
 * Media layer of a call: a full mesh of peer-to-peer WebRTC connections, one per other participant (2 people = 1 connection, groups up to ~6).
 * No React or app imports on purpose: the signalling (`signal`) and the connection factory (`createPC`) are injected, so the same code
 * runs in the app and in the headless-browser test (scripts/test-mesh.mjs).
 *
 * Who offers: for every pair the participant with the smaller user id creates the offer, once both have joined, so there is never a collision.
 * Screen sharing replaces the video sent on every connection (a video line is negotiated in every call, also in voice calls).
 */
export type Kind = 'audio' | 'video';
export type PeerInfo = { id: string; name: string; avatar?: string | null };
export type PeerState = 'invited' | 'connecting' | 'connected' | 'declined' | 'left' | 'busy' | 'missed';
export type PeerView = PeerInfo & { state: PeerState; stream: MediaStream | null; sharing: boolean; camOff: boolean; muted: boolean };

export type MeshDeps = {
  me: string;
  signal: (to: string, event: string, payload: Record<string, unknown>) => Promise<void>;
  createPC: () => Promise<RTCPeerConnection>;
  getLocal: (kind: Kind) => Promise<MediaStream>;
  getScreen?: () => Promise<MediaStream>;
  onChange: () => void;
};

type Peer = PeerView & { pc: RTCPeerConnection | null; pendingIce: RTCIceCandidateInit[]; joined: boolean; videoSender: RTCRtpSender | null; dropTimer?: ReturnType<typeof setTimeout> };

export class MeshRoom {
  readonly callId: string;
  kind: Kind;
  local: MediaStream | null = null;
  screen: MediaStream | null = null;
  joined = false;
  startedAt: number | null = null;
  muted = false;
  camOff = false;
  closed = false;
  reconnecting = false;
  relay = false;
  private peers = new Map<string, Peer>();
  private deps: MeshDeps;

  constructor(deps: MeshDeps, callId: string, kind: Kind, members: PeerInfo[]) {
    this.deps = deps; this.callId = callId; this.kind = kind;
    members.forEach((m) => this.addMember(m));
  }

  addMember(m: PeerInfo, state: PeerState = 'invited') {
    if (m.id === this.deps.me || this.peers.has(m.id)) return;
    this.peers.set(m.id, { ...m, state, stream: null, sharing: false, camOff: false, muted: false, pc: null, pendingIce: [], joined: false, videoSender: null });
    this.deps.onChange();
  }
  memberIds() { return [...this.peers.keys()]; }
  view(): PeerView[] { return [...this.peers.values()].map(({ id, name, avatar, state, stream, sharing, camOff, muted }) => ({ id, name, avatar, state, stream, sharing, camOff, muted })); }
  get sharing() { return !!this.screen; }
  /** People still in the call (connected or connecting) */
  activeCount() { return [...this.peers.values()].filter((p) => p.state === 'connected' || p.state === 'connecting').length; }
  /** Nobody else can still join or is here: the call is over for me */
  isAlone() { return ![...this.peers.values()].some((p) => p.state === 'connected' || p.state === 'connecting' || p.state === 'invited'); }

  private emit() { if (!this.closed) this.deps.onChange(); }
  private tell(to: string, event: string, extra: Record<string, unknown> = {}) { return this.deps.signal(to, event, { callId: this.callId, ...extra }).catch(() => {}); }
  private tellAll(event: string, extra: Record<string, unknown> = {}, only?: (p: Peer) => boolean) {
    for (const p of this.peers.values()) if (!only || only(p)) this.tell(p.id, event, extra);
  }

  /** Get the microphone/camera, announce that I am in the call and connect to everybody who already is. */
  async join(): Promise<void> {
    this.local = await this.deps.getLocal(this.kind);
    if (this.closed) { this.local.getTracks().forEach((t) => t.stop()); return; }
    this.joined = true;
    this.tellAll('join', { kind: this.kind });
    this.emit();
    for (const p of this.peers.values()) if (p.joined) void this.maybeOffer(p.id);
  }

  private async makePC(p: Peer): Promise<RTCPeerConnection> {
    if (p.pc) return p.pc;
    const pc = await this.deps.createPC();
    p.pc = pc;
    const remote = new MediaStream();
    p.stream = remote;
    this.local?.getTracks().forEach((t) => {
      const sender = pc.addTrack(t, this.local!);
      if (t.kind === 'video') p.videoSender = sender;
    });
    if (!p.videoSender) {
      // a voice call still negotiates a video line, so screen sharing can start later without renegotiating
      const tr = pc.addTransceiver('video', { direction: 'sendrecv' });
      p.videoSender = tr.sender;
    }
    if (this.screen) void p.videoSender?.replaceTrack(this.screen.getVideoTracks()[0]).catch(() => {});
    pc.ontrack = (e) => {
      if (!remote.getTracks().includes(e.track)) remote.addTrack(e.track);
      e.track.onunmute = () => this.emit(); e.track.onmute = () => this.emit();
      this.emit();
    };
    pc.onicecandidate = (e) => { if (e.candidate) void this.tell(p.id, 'ice', { candidate: e.candidate.toJSON() }); };
    pc.onconnectionstatechange = () => {
      if (this.closed || p.pc !== pc) return;
      if (pc.connectionState === 'connected') {
        clearTimeout(p.dropTimer); this.reconnecting = false; p.state = 'connected';
        if (!this.startedAt) this.startedAt = Date.now();
      } else if (pc.connectionState === 'disconnected') {
        this.reconnecting = true; clearTimeout(p.dropTimer);
        p.dropTimer = setTimeout(() => { if (p.pc === pc && pc.connectionState !== 'connected') this.dropPeer(p, 'left'); }, 12_000);
      } else if (pc.connectionState === 'failed') this.dropPeer(p, 'left');
      this.emit();
    };
    return pc;
  }

  private dropPeer(p: Peer, state: PeerState) {
    clearTimeout(p.dropTimer);
    try { p.pc?.close(); } catch { /* already closed */ }
    p.pc = null; p.stream = null; p.videoSender = null; p.pendingIce = []; p.state = state; p.joined = false;
    this.reconnecting = [...this.peers.values()].some((x) => x.pc && x.pc.connectionState === 'disconnected');
    this.emit();
  }

  private async maybeOffer(id: string) {
    const p = this.peers.get(id);
    if (!p || !this.joined || !p.joined || p.pc || this.closed) return;
    if (this.deps.me > id) return; // the other side offers
    try {
      p.state = 'connecting'; this.emit();
      const pc = await this.makePC(p);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await this.tell(id, 'offer', { sdp: offer.sdp, type: offer.type });
    } catch { this.dropPeer(p, 'left'); }
  }

  /** Every signalling message of this call lands here. */
  async onSignal(event: string, from: string, payload: Record<string, unknown>): Promise<void> {
    if (this.closed) return;
    let p = this.peers.get(from);
    if (!p) { this.addMember({ id: from, name: String(payload.name ?? 'Contacto').slice(0, 60) }); p = this.peers.get(from)!; }
    switch (event) {
      case 'join': p.joined = true; if (p.state === 'invited' || p.state === 'declined' || p.state === 'left' || p.state === 'missed') p.state = 'connecting'; this.emit(); await this.maybeOffer(from); break;
      case 'offer': {
        if (!this.joined) return;
        try {
          p.joined = true; if (p.pc && p.pc.signalingState !== 'stable') return;
          const pc = await this.makePC(p);
          await pc.setRemoteDescription({ type: 'offer', sdp: String(payload.sdp) });
          pc.getTransceivers().forEach((t) => { if (t.receiver.track.kind === 'video' && t.direction === 'recvonly') t.direction = 'sendrecv'; });
          for (const c of p.pendingIce.splice(0)) await pc.addIceCandidate(c).catch(() => {});
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          p.state = 'connecting'; this.emit();
          await this.tell(from, 'answer', { sdp: answer.sdp, type: answer.type });
          if (this.screen && !p.videoSender) { /* sender is created by makePC */ }
          if (p.videoSender && this.screen) void p.videoSender.replaceTrack(this.screen.getVideoTracks()[0]).catch(() => {});
        } catch { this.dropPeer(p, 'left'); }
        break;
      }
      case 'answer':
        try { if (p.pc) { await p.pc.setRemoteDescription({ type: 'answer', sdp: String(payload.sdp) }); for (const c of p.pendingIce.splice(0)) await p.pc.addIceCandidate(c).catch(() => {}); } } catch { this.dropPeer(p, 'left'); }
        break;
      case 'ice': {
        const cand = payload.candidate as RTCIceCandidateInit | undefined;
        if (!cand) break;
        if (p.pc?.remoteDescription) await p.pc.addIceCandidate(cand).catch(() => {}); else p.pendingIce.push(cand);
        break;
      }
      case 'media':
        if (typeof payload.sharing === 'boolean') p.sharing = payload.sharing;
        if (typeof payload.camOff === 'boolean') p.camOff = payload.camOff;
        if (typeof payload.muted === 'boolean') p.muted = payload.muted;
        this.emit(); break;
      case 'leave': case 'end': this.dropPeer(p, 'left'); break;
      case 'decline': this.dropPeer(p, 'declined'); break;
      case 'busy': this.dropPeer(p, 'busy'); break;
      case 'cancel': this.dropPeer(p, 'missed'); break;
    }
  }

  markMissed() { for (const p of this.peers.values()) if (p.state === 'invited') p.state = 'missed'; this.emit(); }

  toggleMute() {
    this.muted = !this.muted;
    this.local?.getAudioTracks().forEach((t) => { t.enabled = !this.muted; });
    this.tellAll('media', { muted: this.muted }, (p) => p.joined); this.emit();
  }
  toggleCamera() {
    this.camOff = !this.camOff;
    this.local?.getVideoTracks().forEach((t) => { t.enabled = !this.camOff; });
    this.tellAll('media', { camOff: this.camOff }, (p) => p.joined); this.emit();
  }

  async startShare(): Promise<void> {
    if (!this.deps.getScreen || this.screen) return;
    const stream = await this.deps.getScreen();
    const track = stream.getVideoTracks()[0];
    if (!track) return;
    this.screen = stream;
    track.onended = () => { void this.stopShare(); };
    await Promise.all([...this.peers.values()].map((p) => p.videoSender?.replaceTrack(track).catch(() => {})));
    this.tellAll('media', { sharing: true }, (p) => p.joined); this.emit();
  }
  async stopShare(): Promise<void> {
    if (!this.screen) return;
    const s = this.screen; this.screen = null;
    s.getTracks().forEach((t) => { t.onended = null; t.stop(); });
    const cam = this.local?.getVideoTracks()[0] ?? null;
    await Promise.all([...this.peers.values()].map((p) => p.videoSender?.replaceTrack(cam).catch(() => {})));
    this.tellAll('media', { sharing: false }, (p) => p.joined); this.emit();
  }

  /** Leave the call: tell the others and release camera, microphone and screen. */
  leave(notice = true) {
    if (this.closed) return;
    if (notice) this.tellAll('leave', {}, (p) => p.joined || p.state === 'connecting' || p.state === 'connected');
    this.close();
  }
  close() {
    this.closed = true;
    for (const p of this.peers.values()) { clearTimeout(p.dropTimer); try { p.pc?.close(); } catch { /* closed */ } p.pc = null; }
    this.local?.getTracks().forEach((t) => t.stop());
    this.screen?.getTracks().forEach((t) => t.stop());
    this.local = null; this.screen = null;
  }
}

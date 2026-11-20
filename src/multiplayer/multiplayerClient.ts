import { ClientMessage, ServerMessage, RoomState, RoomSettings, BuildingType } from './types';
import { PendingTitanSpawn, SupremeTechLevels, AirUnit, AirUnitType } from '../types';

type Listener<T> = (data: T) => void;

class MultiplayerClient {
  private ws: WebSocket | null = null;
  private isConnecting = false;
  private messageQueue: ClientMessage[] = [];
  private reconnectToken: string | null = null;
  private roomCode: string | null = null;
  private playerId: string | null = null;
  private isIntentionalLeave = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  // Callbacks
  public onConnectionStatusChange: Listener<{
    status: 'DISCONNECTED' | 'RECONNECTING' | 'CONNECTED' | 'FAILED';
    attempt?: number;
    message?: string;
  }> | null = null;
  public onRoomCreated: Listener<{ room: RoomState; myPlayerId: string }> | null = null;
  public onRoomJoined: Listener<{ room: RoomState; myPlayerId: string }> | null = null;
  public onRoomUpdated: Listener<RoomState> | null = null;
  public onGameStarted: Listener<RoomState> | null = null;
  public onActionAttack: Listener<{
    fromNation: number;
    toNation: number;
    sourceX: number;
    sourceY: number;
    targetX: number;
    targetY: number;
    troops: number;
  }> | null = null;
  public onActionBuild: Listener<{
    nationId: number;
    targetX: number;
    targetY: number;
    buildingType: BuildingType;
    count: number;
  }> | null = null;
  public onActionTech: Listener<{
    nationId: number;
    techLevels: { economy: number; military: number; defense: number };
  }> | null = null;
  public onActionSupremeTech: Listener<{
    nationId: number;
    supremeTechUnlocked: boolean;
    supremeTechLevels: SupremeTechLevels;
    researchingTechId?: string;
  }> | null = null;
  public onActionAir: Listener<{
    nationId: number;
    action: 'PRODUCE' | 'LAUNCH';
    unitType: AirUnitType;
    targetX?: number;
    targetY?: number;
    targetKind?: 'TILE' | 'TITAN' | 'SHIP' | 'WAVE';
    targetId?: string;
    bomberStartX?: number;
    bomberStartY?: number;
    bomberEndX?: number;
    bomberEndY?: number;
  }> | null = null;
  public onActionTitanUlt: Listener<{
    action: 'CHARGE' | 'EXPLODE';
    titanId?: string;
    targetX?: number;
    targetY?: number;
    startedAt?: number;
    chargeSeconds?: number;
    radius?: number;
    ultCastId?: string;
  }> | null = null;
  public onStateSync: Listener<{
    nations: Array<{
      id: number;
      gold: number;
      goldIncome: number;
      oil?: number;
      minerals?: number;
      troops: number;
      maxTroops: number;
      population: number;
      territoryCount: number;
      isEliminated: boolean;
      techLevels?: { economy: number; military: number; defense: number };
      supremeTechUnlocked?: boolean;
      supremeTechLevels?: SupremeTechLevels;
      airSorties?: number;
      airSortieRegenTimer?: number;
      grandArsenalTimer?: number;
      airAdvancedUnlocked?: boolean;
    }>;
    superBuildingCounts?: Record<number, Record<string, number>>;
    darkTitans?: any[];
    pendingTitanSpawn?: PendingTitanSpawn | null;
    nextTitanSpawnAt?: number;
    airUnits?: AirUnit[];
    gameTimeSeconds?: number;
  }> | null = null;
  public onPlayerDisconnected: Listener<{ playerId: string; nationId: number; message: string }> | null = null;
  public onError: Listener<string> | null = null;
  public onConnectionChange: Listener<boolean> | null = null;

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  public connect(): Promise<boolean> {
    if (this.isConnected()) return Promise.resolve(true);
    if (this.isConnecting) return Promise.resolve(false);

    this.isConnecting = true;

    return new Promise((resolve) => {
      let opened = false;
      let failed = false;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      // Báo lỗi đúng 1 lần để giao diện không bị treo ở "Đang kết nối..."
      const fail = () => {
        if (failed || opened) return;
        failed = true;
        if (timeoutId) clearTimeout(timeoutId);
        this.isConnecting = false;
        this.messageQueue = [];
        try { this.ws?.close(); } catch (_e) { /* bỏ qua */ }
        this.ws = null;
        if (this.onError) {
          this.onError('Không kết nối được máy chủ chơi chung. Hãy kiểm tra mạng hoặc cấu hình máy chủ rồi thử lại.');
        }
        resolve(false);
      };

      try {
        // Ưu tiên địa chỉ máy chủ riêng (VITE_WS_URL), nếu không có thì dùng cùng tên miền
        const envUrl = (import.meta as any).env?.VITE_WS_URL as string | undefined;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = envUrl && envUrl.trim() ? envUrl.trim() : `${protocol}//${window.location.host}/ws`;

        this.ws = new WebSocket(wsUrl);
        timeoutId = setTimeout(fail, 30000);

        this.ws.onopen = () => {
          opened = true;
          if (timeoutId) clearTimeout(timeoutId);
          this.isConnecting = false;
          if (this.onConnectionChange) this.onConnectionChange(true);

          if (this.reconnectToken && this.roomCode && this.playerId) {
            this.send({
              type: 'RECONNECT_ROOM',
              roomCode: this.roomCode,
              playerId: this.playerId,
              reconnectToken: this.reconnectToken,
            });
          }

          // Gửi các tin nhắn đang chờ trong hàng đợi
          while (this.messageQueue.length > 0) {
            const msg = this.messageQueue.shift();
            if (msg) this.send(msg);
          }
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          try {
            const msg: ServerMessage = JSON.parse(event.data);
            this.handleServerMessage(msg);
          } catch (e) {
            console.error('Lỗi nhận dữ liệu WebSocket:', e);
          }
        };

        this.ws.onclose = () => {
          if (!opened) { fail(); return; }
          this.isConnecting = false;
          this.ws = null;
          if (this.onConnectionChange) this.onConnectionChange(false);
          if (this.onConnectionStatusChange) {
            this.onConnectionStatusChange({ status: 'DISCONNECTED', message: 'Mất kết nối' });
          }

          if (!this.isIntentionalLeave && this.reconnectToken && this.roomCode && this.playerId) {
            this.triggerReconnect();
          }
        };

        this.ws.onerror = (err) => {
          console.error('Lỗi kết nối WebSocket:', err);
          fail();
        };
      } catch (err) {
        console.error('Không thể mở kết nối WebSocket:', err);
        fail();
      }
    });
  }

  public send(msg: ClientMessage) {
    if (this.isConnected() && this.ws) {
      this.ws.send(JSON.stringify(msg));
    } else {
      this.messageQueue.push(msg);
      this.connect();
    }
  }

  private triggerReconnect() {
    if (this.isIntentionalLeave || this.isConnecting || this.isConnected()) return;
    if (this.reconnectAttempts >= 6) {
      if (this.onConnectionStatusChange) {
        this.onConnectionStatusChange({
          status: 'FAILED',
          message: 'Hết thời gian chờ khôi phục phiên (60s). Phiên chơi đã hết hạn hoặc máy chủ đã đóng.',
        });
      }
      if (this.onError) {
        this.onError('Hết thời gian chờ khôi phục phiên (60s).');
      }
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(10000, Math.pow(2, this.reconnectAttempts - 1) * 1000);

    if (this.onConnectionStatusChange) {
      this.onConnectionStatusChange({
        status: 'RECONNECTING',
        attempt: this.reconnectAttempts,
        message: `Mất mạng! Đang tự động kết nối lại (lần ${this.reconnectAttempts})...`,
      });
    }

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(async () => {
      if (this.isIntentionalLeave || this.isConnected()) return;
      await this.connect();
      if (!this.isConnected() && !this.isIntentionalLeave) {
        this.triggerReconnect();
      }
    }, delay);
  }

  private handleServerMessage(msg: ServerMessage) {
    switch (msg.type) {
      case 'ROOM_CREATED':
      case 'ROOM_JOINED':
        if (msg.reconnectToken) {
          this.reconnectToken = msg.reconnectToken;
          this.roomCode = msg.room.code;
          this.playerId = msg.myPlayerId;
        }
        this.reconnectAttempts = 0;
        if (this.onConnectionStatusChange) {
          this.onConnectionStatusChange({ status: 'CONNECTED', message: 'Đã kết nối thành công!' });
        }
        if (msg.type === 'ROOM_CREATED' && this.onRoomCreated) {
          this.onRoomCreated({ room: msg.room, myPlayerId: msg.myPlayerId });
        } else if (msg.type === 'ROOM_JOINED' && this.onRoomJoined) {
          this.onRoomJoined({ room: msg.room, myPlayerId: msg.myPlayerId });
        }
        break;
      case 'ROOM_UPDATED':
        if (this.onRoomUpdated) this.onRoomUpdated(msg.room);
        break;
      case 'GAME_STARTED':
        if (this.onGameStarted) this.onGameStarted(msg.room);
        break;
      case 'ACTION_ATTACK':
        if (this.onActionAttack) this.onActionAttack(msg);
        break;
      case 'ACTION_BUILD':
        if (this.onActionBuild) this.onActionBuild(msg);
        break;
      case 'ACTION_TECH':
        if (this.onActionTech) this.onActionTech(msg);
        break;
      case 'ACTION_SUPREME_TECH':
        if (this.onActionSupremeTech) this.onActionSupremeTech(msg);
        break;
      case 'ACTION_AIR':
        if (this.onActionAir) this.onActionAir(msg);
        break;
      case 'ACTION_TITAN_ULT':
        if (this.onActionTitanUlt) this.onActionTitanUlt(msg);
        break;
      case 'STATE_SYNC':
        if (this.onStateSync) this.onStateSync(msg);
        break;
      case 'PLAYER_DISCONNECTED':
        if (this.onPlayerDisconnected) this.onPlayerDisconnected(msg);
        break;
      case 'ERROR':
        if (this.onError) this.onError(msg.message);
        break;
    }
  }

  public async createRoom(playerName: string) {
    this.isIntentionalLeave = false;
    this.reconnectToken = null;
    this.roomCode = null;
    this.playerId = null;
    await this.connect();
    this.send({ type: 'CREATE_ROOM', playerName });
  }

  public async joinRoom(roomCode: string, playerName: string) {
    this.isIntentionalLeave = false;
    this.reconnectToken = null;
    this.roomCode = null;
    this.playerId = null;
    await this.connect();
    this.send({ type: 'JOIN_ROOM', roomCode, playerName });
  }

  public updateSettings(settings: Partial<RoomSettings>) {
    this.send({ type: 'UPDATE_SETTINGS', settings });
  }

  public startGame() {
    this.send({ type: 'START_GAME' });
  }

  public leaveRoom() {
    this.isIntentionalLeave = true;
    this.reconnectToken = null;
    this.roomCode = null;
    this.playerId = null;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.send({ type: 'LEAVE_ROOM' });
  }

  public sendAttack(fromNation: number, toNation: number, sourceX: number, sourceY: number, targetX: number, targetY: number, troops: number) {
    this.send({
      type: 'PLAYER_ATTACK',
      fromNation,
      toNation,
      sourceX,
      sourceY,
      targetX,
      targetY,
      troops,
    });
  }

  public sendBuild(targetX: number, targetY: number, buildingType: BuildingType, count: number = 1) {
    this.send({
      type: 'PLAYER_BUILD',
      targetX,
      targetY,
      buildingType,
      count,
    });
  }

  public sendTechSync(techLevels: { economy: number; military: number; defense: number }) {
    this.send({
      type: 'PLAYER_TECH_SYNC',
      techLevels,
    });
  }

  public sendSupremeResearch(techId: string) {
    this.send({
      type: 'PLAYER_SUPREME_RESEARCH',
      techId,
    });
  }

  public sendSupremeTechSync(supremeTechLevels: SupremeTechLevels) {
    this.send({
      type: 'PLAYER_SUPREME_TECH_SYNC',
      supremeTechLevels,
    });
  }

  public sendAirAction(payload: {
    action: 'PRODUCE' | 'LAUNCH';
    unitType: AirUnitType;
    targetX?: number;
    targetY?: number;
    targetKind?: 'TILE' | 'TITAN' | 'SHIP' | 'WAVE';
    targetId?: string;
    bomberStartX?: number;
    bomberStartY?: number;
    bomberEndX?: number;
    bomberEndY?: number;
  }) {
    this.send({
      type: 'PLAYER_AIR_ACTION',
      ...payload,
    });
  }

  public sendTitanUlt(payload: {
    action: 'CHARGE' | 'EXPLODE';
    titanId?: string;
    targetX?: number;
    targetY?: number;
    startedAt?: number;
    chargeSeconds?: number;
    radius?: number;
    ultCastId?: string;
  }) {
    this.send({
      type: 'PLAYER_TITAN_ULT',
      ...payload,
    });
  }

  public sendStateSync(
    nations: Array<{
      id: number;
      gold: number;
      goldIncome: number;
      oil?: number;
      minerals?: number;
      troops: number;
      maxTroops: number;
      population: number;
      territoryCount: number;
      isEliminated: boolean;
      techLevels?: { economy: number; military: number; defense: number };
      supremeTechUnlocked?: boolean;
      supremeTechLevels?: SupremeTechLevels;
      airSorties?: number;
      airSortieRegenTimer?: number;
      grandArsenalTimer?: number;
      airAdvancedUnlocked?: boolean;
    }>,
    darkTitans?: any[],
    gameTimeSeconds?: number,
    pendingTitanSpawn?: PendingTitanSpawn | null,
    nextTitanSpawnAt?: number,
    superBuildingCounts?: Record<number, Record<string, number>>,
    airUnits?: AirUnit[]
  ) {
    this.send({
      type: 'STATE_SYNC',
      nations,
      superBuildingCounts,
      darkTitans,
      pendingTitanSpawn,
      nextTitanSpawnAt,
      airUnits,
      gameTimeSeconds,
    });
  }
}

export const multiplayerClient = new MultiplayerClient();

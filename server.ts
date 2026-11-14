import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { SUPREME_TECH_CONFIG } from './src/data/gameData';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface RoomPlayer {
  id: string;
  name: string;
  isHost: boolean;
  nationId: number;
  color: string;
  isReady: boolean;
  connected: boolean;
}

interface RoomSettings {
  mapSize: number;
  difficulty: string;
  gameSpeed: number;
  botCount: number;
  maxPlayers: number;
}

interface RoomState {
  code: string;
  status: 'LOBBY' | 'PLAYING' | 'ENDED';
  settings: RoomSettings;
  players: RoomPlayer[];
  seed: number;
  hostId: string;
  createdAt: number;
}

type ClientMessage =
  | { type: 'CREATE_ROOM'; playerName: string }
  | { type: 'JOIN_ROOM'; roomCode: string; playerName: string }
  | { type: 'LEAVE_ROOM' }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<RoomSettings> }
  | { type: 'START_GAME' }
  | {
      type: 'PLAYER_ATTACK';
      fromNation: number;
      toNation: number;
      sourceX: number;
      sourceY: number;
      targetX: number;
      targetY: number;
      troops: number;
    }
  | {
      type: 'PLAYER_BUILD';
      targetX: number;
      targetY: number;
      buildingType: string;
      count: number;
    }
  | {
      type: 'PLAYER_TECH_SYNC';
      techLevels: { economy: number; military: number; defense: number };
    }
  | {
      type: 'PLAYER_SUPREME_RESEARCH';
      techId: string;
    }
  | {
      type: 'PLAYER_SUPREME_TECH_SYNC';
      supremeTechLevels: { economy: number; military: number; defense: number };
    }
  | {
      type: 'STATE_SYNC';
      nations: any[];
      superBuildingCounts?: Record<number, Record<string, number>>;
      darkTitans?: any[];
      pendingTitanSpawn?: any;
      nextTitanSpawnAt?: number;
      gameTimeSeconds?: number;
    }
  | { type: 'CHAT'; text: string };

type ServerMessage =
  | { type: 'ROOM_CREATED'; room: RoomState; myPlayerId: string }
  | { type: 'ROOM_JOINED'; room: RoomState; myPlayerId: string }
  | { type: 'ROOM_UPDATED'; room: RoomState }
  | { type: 'GAME_STARTED'; room: RoomState }
  | {
      type: 'ACTION_ATTACK';
      fromNation: number;
      toNation: number;
      sourceX: number;
      sourceY: number;
      targetX: number;
      targetY: number;
      troops: number;
    }
  | {
      type: 'ACTION_BUILD';
      nationId: number;
      targetX: number;
      targetY: number;
      buildingType: string;
      count: number;
    }
  | {
      type: 'ACTION_TECH';
      nationId: number;
      techLevels: { economy: number; military: number; defense: number };
    }
  | {
      type: 'ACTION_SUPREME_TECH';
      nationId: number;
      supremeTechUnlocked: boolean;
      supremeTechLevels: { economy: number; military: number; defense: number };
      researchingTechId?: string;
    }
  | {
      type: 'STATE_SYNC';
      nations: any[];
      superBuildingCounts?: Record<number, Record<string, number>>;
      darkTitans?: any[];
      pendingTitanSpawn?: any;
      nextTitanSpawnAt?: number;
      gameTimeSeconds?: number;
    }
  | { type: 'PLAYER_DISCONNECTED'; playerId: string; nationId: number; message: string }
  | { type: 'ERROR'; message: string };

interface ConnectedClient {
  ws: WebSocket;
  playerId: string;
  roomCode: string | null;
  msgCount: number;
  lastReset: number;
}

const PLAYER_COLORS = [
  '#3b82f6', // Xanh dương (Host - Nation 1)
  '#ef4444', // Đỏ tươi (Player 2 - Nation 2)
  '#10b981', // Xanh lục (Player 3 - Nation 3)
  '#8b5cf6', // Tím (Player 4 - Nation 4)
  '#f97316', // Cam (Player 5 - Nation 5)
  '#ec4899', // Hồng (Player 6 - Nation 6)
];

function sanitizePlayerName(name?: string): string {
  if (!name) return '';
  return name.replace(/[\x00-\x1F\x7F-\x9F<>]/g, '').trim().slice(0, 24);
}

const SUPER_BUILDING_TYPES = new Set(['SUPREME_FORTRESS', 'GRAND_ACADEMY', 'GRAND_ARSENAL']);
const MAX_SUPER_PER_TYPE = 1;
const MAX_SUPER_TOTAL_PER_NATION = 2;

interface RoomSuperState {
  builds: Map<number, Map<string, number>>;
  techLevels: Map<number, { economy: number; military: number; defense: number }>;
  supremeUnlocked: Map<number, boolean>;
  supremeTechLevels: Map<number, { economy: number; military: number; defense: number }>;
  resources: Map<number, { gold: number; oil: number; minerals: number }>;
  activeSupremeResearch: Map<number, string>;
}

class RoomManager {
  private rooms = new Map<string, RoomState>();
  private clients = new Map<WebSocket, ConnectedClient>();
  private roomSuperStates = new Map<string, RoomSuperState>();

  private getSuperState(roomCode: string): RoomSuperState {
    let st = this.roomSuperStates.get(roomCode);
    if (!st) {
      st = {
        builds: new Map(),
        techLevels: new Map(),
        supremeUnlocked: new Map(),
        supremeTechLevels: new Map(),
        resources: new Map(),
        activeSupremeResearch: new Map(),
      };
      this.roomSuperStates.set(roomCode, st);
    }
    return st;
  }

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  public handleConnection(ws: WebSocket) {
    const playerId = 'p_' + Math.random().toString(36).substring(2, 9);
    this.clients.set(ws, { ws, playerId, roomCode: null, msgCount: 0, lastReset: Date.now() });

    ws.on('message', (data: string | Buffer) => {
      try {
        const dataBuf = Buffer.isBuffer(data) ? data : Buffer.from(data as string);
        if (dataBuf.length > 65536) {
          // Bỏ qua tin nhắn lớn hơn 64KB
          return;
        }

        const client = this.clients.get(ws);
        if (!client) return;

        const now = Date.now();
        if (now - client.lastReset >= 1000) {
          client.msgCount = 0;
          client.lastReset = now;
        }
        client.msgCount++;
        if (client.msgCount > 30) {
          // Tối đa 30 tin mỗi giây cho mỗi kết nối
          return;
        }

        const message: ClientMessage = JSON.parse(dataBuf.toString());
        this.processMessage(ws, message);
      } catch (err) {
        console.error('Lỗi phân tích WebSocket message:', err);
      }
    });

    ws.on('close', () => {
      this.handleDisconnect(ws);
    });

    ws.on('error', (err) => {
      console.error('Lỗi kết nối socket client:', err);
    });
  }

  private send(ws: WebSocket, msg: ServerMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  private broadcastToRoom(roomCode: string, msg: ServerMessage, excludeWs?: WebSocket) {
    for (const [ws, client] of this.clients.entries()) {
      if (client.roomCode === roomCode && ws !== excludeWs) {
        this.send(ws, msg);
      }
    }
  }

  private processMessage(ws: WebSocket, msg: ClientMessage) {
    const client = this.clients.get(ws);
    if (!client) return;

    switch (msg.type) {
      case 'CREATE_ROOM': {
        let code = this.generateRoomCode();
        while (this.rooms.has(code)) {
          code = this.generateRoomCode();
        }

        const cleanedName = sanitizePlayerName(msg.playerName) || 'Chủ Phòng';

        const hostPlayer: RoomPlayer = {
          id: client.playerId,
          name: cleanedName,
          isHost: true,
          nationId: 1,
          color: PLAYER_COLORS[0],
          isReady: true,
          connected: true,
        };

        const defaultSettings: RoomSettings = {
          mapSize: 96,
          difficulty: 'NORMAL',
          gameSpeed: 1,
          botCount: 4,
          maxPlayers: 6,
        };

        const newRoom: RoomState = {
          code,
          status: 'LOBBY',
          settings: defaultSettings,
          players: [hostPlayer],
          seed: Math.floor(Math.random() * 1000000),
          hostId: client.playerId,
          createdAt: Date.now(),
        };

        this.rooms.set(code, newRoom);
        client.roomCode = code;

        this.send(ws, {
          type: 'ROOM_CREATED',
          room: newRoom,
          myPlayerId: client.playerId,
        });
        break;
      }

      case 'JOIN_ROOM': {
        const code = msg.roomCode?.toUpperCase().trim();
        const room = this.rooms.get(code);

        if (!room) {
          this.send(ws, { type: 'ERROR', message: `Không tìm thấy phòng [${code}]. Vui lòng kiểm tra lại mã!` });
          return;
        }

        if (room.status !== 'LOBBY') {
          this.send(ws, { type: 'ERROR', message: 'Trận đấu trong phòng này đã bắt đầu rồi!' });
          return;
        }

        if (room.players.length >= room.settings.maxPlayers) {
          this.send(ws, { type: 'ERROR', message: 'Phòng đã đủ số người chơi tối đa!' });
          return;
        }

        const usedNationIds = new Set(room.players.map(p => p.nationId));
        let assignedNationId = 2;
        for (let i = 2; i <= 6; i++) {
          if (!usedNationIds.has(i)) {
            assignedNationId = i;
            break;
          }
        }

        const cleanedName = sanitizePlayerName(msg.playerName) || `Người chơi ${room.players.length + 1}`;

        const newPlayer: RoomPlayer = {
          id: client.playerId,
          name: cleanedName,
          isHost: false,
          nationId: assignedNationId,
          color: PLAYER_COLORS[(assignedNationId - 1) % PLAYER_COLORS.length],
          isReady: true,
          connected: true,
        };

        room.players.push(newPlayer);
        client.roomCode = code;

        this.send(ws, {
          type: 'ROOM_JOINED',
          room,
          myPlayerId: client.playerId,
        });

        this.broadcastToRoom(code, {
          type: 'ROOM_UPDATED',
          room,
        });
        break;
      }

      case 'UPDATE_SETTINGS': {
        if (!client.roomCode) return;
        const room = this.rooms.get(client.roomCode);
        if (!room || room.hostId !== client.playerId) return;
        if (room.status !== 'LOBBY') return;

        if (msg.settings) {
          const s = msg.settings;
          if (typeof s.mapSize === 'number' && Number.isInteger(s.mapSize) && s.mapSize >= 32 && s.mapSize <= 192) {
            room.settings.mapSize = s.mapSize;
          }
          if (typeof s.gameSpeed === 'number' && s.gameSpeed >= 1 && s.gameSpeed <= 4) {
            room.settings.gameSpeed = s.gameSpeed;
          }
          if (typeof s.botCount === 'number' && Number.isInteger(s.botCount) && s.botCount >= 0 && s.botCount <= 8) {
            room.settings.botCount = s.botCount;
          }
          if (typeof s.maxPlayers === 'number' && Number.isInteger(s.maxPlayers) && s.maxPlayers >= 2 && s.maxPlayers <= 6) {
            room.settings.maxPlayers = s.maxPlayers;
          }
          if (s.difficulty && ['EASY', 'NORMAL', 'HARD'].includes(s.difficulty)) {
            room.settings.difficulty = s.difficulty;
          }
        }

        this.broadcastToRoom(client.roomCode, {
          type: 'ROOM_UPDATED',
          room,
        });
        break;
      }

      case 'START_GAME': {
        if (!client.roomCode) return;
        const room = this.rooms.get(client.roomCode);
        if (!room || room.hostId !== client.playerId) return;

        room.status = 'PLAYING';
        this.broadcastToRoom(client.roomCode, {
          type: 'GAME_STARTED',
          room,
        });
        break;
      }

      case 'PLAYER_ATTACK': {
        if (!client.roomCode) return;
        const room = this.rooms.get(client.roomCode);
        if (!room || room.status !== 'PLAYING') return;

        const player = room.players.find(p => p.id === client.playerId);
        if (!player) return;

        if (msg.fromNation !== player.nationId) return;
        if (typeof msg.troops !== 'number' || msg.troops <= 0) return;

        this.broadcastToRoom(client.roomCode, {
          type: 'ACTION_ATTACK',
          fromNation: player.nationId,
          toNation: msg.toNation,
          sourceX: msg.sourceX,
          sourceY: msg.sourceY,
          targetX: msg.targetX,
          targetY: msg.targetY,
          troops: msg.troops,
        }, ws);
        break;
      }

      case 'PLAYER_BUILD': {
        if (!client.roomCode) return;
        const room = this.rooms.get(client.roomCode);
        if (!room || room.status !== 'PLAYING') return;

        const player = room.players.find(p => p.id === client.playerId);
        if (!player) return;

        if (typeof msg.buildingType !== 'string' || msg.buildingType.length === 0 || msg.buildingType.length > 32) return;
        if (typeof msg.count !== 'number' || !Number.isInteger(msg.count) || msg.count < 1 || msg.count > 100) return;

        // Kiểm tra điều kiện & giới hạn Siêu Công Trình trên server
        if (SUPER_BUILDING_TYPES.has(msg.buildingType)) {
          if (msg.count !== 1) {
            this.send(ws, { type: 'ERROR', message: 'Chỉ được xây 1 Siêu Công Trình mỗi lần!' });
            return;
          }
          const superState = this.getSuperState(client.roomCode);
          const tech = superState.techLevels.get(player.nationId);
          if (!tech || tech.economy < 3 || tech.military < 3 || tech.defense < 3) {
            this.send(ws, { type: 'ERROR', message: 'Chưa mở khóa cấp 3 cả 3 nhánh công nghệ để xây Siêu Công Trình!' });
            return;
          }
          let nationBuilds = superState.builds.get(player.nationId);
          if (!nationBuilds) {
            nationBuilds = new Map<string, number>();
            superState.builds.set(player.nationId, nationBuilds);
          }
          const typeCount = nationBuilds.get(msg.buildingType) || 0;
          if (typeCount >= MAX_SUPER_PER_TYPE) {
            this.send(ws, { type: 'ERROR', message: 'Mỗi loại Siêu Công Trình chỉ được xây tối đa 1!' });
            return;
          }
          let totalCount = 0;
          SUPER_BUILDING_TYPES.forEach(sType => {
            totalCount += nationBuilds!.get(sType) || 0;
          });
          if (totalCount >= MAX_SUPER_TOTAL_PER_NATION) {
            this.send(ws, { type: 'ERROR', message: 'Mỗi quốc gia chỉ được sở hữu tối đa 2 Siêu Công Trình!' });
            return;
          }
          nationBuilds.set(msg.buildingType, typeCount + 1);
        }

        if (msg.buildingType === 'BUNKER') {
          const superState = this.getSuperState(client.roomCode);
          let nationBuilds = superState.builds.get(player.nationId);
          if (!nationBuilds) {
            nationBuilds = new Map<string, number>();
            superState.builds.set(player.nationId, nationBuilds);
          }
          const builtBunkers = nationBuilds.get('BUNKER') || 0;
          if (builtBunkers >= 10) {
            this.send(ws, { type: 'ERROR', message: 'Mỗi quốc gia chỉ được sở hữu tối đa 10 Lô Cốt!' });
            return;
          }
          nationBuilds.set('BUNKER', Math.min(10, builtBunkers + Math.max(1, Number(msg.count) || 1)));
        }

        this.broadcastToRoom(client.roomCode, {
          type: 'ACTION_BUILD',
          nationId: player.nationId,
          targetX: msg.targetX,
          targetY: msg.targetY,
          buildingType: msg.buildingType,
          count: msg.count,
        }, ws);
        break;
      }

      case 'PLAYER_TECH_SYNC': {
        if (!client.roomCode) return;
        const room = this.rooms.get(client.roomCode);
        if (!room || room.status !== 'PLAYING') return;

        const player = room.players.find(p => p.id === client.playerId);
        if (!player || !msg.techLevels) return;

        const superState = this.getSuperState(client.roomCode);
        const prev = superState.techLevels.get(player.nationId) || { economy: 0, military: 0, defense: 0 };
        const clampLvl = (val: unknown, oldVal: number) => {
          const n = typeof val === 'number' && Number.isFinite(val) ? Math.floor(val) : 0;
          return Math.max(oldVal, Math.min(3, Math.max(0, n)));
        };
        const updated = {
          economy: clampLvl(msg.techLevels.economy, prev.economy),
          military: clampLvl(msg.techLevels.military, prev.military),
          defense: clampLvl(msg.techLevels.defense, prev.defense),
        };
        superState.techLevels.set(player.nationId, updated);

        this.broadcastToRoom(client.roomCode, {
          type: 'ACTION_TECH',
          nationId: player.nationId,
          techLevels: updated,
        }, ws);
        break;
      }

      case 'PLAYER_SUPREME_RESEARCH': {
        if (!client.roomCode) return;
        const room = this.rooms.get(client.roomCode);
        if (!room || room.status !== 'PLAYING') return;

        const player = room.players.find(p => p.id === client.playerId);
        if (!player) return;

        const tech = SUPREME_TECH_CONFIG.TECHS.find(t => t.id === msg.techId);
        if (!tech) {
          this.send(ws, { type: 'ERROR', message: 'Công nghệ Tối Thượng không hợp lệ!' });
          return;
        }

        const superState = this.getSuperState(client.roomCode);
        if (!superState.supremeUnlocked.get(player.nationId)) {
          this.send(ws, { type: 'ERROR', message: 'Cần xây xong Đại Học Viện để mở khóa Công Nghệ Tối Thượng!' });
          return;
        }

        const curLevels = superState.supremeTechLevels.get(player.nationId) || { economy: 0, military: 0, defense: 0 };
        if (curLevels[tech.branchKey] !== tech.level - 1) {
          this.send(ws, { type: 'ERROR', message: 'Chưa đủ điều kiện cấp trước hoặc đã nghiên cứu xong!' });
          return;
        }

        if (superState.activeSupremeResearch.has(player.nationId)) {
          this.send(ws, { type: 'ERROR', message: 'Đang nghiên cứu Công Nghệ Tối Thượng khác!' });
          return;
        }

        const res = superState.resources.get(player.nationId);
        if (!res || res.gold < tech.cost || res.oil < tech.oilCost || res.minerals < tech.mineralCost) {
          this.send(ws, { type: 'ERROR', message: 'Không đủ Vàng, Dầu hoặc Khoáng sản để nghiên cứu Công Nghệ Tối Thượng!' });
          return;
        }

        res.gold -= tech.cost;
        res.oil -= tech.oilCost;
        res.minerals -= tech.mineralCost;
        superState.activeSupremeResearch.set(player.nationId, tech.id);

        this.broadcastToRoom(client.roomCode, {
          type: 'ACTION_SUPREME_TECH',
          nationId: player.nationId,
          supremeTechUnlocked: true,
          supremeTechLevels: curLevels,
          researchingTechId: tech.id,
        }, ws);
        break;
      }

      case 'PLAYER_SUPREME_TECH_SYNC': {
        if (!client.roomCode) return;
        const room = this.rooms.get(client.roomCode);
        if (!room || room.status !== 'PLAYING') return;

        const player = room.players.find(p => p.id === client.playerId);
        if (!player || !msg.supremeTechLevels) return;

        const superState = this.getSuperState(client.roomCode);
        if (!superState.supremeUnlocked.get(player.nationId)) {
          this.send(ws, { type: 'ERROR', message: 'Chưa mở khóa Công Nghệ Tối Thượng!' });
          return;
        }

        const activeTechId = superState.activeSupremeResearch.get(player.nationId);
        const activeTech = activeTechId
          ? SUPREME_TECH_CONFIG.TECHS.find(t => t.id === activeTechId)
          : undefined;
        if (!activeTech) {
          this.send(ws, { type: 'ERROR', message: 'Chưa bắt đầu nghiên cứu Công Nghệ Tối Thượng hợp lệ trên máy chủ!' });
          return;
        }

        const prev = superState.supremeTechLevels.get(player.nationId) || { economy: 0, military: 0, defense: 0 };
        const targetRequested = Number(msg.supremeTechLevels[activeTech.branchKey]) || 0;
        if (targetRequested < activeTech.level) return;

        const updated = {
          economy: prev.economy,
          military: prev.military,
          defense: prev.defense,
        };
        updated[activeTech.branchKey] = Math.min(SUPREME_TECH_CONFIG.MAX_LEVEL, Math.max(prev[activeTech.branchKey], activeTech.level));
        superState.supremeTechLevels.set(player.nationId, updated);
        superState.activeSupremeResearch.delete(player.nationId);

        this.broadcastToRoom(client.roomCode, {
          type: 'ACTION_SUPREME_TECH',
          nationId: player.nationId,
          supremeTechUnlocked: true,
          supremeTechLevels: updated,
        }, ws);
        break;
      }

      case 'STATE_SYNC': {
        if (!client.roomCode) return;
        const room = this.rooms.get(client.roomCode);
        if (!room || room.hostId !== client.playerId) return;

        const superState = this.getSuperState(client.roomCode);
        if (Array.isArray(msg.nations)) {
          for (const n of msg.nations) {
            if (n && typeof n.id === 'number') {
              if (n.techLevels) {
                const prev = superState.techLevels.get(n.id) || { economy: 0, military: 0, defense: 0 };
                superState.techLevels.set(n.id, {
                  economy: Math.max(prev.economy, Number(n.techLevels.economy) || 0),
                  military: Math.max(prev.military, Number(n.techLevels.military) || 0),
                  defense: Math.max(prev.defense, Number(n.techLevels.defense) || 0),
                });
              }
              if (typeof n.gold === 'number' || typeof n.oil === 'number' || typeof n.minerals === 'number') {
                const prevRes = superState.resources.get(n.id) || { gold: 0, oil: 0, minerals: 0 };
                superState.resources.set(n.id, {
                  gold: typeof n.gold === 'number' && Number.isFinite(n.gold) ? n.gold : prevRes.gold,
                  oil: typeof n.oil === 'number' && Number.isFinite(n.oil) ? n.oil : prevRes.oil,
                  minerals: typeof n.minerals === 'number' && Number.isFinite(n.minerals) ? n.minerals : prevRes.minerals,
                });
              }
              if (n.supremeTechUnlocked) {
                superState.supremeUnlocked.set(n.id, true);
              }
              if (n.supremeTechLevels && typeof n.supremeTechLevels === 'object') {
                const prevSup = superState.supremeTechLevels.get(n.id) || { economy: 0, military: 0, defense: 0 };
                superState.supremeTechLevels.set(n.id, {
                  economy: Math.min(SUPREME_TECH_CONFIG.MAX_LEVEL, Math.max(prevSup.economy, Number(n.supremeTechLevels.economy) || 0)),
                  military: Math.min(SUPREME_TECH_CONFIG.MAX_LEVEL, Math.max(prevSup.military, Number(n.supremeTechLevels.military) || 0)),
                  defense: Math.min(SUPREME_TECH_CONFIG.MAX_LEVEL, Math.max(prevSup.defense, Number(n.supremeTechLevels.defense) || 0)),
                });
              }
            }
          }
        }
        if (msg.superBuildingCounts && typeof msg.superBuildingCounts === 'object') {
          const nextBuilds = new Map<number, Map<string, number>>();
          for (const [natKey, counts] of Object.entries(msg.superBuildingCounts)) {
            const natId = Number(natKey);
            if (!Number.isInteger(natId) || !counts || typeof counts !== 'object') continue;
            const m = new Map<string, number>();
            SUPER_BUILDING_TYPES.forEach(sType => {
              const c = Number((counts as Record<string, unknown>)[sType]) || 0;
              if (c > 0) m.set(sType, Math.min(MAX_SUPER_PER_TYPE, c));
            });
            nextBuilds.set(natId, m);
          }
          superState.builds = nextBuilds;
        }

        this.broadcastToRoom(client.roomCode, {
          type: 'STATE_SYNC',
          nations: msg.nations,
          superBuildingCounts: msg.superBuildingCounts,
          darkTitans: msg.darkTitans,
          pendingTitanSpawn: msg.pendingTitanSpawn,
          nextTitanSpawnAt: msg.nextTitanSpawnAt,
          gameTimeSeconds: msg.gameTimeSeconds,
        }, ws);
        break;
      }

      case 'LEAVE_ROOM': {
        this.leaveCurrentRoom(ws);
        break;
      }
    }
  }

  private leaveCurrentRoom(ws: WebSocket) {
    const client = this.clients.get(ws);
    if (!client || !client.roomCode) return;

    const code = client.roomCode;
    const room = this.rooms.get(code);
    client.roomCode = null;

    if (!room) return;

    const playerIndex = room.players.findIndex(p => p.id === client.playerId);
    if (playerIndex === -1) return;

    const [leftPlayer] = room.players.splice(playerIndex, 1);

    if (room.players.length === 0) {
      this.rooms.delete(code);
      this.roomSuperStates.delete(code);
    } else {
      if (leftPlayer.isHost && room.players.length > 0) {
        room.players[0].isHost = true;
        room.hostId = room.players[0].id;
      }

      if (room.status === 'PLAYING') {
        this.broadcastToRoom(code, {
          type: 'PLAYER_DISCONNECTED',
          playerId: leftPlayer.id,
          nationId: leftPlayer.nationId,
          message: `${leftPlayer.name} đã rời phòng. Bot AI đã tiếp quản quốc gia này!`,
        });
      }

      this.broadcastToRoom(code, {
        type: 'ROOM_UPDATED',
        room,
      });
    }
  }

  private handleDisconnect(ws: WebSocket) {
    this.leaveCurrentRoom(ws);
    this.clients.delete(ws);
  }
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Khởi tạo WebSocket Server cho hệ thống phòng chơi thời gian thực
  const wss = new WebSocketServer({ server, path: '/ws' });
  const roomManager = new RoomManager();

  wss.on('connection', (ws) => {
    roomManager.handleConnection(ws);
  });

  // API kiểm tra tình trạng server
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: Date.now() });
  });

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    // Trong môi trường dev: Tích hợp Vite dev server middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Trong môi trường production: Phục vụ file tĩnh từ thư mục dist
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Pixel Empire Server running on http://0.0.0.0:${PORT}`);
    console.log(`📡 WebSocket ready on ws://0.0.0.0:${PORT}/ws`);
  });
}

startServer().catch((err) => {
  console.error('Lỗi khởi động server:', err);
});

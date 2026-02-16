import { Server } from "socket.io";

const areaPresence = new Map<string, Set<string>>();

export const registerSocket = (io: Server) => {
  io.on("connection", (socket) => {
    socket.on("area:join", ({ areaId, username }: { areaId: string; username: string }) => {
      socket.data.areaId = areaId;
      socket.data.username = username;
      socket.join(`area:${areaId}`);
      if (!areaPresence.has(areaId)) areaPresence.set(areaId, new Set());
      areaPresence.get(areaId)?.add(username);
      io.to(`area:${areaId}`).emit("area:presence_update", {
        areaId,
        count: areaPresence.get(areaId)?.size ?? 0,
        users: [...(areaPresence.get(areaId) ?? new Set())]
      });
    });

    socket.on("area:leave", ({ areaId, username }: { areaId: string; username: string }) => {
      socket.leave(`area:${areaId}`);
      areaPresence.get(areaId)?.delete(username);
      io.to(`area:${areaId}`).emit("area:presence_update", {
        areaId,
        count: areaPresence.get(areaId)?.size ?? 0,
        users: [...(areaPresence.get(areaId) ?? new Set())]
      });
    });

    socket.on("disconnect", () => {
      const areaId = socket.data.areaId;
      const username = socket.data.username;
      if (areaId && username) {
        areaPresence.get(areaId)?.delete(username);
        io.to(`area:${areaId}`).emit("area:presence_update", {
          areaId,
          count: areaPresence.get(areaId)?.size ?? 0,
          users: [...(areaPresence.get(areaId) ?? new Set())]
        });
      }
    });
  });
};

export const broadcastTournament = (io: Server, payload: unknown) => io.emit("tournament:status", payload);
export const broadcastMatchResult = (io: Server, payload: unknown) => io.emit("tournament:match_result", payload);

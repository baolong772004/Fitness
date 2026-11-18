import { Request, Response } from 'express';
import prisma from '../config/prisma.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';

const VALID_EQUIPMENT_STATUSES = new Set(['AVAILABLE', 'MAINTENANCE', 'UNDER_MAINTENANCE', 'BROKEN']);

/**
 * API: Thêm/Sửa Phòng tập (Admin)
 * @route POST /api/facility/rooms
 */
export const upsertRoom = async (req: AuthRequest, res: Response) => {
  try {
    const { id, name, type, capacity, isActive } = req.body;

    const roomId = id ? Number(id) : null;
    if (id && (!Number.isSafeInteger(roomId) || roomId! <= 0)) {
      return res.status(400).json({ success: false, message: 'ID phòng tập không hợp lệ' });
    }

    const result = await prisma.$transaction(async (tx) => {
      let existing: { id: number; name: string; type: string; capacity: number; isActive: boolean } | null = null;
      if (roomId) {
        existing = await tx.room.findUnique({
          where: { id: roomId },
          select: { id: true, name: true, type: true, capacity: true, isActive: true },
        });
        if (!existing) {
          return { kind: 'NOT_FOUND' as const };
        }
      } else if (!name || !type || !capacity) {
        return { kind: 'BAD_REQUEST' as const, message: 'Thiếu thông tin phòng tập' };
      }

      const nextName = name !== undefined ? String(name).trim() : existing!.name;
      const nextType = type !== undefined ? String(type).trim() : existing!.type;
      const parsedCapacity = capacity !== undefined ? Number(capacity) : existing!.capacity;
      if (!nextName || !nextType || !Number.isFinite(parsedCapacity) || parsedCapacity <= 0) {
        return { kind: 'BAD_REQUEST' as const, message: 'Tên, loại hoặc sức chứa phòng tập không hợp lệ' };
      }

      const nextActive = isActive !== undefined ? Boolean(isActive) : (existing?.isActive ?? true);
      const room = existing
        ? await tx.room.update({
            where: { id: existing.id },
            data: { name: nextName, type: nextType, capacity: parsedCapacity, isActive: nextActive },
          })
        : await tx.room.create({
            data: { name: nextName, type: nextType, capacity: parsedCapacity, isActive: nextActive },
          });

      if (req.user?.userId) {
        await tx.actionLog.create({
          data: {
            userId: req.user.userId,
            action: existing ? 'FACILITY_ROOM_UPDATE' : 'FACILITY_ROOM_CREATE',
            details: JSON.stringify({
              roomId: room.id,
              roomName: room.name,
              roomType: room.type,
              capacity: room.capacity,
              ...(existing && existing.isActive !== nextActive
                ? { previousStatus: existing.isActive ? 'ACTIVE' : 'INACTIVE', newStatus: nextActive ? 'ACTIVE' : 'INACTIVE' }
                : {}),
            }),
          },
        });
      }

      return { kind: 'OK' as const, room };
    });

    if (result.kind === 'NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Không tìm thấy phòng tập' });
    }
    if (result.kind === 'BAD_REQUEST') {
      return res.status(400).json({ success: false, message: result.message });
    }

    return res.status(200).json({ success: true, message: 'Lưu phòng tập thành công', data: result.room });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Lỗi lưu phòng tập' });
  }
};

/**
 * API: Lấy danh sách Phòng tập & Thiết bị bên trong
 * @route GET /api/facility/rooms
 */
export const getRooms = async (req: Request, res: Response) => {
  try {
    const rooms = await prisma.room.findMany({
      include: {
        equipments: true
      }
    });

    return res.status(200).json({ success: true, data: rooms });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Lỗi lấy danh sách phòng tập' });
  }
};

/**
 * API: Cập nhật Trạng thái Thiết bị (Bảo trì)
 * @route PATCH /api/facility/equipment/:id/status
 */
export const updateEquipmentStatus = async (req: AuthRequest, res: Response) => {
  try {
    const equipmentId = Number(req.params.id);
    const { status, note } = req.body; // 'AVAILABLE' | 'MAINTENANCE' | 'UNDER_MAINTENANCE' | 'BROKEN'

    if (!Number.isSafeInteger(equipmentId) || equipmentId <= 0) {
      return res.status(400).json({ success: false, message: 'ID thiết bị không hợp lệ' });
    }
    if (!status || !VALID_EQUIPMENT_STATUSES.has(String(status))) {
      return res.status(400).json({ success: false, message: 'Trạng thái thiết bị không hợp lệ' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.equipment.findUnique({
        where: { id: equipmentId },
        include: { room: { select: { name: true } } },
      });
      if (!existing) {
        return { notFound: true as const };
      }

      const nextNote = note !== undefined ? (note ? String(note).trim() : null) : existing.note;
      const equipment = await tx.equipment.update({
        where: { id: equipmentId },
        data: { status: String(status), note: nextNote },
      });

      if (req.user?.userId) {
        await tx.actionLog.create({
          data: {
            userId: req.user.userId,
            action: 'EQUIPMENT_STATUS_UPDATE',
            details: JSON.stringify({
              equipmentId: existing.id,
              equipmentName: existing.name,
              equipmentCode: existing.code,
              roomName: existing.room?.name || null,
              previousStatus: existing.status,
              newStatus: String(status),
              ...(nextNote ? { notes: nextNote } : {}),
            }),
          },
        });
      }

      return { notFound: false as const, equipment };
    });

    if (result.notFound) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thiết bị' });
    }

    return res.status(200).json({
      success: true,
      message: `Đã đổi trạng thái thiết bị thành ${status}`,
      data: result.equipment
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Lỗi cập nhật trạng thái thiết bị' });
  }
};
/**
 * API: Thêm thiết bị mới vào phòng tập (Admin)
 * @route POST /api/facility/equipment
 */
export const createEquipment = async (req: AuthRequest, res: Response) => {
  try {
    const { name, code, roomId, note } = req.body;
    const parsedRoomId = Number(roomId);

    if (!name || !code || !Number.isSafeInteger(parsedRoomId) || parsedRoomId <= 0) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin thiết bị hoặc roomId không hợp lệ' });
    }

    const roomExists = await prisma.room.findUnique({ where: { id: parsedRoomId }, select: { id: true } });
    if (!roomExists) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy phòng tập được chọn' });
    }

    const equipment = await prisma.$transaction(async (tx) => {
      const created = await tx.equipment.create({
        data: { name: String(name).trim(), code: String(code).trim(), roomId: parsedRoomId, note: note ? String(note).trim() : null },
        include: { room: { select: { name: true } } },
      });

      if (req.user?.userId) {
        await tx.actionLog.create({
          data: {
            userId: req.user.userId,
            action: 'FACILITY_EQUIPMENT_CREATE',
            details: JSON.stringify({
              equipmentId: created.id,
              equipmentName: created.name,
              equipmentCode: created.code,
              roomName: created.room?.name || null,
            }),
          },
        });
      }

      return created;
    });

    return res.status(201).json({ success: true, message: 'Thêm thiết bị thành công', data: equipment });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, message: 'Mã thiết bị (code) đã tồn tại' });
    }
    return res.status(500).json({ success: false, message: 'Lỗi thêm thiết bị' });
  }
};

/**
 * API: Cập nhật thông tin & ghi chú thiết bị (Admin/Staff)
 * @route PATCH /api/facility/equipment/:id
 */
export const updateEquipment = async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'ID thiết bị không hợp lệ' });
    }

    const { name, code, roomId, status, note } = req.body;
    if (status !== undefined && !VALID_EQUIPMENT_STATUSES.has(String(status))) {
      return res.status(400).json({ success: false, message: 'Trạng thái thiết bị không hợp lệ' });
    }

    const parsedRoomId = roomId !== undefined ? Number(roomId) : undefined;
    if (parsedRoomId !== undefined && (!Number.isSafeInteger(parsedRoomId) || parsedRoomId <= 0)) {
      return res.status(400).json({ success: false, message: 'roomId không hợp lệ' });
    }

    if (parsedRoomId !== undefined) {
      const targetRoom = await prisma.room.findUnique({ where: { id: parsedRoomId }, select: { id: true } });
      if (!targetRoom) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy phòng đặt thiết bị' });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.equipment.findUnique({
        where: { id },
        include: { room: { select: { name: true } } },
      });
      if (!existing) return null;

      const nextName = name !== undefined ? String(name).trim() : existing.name;
      const nextCode = code !== undefined ? String(code).trim() : existing.code;
      if (!nextName || !nextCode) {
        throw new Error('INVALID_EQUIPMENT_FIELDS');
      }

      const nextStatus = status !== undefined ? String(status) : existing.status;
      const nextNote = note !== undefined ? (String(note).trim() || null) : existing.note;

      const updated = await tx.equipment.update({
        where: { id },
        data: {
          name: nextName,
          code: nextCode,
          ...(parsedRoomId !== undefined ? { roomId: parsedRoomId } : {}),
          status: nextStatus,
          note: nextNote,
        },
        include: { room: { select: { name: true } } },
      });

      if (req.user?.userId) {
        const statusChanged = existing.status !== nextStatus;
        const roomChanged = existing.roomId !== updated.roomId;
        await tx.actionLog.create({
          data: {
            userId: req.user.userId,
            action: statusChanged ? 'EQUIPMENT_STATUS_UPDATE' : 'FACILITY_EQUIPMENT_UPDATE',
            details: JSON.stringify({
              equipmentId: updated.id,
              equipmentName: updated.name,
              equipmentCode: updated.code,
              roomName: updated.room?.name || null,
              ...(roomChanged
                ? {
                    previousRoomId: existing.roomId,
                    newRoomId: updated.roomId,
                    previousRoomName: existing.room?.name || `Phòng #${existing.roomId}`,
                    newRoomName: updated.room?.name || `Phòng #${updated.roomId}`,
                  }
                : {}),
              ...(statusChanged
                ? { previousStatus: existing.status, newStatus: nextStatus }
                : {}),
              ...(nextNote ? { notes: nextNote } : {}),
            }),
          },
        });
      }

      return updated;
    });

    if (!result) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thiết bị' });
    }

    return res.status(200).json({ success: true, message: 'Đã cập nhật thông tin thiết bị', data: result });
  } catch (error: any) {
    if (error?.message === 'INVALID_EQUIPMENT_FIELDS') {
      return res.status(400).json({ success: false, message: 'Tên và mã thiết bị không được để trống' });
    }
    if (error?.code === 'P2002') {
      return res.status(400).json({ success: false, message: 'Mã thiết bị (code) đã tồn tại' });
    }
    return res.status(500).json({ success: false, message: 'Lỗi cập nhật thiết bị' });
  }
};

/**
 * API: Xóa thiết bị (Admin)
 * @route DELETE /api/facility/equipment/:id
 */
export const deleteEquipment = async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'ID thiết bị không hợp lệ' });
    }

    const deleted = await prisma.$transaction(async (tx) => {
      const existing = await tx.equipment.findUnique({
        where: { id },
        include: { room: { select: { name: true } } },
      });
      if (!existing) return null;

      await tx.equipment.delete({ where: { id } });

      if (req.user?.userId) {
        await tx.actionLog.create({
          data: {
            userId: req.user.userId,
            action: 'FACILITY_EQUIPMENT_DELETE',
            details: JSON.stringify({
              equipmentId: existing.id,
              equipmentName: existing.name,
              equipmentCode: existing.code,
              roomName: existing.room?.name || null,
            }),
          },
        });
      }

      return existing;
    });

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thiết bị' });
    }

    return res.status(200).json({ success: true, message: 'Đã xóa thiết bị' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Lỗi xóa thiết bị' });
  }
};

import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * API: Thêm/Sửa Phòng tập (Admin)
 * @route POST /api/facility/rooms
 */
export const upsertRoom = async (req: Request, res: Response) => {
  try {
    const { id, name, type, capacity, isActive } = req.body;

    if (!name || !type || !capacity) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin phòng tập' });
    }

    let room;
    if (id) {
      room = await prisma.room.update({
        where: { id: Number(id) },
        data: { name, type, capacity: Number(capacity), isActive: isActive ?? true }
      });
    } else {
      room = await prisma.room.create({
        data: { name, type, capacity: Number(capacity), isActive: isActive ?? true }
      });
    }

    return res.status(200).json({ success: true, message: 'Lưu phòng tập thành công', data: room });
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
export const updateEquipmentStatus = async (req: Request, res: Response) => {
  try {
    const equipmentId = Number(req.params.id);
    const { status, note } = req.body; // 'AVAILABLE', 'MAINTENANCE', 'BROKEN'

    if (!status) return res.status(400).json({ success: false, message: 'Thiếu trạng thái thiết bị' });

    const equipment = await prisma.equipment.update({
      where: { id: equipmentId },
      data: { status, note }
    });

    return res.status(200).json({
      success: true,
      message: `Đã đổi trạng thái thiết bị thành ${status}`,
      data: equipment
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Lỗi cập nhật trạng thái thiết bị' });
  }
};
/**
 * API: Thêm thiết bị mới vào phòng tập (Admin)
 * @route POST /api/facility/equipment
 */
export const createEquipment = async (req: Request, res: Response) => {
  try {
    const { name, code, roomId, note } = req.body;

    if (!name || !code || !roomId) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin thiết bị (name, code, roomId)' });
    }

    const equipment = await prisma.equipment.create({
      data: { name, code, roomId: Number(roomId), note }
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
 * API: Xóa thiết bị (Admin)
 * @route DELETE /api/facility/equipment/:id
 */
export const deleteEquipment = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await prisma.equipment.delete({ where: { id } });
    return res.status(200).json({ success: true, message: 'Đã xóa thiết bị' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Lỗi xóa thiết bị' });
  }
};

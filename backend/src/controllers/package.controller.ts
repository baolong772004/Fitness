import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma.js';



export class PackageController {
  static async createPackage(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, type, description, price, durationDays, trialPtSessions, totalPtSessions } = req.body;

      // Validate Type
      if (type !== 'MEMBERSHIP') {
        return res.status(410).json({ success: false, message: 'Gói PT mới phải tạo trong PT Credit Products.' });
      }
      if (type === 'PT' && (!Number.isSafeInteger(Number(totalPtSessions)) || Number(totalPtSessions) <= 0)) {
        return res.status(400).json({ success: false, message: 'PT packages must have a positive totalPtSessions value' });
      }

      const newPackage = await prisma.package.create({
        data: {
          name,
          type,
          description,
          price,
          durationDays,
          trialPtSessions: trialPtSessions || 0,
          totalPtSessions: totalPtSessions || null
        }
      });

      res.status(201).json({ success: true, message: 'Package created successfully', data: newPackage });
    } catch (error) {
      next(error);
    }
  }

  static async getPackages(req: Request, res: Response, next: NextFunction) {
    try {
      const type = req.query.type as string;
      const includeInactive = req.query.includeInactive === 'true';

      const where: any = {};
      if (type) where.type = type;
      if (!includeInactive) where.isActive = true; // Mặc định chỉ lấy gói đang bán

      const packages = await prisma.package.findMany({
        where,
        orderBy: { createdAt: 'desc' }
      });

      res.status(200).json({ success: true, data: packages });
    } catch (error) {
      next(error);
    }
  }

  static async getPackageById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid ID' });

      const pkg = await prisma.package.findUnique({
        where: { id }
      });

      if (!pkg) return res.status(404).json({ success: false, message: 'Package not found' });

      res.status(200).json({ success: true, data: pkg });
    } catch (error) {
      next(error);
    }
  }

  static async updatePackage(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid ID' });

      const { name, type, description, price, durationDays, trialPtSessions, totalPtSessions, isActive } = req.body;

      const pkgExists = await prisma.package.findUnique({ where: { id } });
      if (!pkgExists) return res.status(404).json({ success: false, message: 'Package not found' });
      if (pkgExists.type === 'PT' || type === 'PT') {
        return res.status(410).json({ success: false, message: 'Gói PT cũ chỉ giữ lịch sử. Tạo sản phẩm PT Credit mới.' });
      }

      const effectiveType = type ?? pkgExists.type;
      const effectivePtSessions = totalPtSessions ?? pkgExists.totalPtSessions;
      if (effectiveType === 'PT' && (!Number.isSafeInteger(Number(effectivePtSessions)) || Number(effectivePtSessions) <= 0)) {
        return res.status(400).json({ success: false, message: 'PT packages must have a positive totalPtSessions value' });
      }

      const updatedPackage = await prisma.package.update({
        where: { id },
        data: {
          name,
          type,
          description,
          price,
          durationDays,
          trialPtSessions,
          totalPtSessions,
          isActive
        }
      });

      res.status(200).json({ success: true, message: 'Package updated successfully', data: updatedPackage });
    } catch (error) {
      next(error);
    }
  }

  static async deletePackage(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid ID' });

      const pkgExists = await prisma.package.findUnique({ where: { id } });
      if (!pkgExists) return res.status(404).json({ success: false, message: 'Package not found' });

      // Soft delete: Chuyển isActive thành false thay vì xoá hẳn
      await prisma.package.update({
        where: { id },
        data: { isActive: false }
      });

      res.status(200).json({ success: true, message: 'Package removed successfully (Soft delete)' });
    } catch (error) {
      next(error);
    }
  }
}

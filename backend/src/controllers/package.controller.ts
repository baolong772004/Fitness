import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class PackageController {
  static async createPackage(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, type, description, price, durationDays, trialPtSessions, totalPtSessions } = req.body;

      // Validate Type
      if (type !== 'MEMBERSHIP' && type !== 'PT') {
        return res.status(400).json({ success: false, message: 'Package type must be either MEMBERSHIP or PT' });
      }
      if (type === 'PT' && (!Number.isSafeInteger(Number(totalPtSessions)) || Number(totalPtSessions) <= 0)) {
        return res.status(400).json({ success: false, message: 'Gói PT cần có tổng số buổi PT 1:1 lớn hơn 0.' });
      }
      if (type === 'MEMBERSHIP' && (!Number.isSafeInteger(Number(trialPtSessions ?? 0)) || Number(trialPtSessions ?? 0) < 0)) {
        return res.status(400).json({ success: false, message: 'Số buổi PT tặng kèm phải là số nguyên không âm.' });
      }

      const newPackage = await prisma.package.create({
        data: {
          name,
          type,
          description,
          price,
          durationDays,
          trialPtSessions: type === 'PT' ? 0 : Number(trialPtSessions ?? 0),
          totalPtSessions: type === 'PT' ? Number(totalPtSessions) : null
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
      if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ success: false, message: 'Invalid ID' });

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
      if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ success: false, message: 'Invalid ID' });

      const { name, type, description, price, durationDays, trialPtSessions, totalPtSessions, isActive } = req.body;

      const pkgExists = await prisma.package.findUnique({ where: { id } });
      if (!pkgExists) return res.status(404).json({ success: false, message: 'Package not found' });

      const effectiveType = type ?? pkgExists.type;
      const effectivePtSessions = totalPtSessions ?? pkgExists.totalPtSessions;
      if (effectiveType === 'PT' && (!Number.isSafeInteger(Number(effectivePtSessions)) || Number(effectivePtSessions) <= 0)) {
        return res.status(400).json({ success: false, message: 'Gói PT cần có tổng số buổi PT 1:1 lớn hơn 0.' });
      }
      if (effectiveType === 'MEMBERSHIP' && trialPtSessions !== undefined &&
          (!Number.isSafeInteger(Number(trialPtSessions)) || Number(trialPtSessions) < 0)) {
        return res.status(400).json({ success: false, message: 'Số buổi PT tặng kèm phải là số nguyên không âm.' });
      }

      const updatedPackage = await prisma.package.update({
        where: { id },
        data: {
          name,
          type,
          description,
          price,
          durationDays,
          trialPtSessions: effectiveType === 'PT' ? 0 : trialPtSessions === undefined ? undefined : Number(trialPtSessions),
          totalPtSessions: effectiveType === 'MEMBERSHIP' ? null : totalPtSessions === undefined ? undefined : Number(totalPtSessions),
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
      if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ success: false, message: 'Invalid ID' });

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

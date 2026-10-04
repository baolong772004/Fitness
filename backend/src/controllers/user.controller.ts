import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth.middleware.js';

const prisma = new PrismaClient();

export class UserController {
  static async getUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.max(1, parseInt(req.query.limit as string) || 10);
      const role = req.query.role as string;
      const search = req.query.search as string;
      
      const skip = (page - 1) * limit;

      const where: any = {};
      
      if (role) {
        where.role = role;
      }
      
      if (search) {
        where.OR = [
          { email: { contains: search } },
          { fullName: { contains: search } }
        ];
      }

      const [total, users] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          select: {
            id: true,
            email: true,
            fullName: true,
            phone: true,
            avatar: true,
            gender: true,
            dateOfBirth: true,
            height: true,
            weight: true,
            role: true,
            status: true,
            createdAt: true,
            updatedAt: true
          },
          orderBy: { createdAt: 'desc' }
        })
      ]);

      const totalPages = Math.ceil(total / limit);

      res.status(200).json({
        success: true,
        data: users,
        pagination: {
          total,
          page,
          totalPages,
          limit
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getUserById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid ID' });

      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          avatar: true,
          gender: true,
          dateOfBirth: true,
          height: true,
          weight: true,
          role: true,
          status: true,
          createdAt: true,
          updatedAt: true
        }
      });

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      res.status(200).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }

  static async updateUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid ID' });

      // Check permission: Only Admin/Staff or the owner can update
      const currentUserId = req.user?.userId;
      const currentUserRole = req.user?.role;

      if (currentUserRole !== 'ADMIN' && currentUserRole !== 'STAFF' && currentUserId !== id) {
        return res.status(403).json({ success: false, message: 'Forbidden: You can only update your own profile' });
      }

      const { fullName, phone, address, avatar } = req.body; // Bỏ qua address nếu Schema ko có, update schema nếu cần

      const userExists = await prisma.user.findUnique({ where: { id } });
      if (!userExists) return res.status(404).json({ success: false, message: 'User not found' });

      const updatedUser = await prisma.user.update({
        where: { id },
        data: {
          fullName,
          phone,
          avatar
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          avatar: true,
          role: true,
          status: true,
          updatedAt: true
        }
      });

      res.status(200).json({ success: true, message: 'Profile updated successfully', data: updatedUser });
    } catch (error) {
      next(error);
    }
  }

  static async updateUserRole(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid ID' });

      const { role } = req.body;
      if (!role) {
        return res.status(400).json({ success: false, message: 'Role is required' });
      }

      const validRoles = ['ADMIN', 'STAFF', 'COACH', 'MEMBER'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ success: false, message: 'Invalid role' });
      }

      const userExists = await prisma.user.findUnique({ where: { id } });
      if (!userExists) return res.status(404).json({ success: false, message: 'User not found' });

      const updatedUser = await prisma.user.update({
        where: { id },
        data: { role },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          updatedAt: true
        }
      });

      res.status(200).json({ success: true, message: 'Role updated successfully', data: updatedUser });
    } catch (error) {
      next(error);
    }
  }
}

import { request } from './client';
import { ApiEquipment, ApiRoom } from './types';

export const facilityApi = {
  async getRooms() {
    const res = await request<{ success: boolean; data: ApiRoom[] }>('/facility/rooms');
    return res.data;
  },

  async upsertRoom(payload: {
    id?: number;
    name: string;
    type: string;
    capacity: number;
    isActive?: boolean;
  }) {
    return request<{
      success: boolean;
      message: string;
      data: ApiRoom;
    }>('/facility/rooms', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async createEquipment(payload: {
    name: string;
    code: string;
    roomId: number;
    note?: string;
  }) {
    return request<{
      success: boolean;
      message: string;
      data: ApiEquipment;
    }>('/facility/equipment', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async updateEquipmentStatus(id: number | string, payload: {
    status: 'AVAILABLE' | 'MAINTENANCE' | 'BROKEN' | string;
    note?: string;
  }) {
    return request<{
      success: boolean;
      message: string;
      data: ApiEquipment;
    }>(`/facility/equipment/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  },

  async deleteEquipment(id: number | string) {
    return request<{
      success: boolean;
      message: string;
    }>(`/facility/equipment/${id}`, {
      method: 'DELETE'
    });
  }
};

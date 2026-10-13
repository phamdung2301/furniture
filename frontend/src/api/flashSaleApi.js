/**
 * API module màn Flash sale — FR-028 / F-022 (spec flash-sale.md §9).
 *
 * Contract (khớp FlashSaleController backend):
 *   GET /flash-sale/current -> { program: FlashSaleProgram | null }
 *   FlashSaleProgram { id, status, startAt, endAt, serverNow,
 *     totalUsageLimit, usedCount, items: [...] }
 *   Giá flash do BACKEND trả — module này (và mọi component) không tự tính %.
 *
 * Mock: dữ liệu ở mocks/flashSaleMock.js (đóng vai backend).
 * Hook demo chỉ-mock: thêm ?fs=upcoming hoặc ?fs=ended vào URL trang để xem
 * trạng thái sắp diễn ra / đã kết thúc (giống ?simulate= của màn Thanh toán).
 */
import axiosClient from './axiosClient';
import { getMockFlashSaleProgram } from '../mocks/flashSaleMock';

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
const MOCK_DELAY = 400;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getCurrentFlashSale() {
  if (!USE_MOCK) {
    const { data } = await axiosClient.get('/flash-sale/current');
    return data;
  }
  await delay(MOCK_DELAY);
  const hook =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('fs')
      : null;
  if (hook === 'ended') return { program: null };
  return { program: getMockFlashSaleProgram(hook === 'upcoming' ? 'upcoming' : 'running') };
}

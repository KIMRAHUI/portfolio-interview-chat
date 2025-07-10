
import express, { Request, Response } from 'express';
import { activeInterviewer, io } from '../index';   // io 함께 import

const router = express.Router();

router.get('/', (_req: Request, res: Response) => {
  // 🔍 activeInterviewer가 있지만 실제 socket이 죽어 있으면 초기화
  if (activeInterviewer) {
    const alive = io.sockets.sockets.get(activeInterviewer.socketId);
    if (!alive) {
      (activeInterviewer as any) = null;   // 연결 끊겼으니 리셋
    }
  }

  // ✅ true → 입장 가능, false → 거절
  return res.status(200).json({ canStart: !activeInterviewer });
});

export default router;

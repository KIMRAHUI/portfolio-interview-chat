import express, { Request, Response } from 'express';
import { activeInterviewer } from '../index';

const router = express.Router();

router.get('/', (req: Request, res: Response) => {
  if (activeInterviewer) {
    return res.status(200).json({ canStart: false });
  }
  return res.status(200).json({ canStart: true });
});

export default router;

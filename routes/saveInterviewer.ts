// routes/saveInterviewer.ts
import express from 'express';
import { supabase } from '../utils/supabaseClient';
import { Request, Response, Router } from 'express';

const router: Router = express.Router();

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { name, company, email } = req.body;

  if (!name || !company) {
    res.status(400).json({ error: '이름/회사 필수 입력' });
    return;
  }

  const { error } = await supabase.from('missed_messages').insert({
    name,
    company,
    email,
    message: '',
    timestamp: new Date().toISOString(),
  });

  if (error) {
    console.error('❌ Supabase insert error:', error.message);
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ message: '면접관 정보 저장 완료' });
});

export default router;

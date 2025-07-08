import dotenv from 'dotenv';
dotenv.config(); // ✅ 이 파일에서 다시 로드해줘야 확실히 읽힘

import { createClient } from '@supabase/supabase-js';

console.log('✅ SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('✅ SUPABASE_KEY:', process.env.SUPABASE_KEY);

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('❌ Supabase URL이나 Key가 .env에서 로드되지 않았습니다.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

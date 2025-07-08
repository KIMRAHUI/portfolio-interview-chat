import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import missedMessageRoute from './routes/missedMessage';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

app.use(cors());
app.use(express.json());
app.use('/missed-message', missedMessageRoute);

const PORT = process.env.PORT || 10000;

// ✅ 지원자 상태 (기본: 부재중)
let isAvailable = false;

// ✅ REST API: 지원자가 상태 수동 변경
app.post('/set-availability', (req, res) => {
  const { active } = req.body;
  isAvailable = !!active;
  console.log(`📡 지원자 상태 변경됨 → ${isAvailable ? '활동중' : '부재중'}`);
  res.status(200).json({ status: isAvailable ? '활동중' : '부재중' });

  // 상태 변경 즉시 모든 면접관에게 브로드캐스트
  io.emit('availability', { status: isAvailable });
});

io.on('connection', (socket) => {
  const role = socket.handshake.query.role;
  const name = socket.handshake.query.name;
  const company = socket.handshake.query.company;

  socket.data.role = role;
  socket.data.name = name;
  socket.data.company = company;

  console.log(`🟢 ${role} 접속: ${socket.id} (${name}/${company})`);

  // ✅ 면접관은 접속 즉시 지원자 상태 수신
  if (role === 'interviewer') {
    socket.emit('availability', { status: isAvailable });
  }

  // ✅ 지원자가 상태 변경 시 → 브로드캐스트
  socket.on('availability', (data) => {
    if (socket.data.role === 'applicant') {
      isAvailable = !!data.status;
      io.emit('availability', { status: isAvailable });
      console.log(`📡 [브로드캐스트] 지원자 상태: ${isAvailable ? '활동중' : '부재중'}`);
    }
  });

  // ✅ 면접관 → 메시지 전송 처리
  socket.on('message', (data) => {
    if (socket.data.role !== 'interviewer') {
      console.warn(`❌ 비면접관(${socket.id})이 message 시도`);
      return;
    }

    if (isAvailable) {
      // ✅ 활동중일 경우: 지원자 1명만 찾아서 메시지 전송
      const applicantSocket = [...io.sockets.sockets.values()].find(
        (s) => s.data.role === 'applicant'
      );

      if (applicantSocket) {
        applicantSocket.emit('message', {
          ...data,
          senderId: socket.id,
        });
      }
      } else {
  // ✅ 부재중: 안내 메시지 + 자동 키워드 응답 + Supabase 저장

  // 1. 안내 메시지 보내기
  socket.emit('auto-reply', {
    message: '지금은 부재중입니다. 이메일(rho0531@naver.com)로 문의해주세요. 📩',
  });

  // 2. 키워드 자동응답 (프론트와 동일한 키워드 목록)
  const predefinedAnswers: Record<string, string> = {
    '학력': '메이필드호텔전문학교 식음료학과 졸업 후, 경희사이버대학교 글로벌경영학과를 2024년 8월에 졸업하였습니다.🎓',
    '경력': '에스씨케이컴퍼니(2017~2018), 케이엘이엔씨(2020~2024)에서 고객 응대 및 관리 업무를 수행했습니다. IT 분야는 신입으로 도전 중입니다.💼',
    '성격': '계획적으로 움직이고, 일의 흐름을 논리적으로 정리하는 것을 선호합니다',
    '직무전환': '구조 설계와 흐름 중심의 개발에 더 흥미를 느껴 프론트엔드 직무로 전환을 결심하게 되었습니다.🔄',
    '직무': '사용자 흐름과 데이터 연결이 설계된 화면의 중요성을 느꼈습니다.🔄',
    '포부': '협업할 수 있는 프론트엔드 개발자로 성장하는 것이 목표입니다.🌱',
    '포트폴리오': 'MyCar360, YTS 영화 플랫폼 등 직접 기획하고 구현했습니다.🗂️',
    '기술': 'React, TypeScript, Supabase, Express 등 사용했습니다.🛠️',
    '깃허브': 'GitHub에 정리되어 있으며 히스토리를 남겼습니다.🔗',
    '디자인': '포토샵, 일러스트, AE로 인트로 영상 제작 경험이 있습니다.🎨',
    '자격증': 'SNS 마케팅, GTQ 1급, 웹디자인 기능사 등 자격증을 보유하고 있으며 계속 준비 중입니다.📜',
    '연락': '이메일(rho0531@naver.com)로 문의주세요.✉️',
  };

  const matched = Object.keys(predefinedAnswers).find((key) =>
    data.message.includes(key)
  );

  if (matched) {
    const autoReply = predefinedAnswers[matched];

    socket.emit('reply', {
      message: autoReply,
      senderId: socket.id,
    });
  }


      console.log('[📨 부재중 저장 시도]', {
        name: socket.data.name,
        company: socket.data.company,
        email: data.email,
        message: data.message,
      });

      axios.post(`http://localhost:${PORT}/missed-message`, {
        name: socket.data.name,
        company: socket.data.company,
        email: data.email || '',
        message: data.message,
      });
    }
  });

  // ✅ 지원자 → 답변
  socket.on('reply', (data) => {
    if (socket.data.role !== 'applicant') {
      console.warn(`❌ 비지원자(${socket.id})이 reply 시도`);
      return;
    }

    socket.broadcast.emit('reply', data);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 연결 해제: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

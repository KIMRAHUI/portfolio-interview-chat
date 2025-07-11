import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import missedMessageRoute from './routes/missedMessage';
import saveInterviewerRoute from './routes/saveInterviewer';
import canStartChatRoute from './routes/canStartChat';
export { io };
dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});


const PORT = process.env.PORT || 10000;

// ✅ 지원자 상태 (기본: 부재중)
let isAvailable = false;

// ✅ 1:1 면접관 제한 상태
export let activeInterviewer: {
  name: string;
  company: string;
  socketId: string;
} | null = null;

// ✅ REST API 연결
app.use(cors());
app.use(express.json());
app.use('/missed-message', missedMessageRoute);
app.use('/save-interviewer', saveInterviewerRoute);
app.use('/can-start-chat', canStartChatRoute);

app.post('/set-availability', (req, res) => {
  const { active } = req.body;
  isAvailable = !!active;
  console.log(`📡 지원자 상태 변경됨 → ${isAvailable ? '활동중' : '부재중'}`);
  res.status(200).json({ status: isAvailable ? '활동중' : '부재중' });
  io.emit('availability', { status: isAvailable });
});

io.on('connection', (socket) => {
  const role = socket.handshake.query.role as string;
  const name = socket.handshake.query.name as string;
  const company = socket.handshake.query.company as string;
  const email = socket.handshake.query.email as string;

  socket.data.role = role;
  socket.data.name = name;
  socket.data.company = company;
  socket.data.email = email;

  console.log(`🟢 ${role} 접속: ${socket.id} (${name}/${company})`);

  // ✅ 면접관 진입 제한 처리
  socket.on('interviewer-enter', ({ name, company }) => {
    if (activeInterviewer) {
      socket.emit('entry-denied', {
        message: '현재 채팅 중입니다. 이메일로 문의 주세요.',
      });
      console.log(`❌ 입장 거부됨: ${name}/${company}`);
      return;
    }

    activeInterviewer = { name, company, socketId: socket.id };
    socket.emit('entry-accepted');
    console.log(`✅ 입장 허용됨: ${name}/${company}`);
  });

  // — 면접관 접속 시 지원자에게 info 전달
  if (role === 'interviewer') {
    const info = { name, company, email };
    io.sockets.sockets.forEach((s) => {
      if (s.data.role === 'applicant') {
        s.emit('interviewerInfo', info);
      }
    });
  }

  // — 지원자 접속 시 기존 면접관 정보 전달
  if (role === 'applicant') {
    const interviewer = [...io.sockets.sockets.values()]
      .find((s) => s.data.role === 'interviewer');
    if (interviewer) {
      socket.emit('interviewerInfo', {
        name: interviewer.data.name,
        company: interviewer.data.company,
        email: interviewer.data.email,
      });
    }
  }

  // ✅ 면접관은 활동상태 수신
  if (role === 'interviewer') {
    socket.emit('availability', { status: isAvailable });
  }

  // ✅ 지원자가 상태 변경 시 브로드캐스트
  socket.on('availability', (data) => {
    if (socket.data.role === 'applicant') {
      isAvailable = !!data.status;
      io.emit('availability', { status: isAvailable });
      console.log(`📡 [브로드캐스트] 지원자 상태: ${isAvailable ? '활동중' : '부재중'}`);
    }
  });

  // ✅ 면접관 → 메시지 전송 처리
  socket.on('message', (data) => {
    if (socket.data.role !== 'interviewer') return;

    if (isAvailable) {
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
      socket.emit('auto-reply', {
        message: '지금은 부재중입니다. 이메일(rho0531@naver.com)로 문의해주세요. 📩',
      });

      const predefinedAnswers: Record<string, string> = {
        '학력': '메이필드호텔전문학교 식음료학과 졸업 후, 경희사이버대학교 글로벌경영학과를 2024년 8월에 졸업하였습니다.🎓',
        '경력': '에스씨케이컴퍼니(2017~2018), 케이엘이엔씨(2020~2024)에서 고객 응대 및 관리 업무를 수행했습니다.💼',
        '성격': '계획적으로 움직이고, 일의 흐름을 논리적으로 정리하는 것을 선호합니다',
        '직무전환': '구조 설계와 흐름 중심의 개발에 더 흥미를 느껴 프론트엔드 직무로 전환을 결심하게 되었습니다.🔄',
        '직무': '사용자 흐름과 데이터 연결이 설계된 화면의 중요성을 느꼈습니다.🔄',
        '포부': '협업할 수 있는 프론트엔드 개발자로 성장하는 것이 목표입니다.🌱',
        '포트폴리오': 'MyCar360, YTS 영화 플랫폼 등 직접 기획하고 구현했습니다.🗂️',
        '기술': 'React, TypeScript, Supabase, Express 등 사용했습니다.🛠️',
        '깃허브': 'GitHub에 정리되어 있으며 히스토리를 남겼습니다.🔗',
        '디자인': '포토샵, 일러스트, AE로 인트로 영상 제작 경험이 있습니다.🎨',
        '자격증': 'SNS 마케팅, GTQ 1급, 웹디자인 기능사 등 자격증을 보유하고 있습니다.📜',
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
    if (socket.data.role !== 'applicant') return;
    if (activeInterviewer) {
      io.to(activeInterviewer.socketId).emit('reply', data);
    }
  });

  // ✅ 연결 해제
  socket.on('disconnect', () => {
    if (socket.data.role === 'applicant') {
      activeInterviewer = null;
      console.log('💤 지원자 퇴장 → activeInterviewer 리셋');
    }

    if (activeInterviewer?.socketId === socket.id) {
      activeInterviewer = null;
      console.log('⚠️ 면접관 퇴장 → 상태 초기화됨');
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

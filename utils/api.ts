// src/utils/api.ts

export const setAvailability = async (status: 'available' | 'unavailable') => {
  try {
    const res = await fetch('/set-availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });

    if (!res.ok) {
      throw new Error('서버 응답 실패');
    }

    const result = await res.json();
    console.log('✅ 상태 변경 완료:', result.message);
    return result;
  } catch (err) {
    console.error('❌ 상태 변경 실패:', err);
    return { error: err };
  }
};

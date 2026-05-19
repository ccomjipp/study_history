// ==========================================
// [이음이 역사 공부] 백엔드 AI 프록시 (502 에러 방어 버전)
// ==========================================

const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async (event) => {
  // CORS 프리플라이트(Preflight) 요청 처리
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: ""
    };
  }

  try {
    // 1. 프론트엔드가 보낸 사건명 추출
    const { eventName } = JSON.parse(event.body);
    if (!eventName) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "사건명이 누락되었습니다." })
      };
    }

    // 2. Netlify 환경변수에서 구글 API 키 로드
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
      throw new Error("Netlify 대시보드에 GEMINI_API_KEY 환경변수가 설정되지 않았습니다.");
    }

    // 3. Gemini 인프라 초기화 및 최신 표준 모델 지정
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // 🎯 구형 'gemini-pro' 대신 1.5-flash 지정

    // 4. 구조화된 프롬프트 투사 (역사 데이터 포맷 고정 명령어)
    const prompt = `
      역사 사건 "${eventName}"에 대해 조사해서 아래의 JSON 형식으로만 답변해줘. 
      설명이나 대화문은 절대 포함하지 말고 오직 JSON 데이터만 반환해야 해.
      
      {
        "startYear": 사건의 시작 연도 (숫자만 입력, 기원전이면 마이너스 부호를 붙여줘. 예: 고조선 건국은 -2333, 문종 즉위는 1450),
        "eventPlace": "사건이 일어난 구체적인 장소나 도시 이름 (예: 한양, 교토, 파리)",
        "placeGroup": "한국", "일본", "중국", "동남아시아", "서남아시아", "중앙아시아", "중동", "유럽", "아프리카", "북미", "남미", "기타" 중 정확히 하나만 선택해서 입력,
        "memo": "사건의 원인, 과정, 역사적 의미를 2~3문장으로 간결하게 요약한 문장"
      }
    `;

    // 5. 구글 AI 서버 호출 및 응답 대기
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text().trim();

    // 구글 AI가 간혹 마크다운 태그(```json ... ```)를 섞어 보낼 경우를 대비한 정제 필터링
    if (text.startsWith("```")) {
      text = text.replace(/```json|```/g, "").trim();
    }

    // 6. 정상적인 최종 응답 반환
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: text
    };

  } catch (err) {
    // 🎯 [핵심 방어선] 내부에서 어떤 에러가 나든 프로세스를 터트리지 않고 500 에러 객체로 포장하여 반환합니다.
    console.error("Gemini 프록시 내부 결함 발생:", err);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ 
        error: "AI 대리 서버 내부에서 익셉션이 발생했습니다.", 
        message: err.message 
      })
    };
  }
};

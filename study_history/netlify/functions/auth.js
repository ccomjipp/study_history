// 📄 netlify/functions/auth.js (환경변수 배열/객체 파싱 버전)

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*" }, body: "" };
  }

  try {
    const { userID, password } = JSON.parse(event.body);

    // 🎯 [핵심 로직] Netlify 환경변수에서 텍스트 문자열을 읽어옵니다. (없으면 빈 객체 텍스트)
    const usersEnvString = process.env.ALLOWED_USERS || "{}";

    // 텍스트 문자열을 런타임에서 자바스크립트 오브젝트로 변환(Parsing)합니다!
    const ALLOWED_USERS = JSON.parse(usersEnvString);

    // 이제 ALLOWED_USERS는 메모리 상에서 배열/객체 상태이므로 기존 조작 방식을 그대로 씁니다.
    if (ALLOWED_USERS[userID] && ALLOWED_USERS[userID] === password) {
      return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
        body: JSON.stringify({ success: true, message: "로그인 성공" })
      };
    } else {
      return {
        statusCode: 401,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ success: false, message: "아이디 또는 비밀번호가 올바르지 않습니다." })
      };
    }

  } catch (err) {
    // 만약 JSON 문자열 포맷이 깨져서 파싱 에러(익셉션)가 났을 때의 방어선
    console.error("환경변수 파싱 중 결함 발생:", err);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: false, message: "서버 내부 환경변수 형식 오류" })
    };
  }
};

// netlify/functions/auth.js

exports.handler = async (event) => {
    // POST 요청이 아니면 차단 (보안의 기본이지!)
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    try {
        const { userID, password } = JSON.parse(event.body);

        // [주의] 실제 운영 시에는 DB나 환경변수와 대조해야 해.
        // 동글이가 배포할 때 이 부분을 수정하거나 환경변수로 대체하면 돼.
        const MASTER_ID = process.env.USER_NAME; 
        const MASTER_PW = process.env.USER_PASS; 

        if (userID === MASTER_ID && password === MASTER_PW) {
            return {
                statusCode: 200,
                body: JSON.stringify({ success: true, token: "dummy-session-token" })
            };
        } else {
            return {
                statusCode: 401,
                body: JSON.stringify({ success: false, message: "아이디 또는 비밀번호가 틀렸습니다." })
            };
        }
    } catch (err) {
        return { statusCode: 400, body: JSON.stringify({ error: "잘못된 요청 데이터입니다." }) };
    }
};

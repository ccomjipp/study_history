// netlify/functions/data.js
const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
    const { httpMethod, body, queryStringParameters } = event;
    const userID = queryStringParameters.userID; // URL에서 userID 추출

    if (!userID) {
        return { statusCode: 400, body: "UserID가 필요합니다." };
    }

    // 'history-data'라는 이름의 저장소를 불러와 (마치 하드디스크의 폴더 같은 개념이야)
    const store = getStore({
        name: `history-data-${userID}`,
        siteID: process.env.MY_SITE_ID,       // 우리가 등록한 환경변수 주입!
        token: process.env.MY_NETLIFY_TOKEN   // 우리가 등록한 인증 토큰 주입!
    });
    // 1. GET: 데이터 불러오기 (Read)
    if (httpMethod === "GET") {
        const rawData = await store.get(userID); // userID를 키로 사용해 JSON 문자열을 가져옴
        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: rawData || JSON.stringify([]) // 데이터가 없으면 빈 배열 반환
        };
    }

    // 2. POST: 데이터 전체 저장 또는 수정 (Write)
    if (httpMethod === "POST") {
        const dataToSave = body; // 프론트엔드에서 보낸 JSON 문자열
        await store.set(userID, dataToSave); // userID 키에 데이터를 덮어씌움
        return { statusCode: 200, body: "저장 성공" };
    }

    // 3. DELETE: (여기서는 POST에서 필터링 후 전체 저장하는 방식으로 처리하므로 별도 구현은 옵션이야)
    
    return { statusCode: 405, body: "지원하지 않는 메소드입니다." };
};

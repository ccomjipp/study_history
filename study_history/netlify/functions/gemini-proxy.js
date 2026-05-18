const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async (event) => {
  const { eventName } = JSON.parse(event.body);
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });

  const prompt = `${eventName}에 대해 다음 JSON 형식으로만 답해줘. 
    {"startYear": 숫자, "eventPlace": "장소", "placeGroup": "권역", "memo": "30자 요약"}`;

  const result = await model.generateContent(prompt);
  return { statusCode: 200, body: result.response.text() };
};
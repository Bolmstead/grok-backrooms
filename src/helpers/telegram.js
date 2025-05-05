import axios from "axios";
import dotenv from "dotenv";
dotenv.config();
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const backroomChatId = 1234567890;
const errorChatId = process.env.ERROR_CHAT_ID;

const sendTeleMessage = async (msgObject) => {
  const { content, _id, scenario, messageCreatedBy } = msgObject;
  const { ai1Name, ai2Name } = scenario;
  let aiName = "";

  try {
    console.log("📝 Message content:", content);
    console.log("🔑 Message ID:", _id);
    console.log("👤 Message created by:", messageCreatedBy);
    if (messageCreatedBy === "ai1") {
      aiName = ai1Name;
    } else if (messageCreatedBy === "ai2") {
      aiName = ai2Name;
    }

    let teleText, chatId;

    if (!aiName || !content || !_id || !scenario) {
      console.log("Error sending message:", msgObject);
      teleText = `Error sending message: 
aiName: ${aiName} 
content: ${content} 
_id: ${_id} `;
      chatId = errorChatId;
    } else {
      teleText = `<${aiName}:${_id}> 
${content}`;
      chatId = backroomChatId;
    }

    console.log("🔑 Sending message to:", chatId);
    console.log("📝 Message content:", teleText);

    const response = await axios.post(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        chat_id: chatId,
        text: teleText,
      }
    );
    console.log("Message sent:", response.data);
  } catch (error) {
    try {
      await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        chat_id: errorChatId,
        text: `THROWN Error sending message:
aiName: ${aiName} 
content: ${content} 
_id: ${_id} `,
      });
      console.error("THROWN Error sending message:");
    } catch (error) {
      console.error("Error sending telegram error message:", error);
    }
  }
};

export { sendTeleMessage };

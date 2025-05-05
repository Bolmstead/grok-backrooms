import { config } from "dotenv";
config();
import { Scraper, SearchMode } from "agent-twitter-client";

const scraper = new Scraper();
let isLoggedIn = false;
let loginAttempts = 0;
const MAX_LOGIN_ATTEMPTS = 3;

const username = process.env.TEST_ACCOUNT_X_USERNAME;
const password = process.env.TEST_ACCOUNT_X_PASSWORD;

console.log("username:: ", username);
console.log("password:: ", password);

async function ensureLoggedIn() {
  if (!isLoggedIn && loginAttempts < MAX_LOGIN_ATTEMPTS) {
    console.log("🔑 Logging into Twitter...");
    try {
      await scraper.login(username, password);
      isLoggedIn = true;
      loginAttempts = 0; // Reset attempts on successful login
      console.log("✅ Successfully logged into Twitter");
    } catch (error) {
      loginAttempts++;
      console.error("❌ Failed to login to Twitter:", error.message);
      if (error.message.includes("ArkoseLogin")) {
        console.log(
          "⚠️ Twitter requires captcha verification. Please login manually through the web interface."
        );
        return false;
      }
      if (loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        console.log(
          "⚠️ Maximum login attempts reached. Please try again later."
        );
        return false;
      }
      return false;
    }
  }
  return isLoggedIn;
}

export async function sendTweet(msg) {
  try {
    const loggedIn = await ensureLoggedIn();
    if (!loggedIn) {
      console.log("⚠️ Skipping tweet due to login issues");
      return false;
    }

    console.log("🐦 Sending tweet...");
    await scraper.sendTweet(msg);
    console.log("✅ Tweet sent successfully");
    return true;
  } catch (error) {
    console.error("❌ Error sending tweet:", error.message);
    // If we get an auth error, try logging in again
    if (error.message.includes("auth") || error.message.includes("login")) {
      console.log("🔄 Auth error detected, attempting to relogin...");
      isLoggedIn = false;
      loginAttempts = 0; // Reset attempts for retry
      const loggedIn = await ensureLoggedIn();
      if (loggedIn) {
        // Retry sending the tweet
        await scraper.sendTweet(msg);
        console.log("✅ Tweet sent successfully after relogin");
        return true;
      }
    }
    return false;
  }
}

// Remove the test tweet
// sendTweet("Hello world!");

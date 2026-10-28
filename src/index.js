
import "dotenv/config";
import { Bot } from "../yapper.js";
import { createQuote } from "./quote-handler.js";

if (!process.env.YAPPER_BOT_TOKEN) {
  throw new Error("Missing YAPPER_BOT_TOKEN in .env");
}

const bot = new Bot(process.env.YAPPER_BOT_TOKEN);

bot.command("ping", "Check that Make It a Quote is online", async (msg) => {
  await msg.reply("pong! im ready to make quotes");
});

bot.on("ready", (me) => {
  console.log("Make It a Quote is online:", me);
});

bot.on("error", (error) => {
  console.error("[Make It a Quote]", error);
});

bot.on("message", async (msg) => {
  if (!msg.mentioned || !msg.reply_to_id || msg.author_bot) return;

  console.log("Quote request received:", {
    messageId: msg.id,
    replyTo: msg.reply_to_id,
    channel: msg.channel_name
  });

  try {
    await createQuote(bot, msg);
    console.log("Quote card posted successfully.");
  } catch (error) {
    console.error("Quote generation failed:", error);

    try {
      await msg.reply(
        "I couldn't generate that quote card. Check the bot terminal for the error."
      );
    } catch (replyError) {
      console.error("Could not send error message:", replyError);
    }
  }
});

console.log("Starting Make It a Quote...");
bot.start().catch((error) => {
  console.error("Bot startup failed:", error);
});


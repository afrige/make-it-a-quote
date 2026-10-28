
import sharp from "sharp";
import { Embed } from "../yapper.js";
import { randomUUID } from "node:crypto";

const WIDTH = 1200;
const HEIGHT = 630;
const WATERMARK = process.env.QUOTE_WATERMARK || "MAKE IT A QUOTE";

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapText(text, maxChars = 36) {
  const words = String(text).trim().split(/\s+/);
  const lines = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;

    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }

  if (line) lines.push(line);
  return lines;
}

export async function createQuoteImage(quote, author) {
  // Keep cards readable and avoid huge message payloads.
  const cleanQuote = String(quote || "").trim().slice(0, 700);
  const cleanAuthor = String(author || "Unknown author").slice(0, 80);

  if (!cleanQuote) {
    throw new Error("Cannot create a quote card from an empty message.");
  }

  const lines = wrapText(cleanQuote, 36).slice(0, 10);
  const fontSize = lines.length > 7 ? 30 : lines.length > 5 ? 36 : 43;
  const lineHeight = fontSize * 1.35;
  const textHeight = lines.length * lineHeight;
  const startY = Math.max(185, (HEIGHT - textHeight) / 2 + 10);

  const quoteSvg = lines
    .map(
      (line, index) =>
        `<text x="600" y="${startY + index * lineHeight}" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="600">${escapeXml(line)}</text>`
    )
    .join("");

  const authorY = Math.min(545, startY + textHeight + 42);

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
    <defs>
      <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#050505"/>
        <stop offset="50%" stop-color="#292929"/>
        <stop offset="100%" stop-color="#080808"/>
      </linearGradient>
      <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#444444"/>
        <stop offset="50%" stop-color="#ffffff"/>
        <stop offset="100%" stop-color="#444444"/>
      </linearGradient>
    </defs>

    <rect width="${WIDTH}" height="${HEIGHT}" rx="28" fill="url(#background)"/>
    <rect x="36" y="36" width="1128" height="558" rx="22"
          fill="none" stroke="#ffffff" stroke-opacity=".2"/>

    <text x="78" y="142" fill="#ffffff" opacity=".25"
          font-family="Georgia, serif" font-size="150">“</text>

    ${quoteSvg}

    <rect x="450" y="${Math.min(490, authorY - 35)}"
          width="300" height="2" fill="url(#accent)"/>

    <text x="600" y="${authorY}" text-anchor="middle"
          fill="#dedede" font-family="Arial, sans-serif" font-size="22">
      — ${escapeXml(cleanAuthor)}
    </text>

    <text x="600" y="583" text-anchor="middle"
          fill="#999999" font-family="Arial, sans-serif"
          font-size="15" letter-spacing="4">${escapeXml(WATERMARK)}</text>
  </svg>`;

  return sharp(Buffer.from(svg))
    .png()
    .toBuffer();
}

async function uploadToGitHub(buffer) {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || "main";

  if (!token || !owner || !repo) {
    throw new Error(
      "GitHub configuration missing. Set GITHUB_TOKEN, GITHUB_OWNER and GITHUB_REPO in .env."
    );
  }

  const filename =
    `quotes/quote-${Date.now()}-${randomUUID().slice(0, 8)}.png`;

  const endpoint =
    `https://api.github.com/repos/${owner}/${repo}/contents/${filename}`;

  const requestBody = JSON.stringify({
    message: "Add generated quote card",
    content: buffer.toString("base64"),
    branch
  });

  let response;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`Uploading quote image to GitHub (${attempt}/3)...`);

      response = await fetch(endpoint, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
          "User-Agent": "Make-It-A-Quote"
        },
        body: requestBody,
        signal: AbortSignal.timeout(30000)
      });

      break;
    } catch (error) {
      console.error(
        `GitHub upload attempt ${attempt} failed:`,
        error.cause || error.message
      );

      if (attempt === 3) {
        throw new Error("GitHub upload failed after three attempts.", {
          cause: error
        });
      }

      await new Promise(resolve => setTimeout(resolve, attempt * 1500));
    }
  }

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `GitHub upload failed (${response.status}): ${details.slice(0, 500)}`
    );
  }

  const data = await response.json();

  if (!data.content?.path) {
    throw new Error("GitHub accepted the request but returned no file path.");
  }

  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${data.content.path}`;
}

export async function createQuote(bot, event) {
  if (!event.reply_to_id) {
    await event.reply(
      "Reply to a message and mention me to create a quote card."
    );
    return;
  }

  console.log("Fetching the original message...");

  const result = await bot.message(event.channel_id, event.reply_to_id);
  const original = result?.message ?? result;

  if (!original || !String(original.content || "").trim()) {
    await event.reply(
      "I couldn't find readable text in the message you replied to."
    );
    return;
  }

  if (original.author_bot) {
    await event.reply("Please reply to a message written by a person.");
    return;
  }

  let author = original.author || "Unknown author";

  if (original.author_id) {
    try {
      const result = await bot.user(original.author_id);
      const profile = result?.user ?? result;

      author =
        profile?.display_name ||
        profile?.username ||
        profile?.name ||
        author;
    } catch (error) {
      console.warn(
        "Couldn't fetch author profile; using message author instead:",
        error.message
      );
    }
  }

  console.log("Generating quote PNG...");
  const imageBuffer = await createQuoteImage(original.content, author);
  console.log(`Quote PNG generated (${imageBuffer.length} bytes).`);

  console.log("Uploading quote PNG...");
  const imageUrl = await uploadToGitHub(imageBuffer);
  console.log("Quote image hosted successfully.");

  const embed = new Embed()
    .title("A quote to remember")
    .image(imageUrl)
    .color("#222222")
    .footer("Make It a Quote");

  console.log("Posting quote card to Yapper...");

  await bot.send(event.channel_id, "", {
    replyTo: event.id,
    embeds: [embed]
  });

  console.log("Quote card posted successfully!");
}

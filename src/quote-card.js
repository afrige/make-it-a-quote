
const sharp = require("sharp");

function escapeXml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;"
  })[char]);
}

function wrapText(text, maxChars) {
  const words = String(text).trim().split(/\s+/);
  const lines = [];
  let line = "";

  for (const word of words) {
    if (!word) continue;

    const candidate = line ? `${line} ${word}` : word;

    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }

  if (line) lines.push(line);

  return lines.length ? lines : [" "];
}

function createSvg({ text, author, username }) {
  const width = 1200;
  const height = 675;

  const safeText = String(text || "").slice(0, 2000);
  const lines = wrapText(safeText, 29).slice(0, 9);

  let fontSize = 48;
  if (lines.length > 5) fontSize = 38;
  if (lines.length > 7) fontSize = 30;

  const lineHeight = fontSize * 1.28;
  const blockHeight = lines.length * lineHeight;
  const startY = Math.max(110, 300 - blockHeight / 2);

  const quoteText = lines.map((line, index) => `
    <text
      x="650"
      y="${startY + index * lineHeight}"
      fill="#ffffff"
      font-size="${fontSize}"
      font-family="Arial, sans-serif"
    >${escapeXml(line)}</text>
  `).join("");

  const safeAuthor = escapeXml(author || "Unknown author");
  const safeUsername = escapeXml(username || "");

  const watermark = escapeXml(
    process.env.QUOTE_WATERMARK || "Make It a Quote"
  );

  return `
  <svg xmlns="http://www.w3.org/2000/svg"
       width="${width}" height="${height}"
       viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="background" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#f5f5f5"/>
        <stop offset="43%" stop-color="#888888"/>
        <stop offset="62%" stop-color="#111111"/>
        <stop offset="100%" stop-color="#050505"/>
      </linearGradient>
      <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
        <stop offset="100%" stop-color="#000000" stop-opacity=".4"/>
      </linearGradient>
    </defs>

    <rect width="1200" height="675" fill="url(#background)"/>
    <rect width="1200" height="675" fill="url(#fade)"/>

    <!-- Original minimalist mascot -->
    <g transform="translate(100 180)" stroke="#111" stroke-width="12"
       stroke-linecap="round" stroke-linejoin="round">
      <ellipse cx="190" cy="160" rx="145" ry="125" fill="#f4f4f4"/>
      <path d="M85 92 L60 45 L110 65" fill="#f4f4f4"/>
      <path d="M295 92 L320 45 L270 65" fill="#f4f4f4"/>
      <circle cx="140" cy="150" r="10" fill="#111"/>
      <circle cx="240" cy="150" r="10" fill="#111"/>
      <path d="M155 190 Q190 225 225 190" fill="none"/>
      <path d="M190 205 L190 340" fill="none"/>
      <path d="M190 340 L120 420 M190 340 L260 420" fill="none"/>
      <path d="M90 275 L70 365 M290 275 L310 365" fill="none"/>
    </g>

    ${quoteText}

    <text x="650" y="${Math.min(590, startY + blockHeight + 48)}"
          fill="#eeeeee" font-size="27" font-style="italic"
          font-family="Arial, sans-serif">— ${safeAuthor}</text>

    <text x="650" y="${Math.min(625, startY + blockHeight + 83)}"
          fill="#999999" font-size="20"
          font-family="Arial, sans-serif">${safeUsername}</text>

    <text x="1165" y="650" text-anchor="end"
          fill="#777777" font-size="18"
          font-family="Arial, sans-serif">${watermark}</text>
  </svg>`;
}

async function generateQuoteCard(options) {
  const svg = createSvg(options);

  return sharp(Buffer.from(svg))
    .png()
    .toBuffer();
}

module.exports = { generateQuoteCard };

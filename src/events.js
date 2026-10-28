
const { api } = require("./api");

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function summarizeEvent(event) {
  // Diagnostic only: don't assume undocumented event fields.
  console.log(
    "[Make It a Quote] Event received:",
    JSON.stringify(event, null, 2)
  );
}

async function startEventListener() {
  let cursor = "0";

  console.log("Connecting to Yapin event API...");

  while (true) {
    try {
      const result = await api(
        `/events?after=${encodeURIComponent(cursor)}&wait=25&max_age=86400`
      );

      const events = Array.isArray(result)
        ? result
        : result?.events || result?.data || [];

      for (const event of events) {
        summarizeEvent(event);

        const id =
          event.id ??
          event.event_id ??
          event.eventId;

        if (id != null) {
          cursor = String(id);
        }
      }

      const nextCursor =
        result?.last_event_id ??
        result?.lastEventId ??
        result?.after;

      if (nextCursor != null) {
        cursor = String(nextCursor);
      }

      if (!events.length) {
        await sleep(500);
      }
    } catch (error) {
      console.error("Event polling failed:", error.message);

      if (error.status === 401 || error.status === 403) {
        console.error("Check your bot token and permissions.");
        await sleep(10000);
      } else if (error.status === 429) {
        const seconds = Number(error.retryAfter) || 5;
        await sleep(Math.max(1, seconds) * 1000);
      } else {
        await sleep(3000);
      }
    }
  }
}

module.exports = { startEventListener };


// Sends push notifications to the mobile app via Expo's push service.
// Fire-and-forget by design: a delivery failure here should never break the
// request (assigning a workout, finishing a session) that triggered it.
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

async function sendPushToUser(userId, { title, body, data } = {}) {
  try {
    const tokensResult = await global.db.query('SELECT token FROM "PushToken" WHERE "userId" = $1', [userId]);
    if (tokensResult.rows.length === 0) return;

    const messages = tokensResult.rows.map((row) => ({
      to: row.token,
      title,
      body,
      data: data || {},
      sound: 'default',
    }));

    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });

    const result = await response.json().catch(() => null);
    const tickets = Array.isArray(result?.data) ? result.data : [];

    const deadTokens = tickets
      .map((ticket, index) => (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered' ? messages[index].to : null))
      .filter(Boolean);

    if (deadTokens.length > 0) {
      await global.db.query('DELETE FROM "PushToken" WHERE token = ANY($1::text[])', [deadTokens]);
    }
  } catch (err) {
    console.error('Erro ao enviar push notification:', err.message);
  }
}

module.exports = { sendPushToUser };

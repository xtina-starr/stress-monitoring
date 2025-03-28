const fetch = require('node-fetch');
const { DateTime } = require('luxon');

const OURA_TOKEN = process.env.OURA_TOKEN;
const PUSHOVER_TOKEN = process.env.PUSHOVER_TOKEN;
const PUSHOVER_USER = process.env.PUSHOVER_USER;
const STRESS_RECOVERY_THRESHOLD = 1800; // 30 minutes
const STRESS_ACTIONS = [
  'Do Qigong tapping or shaking',
  'Take a screen break and a couple of deep breaths',
  'Go for a short walk',
  'Practice resonant breathing',
  'Listen to Falling by Oscar Mbo',
  'Stretch for 5 minutes'
];

function getLocalDate() {
  const centralTime = DateTime.now().setZone('America/Chicago');
  return centralTime.toFormat('yyyy-MM-dd');
}

async function getStressData () {
  const todayString = getLocalDate();
  const url = `https://api.ouraring.com/v2/usercollection/daily_stress?start_date=${todayString}&end_date=${todayString}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${OURA_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching Oura data:', error);
    throw error;
  }
}

async function sendPushoverNotification(message) {
  try {
    const response = await fetch('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        token: PUSHOVER_TOKEN,
        user: PUSHOVER_USER,
        message: message,
        title: 'Oura Stress Monitor',
        priority: 1
      })
    });
    const responseData = await response.json();
    if (response.ok) {
      console.log('Notification sent successfully:', responseData);
    } else {
      console.log('Failed to send notification:', responseData);
    }
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
}

exports.checkStressLevels = async () => {
  try {
    const data = await getStressData();

    if (!data || !data.data || !data.data.length) {
      throw new Error('No stress data available!');
    }

    const stressHigh = data?.data[0]?.stress_high;
    const recoveryHigh = data?.data[0]?.recovery_high;
    const stressMinutes = Math.round(stressHigh / 60);
    const recoveryMinutes = Math.round(recoveryHigh / 60);
    const stressRecoveryDifference = stressHigh - recoveryHigh;
    const daySummary = data.data[0].day_summary;

    const now = DateTime.now().setZone('America/Chicago');
    const formattedTime = now.toFormat('h:mm a');

    const differenceInMinutes = Math.round(stressRecoveryDifference / 60);
    const randomAction = STRESS_ACTIONS[Math.floor(Math.random() * STRESS_ACTIONS.length)];

    if (stressRecoveryDifference > STRESS_RECOVERY_THRESHOLD || daySummary === 'stressful') {
      await sendPushoverNotification(
        `${formattedTime} | High stress imbalance detected: ${differenceInMinutes} mins.\n\n` +
        `Stress: ${stressMinutes}min vs Recovery: ${recoveryMinutes}min\n` +
        `Consider taking a restorative break: ${randomAction}.`
      )
    }
  } catch (error) {
    console.error('Function error:', error);
    throw error;
  }
}
